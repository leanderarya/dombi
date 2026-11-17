#!/usr/bin/env python3
"""Production SSH transport for the main-triggered pipeline.

Reuses the GitHub Environment `production` secret names already present
(HOSTINGER_SSH_HOST/PORT/USER/PASSWORD). Secrets are never printed, logged or
echoed: diagnostics are suppressed on failure, and the child process environment
has the SSH secrets stripped so a nested tool cannot leak them.

Security posture is copied from the reviewed staging transport rather than
reinvented: password auth only, ED25519 host key pinned by fingerprint, no agent
forwarding, no control multiplexing, `StrictHostKeyChecking=yes` against a
throwaway `known_hosts`, and exactly one password prompt.
"""

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import struct
import subprocess
import sys
import tempfile


# ── activation (same two-control model as the transport's caller) ─────────
PRODUCTION_DEPLOY_ACTIVATED = False

PRODUCTION_ROOT = "domains/dombicenter.com/public_html/app"
TRANSFER_PARENT = "dombi-ci-production"
SECRET_NAMES = ("HOSTINGER_SSH_HOST", "HOSTINGER_SSH_PORT",
                "HOSTINGER_SSH_USER", "HOSTINGER_SSH_PASSWORD")
PHASES = ("upload", "deploy", "rollback")
UPLOAD_FILES = ("release.tar.gz", "release.sha256", "release.py",
                "filesystem_checkpoint.py", "single_owner_deploy.py")


class TransportError(RuntimeError):
    pass


def require(condition, reason):
    if not condition:
        raise TransportError(reason)


# ── secrets ───────────────────────────────────────────────────────────────
def connection_values(env):
    """Validate shape only. Values are never returned to a caller that logs."""
    host = env.get("HOSTINGER_SSH_HOST", "")
    user = env.get("HOSTINGER_SSH_USER", "")
    password = env.get("HOSTINGER_SSH_PASSWORD", "")
    port = env.get("HOSTINGER_SSH_PORT", "")
    fingerprint = env.get("HOSTINGER_SSH_FINGERPRINT", "")
    require(host, "ssh_host_missing")
    require(len(host) <= 253 and all(
        re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?", label)
        for label in host.split(".")), "ssh_host_shape")
    require(re.fullmatch(r"[A-Za-z0-9_][A-Za-z0-9_.-]*", user or "") is not None,
            "ssh_user_shape")
    require(port.isascii() and port.isdigit() and 1 <= int(port) <= 65535
            and str(int(port)) == port, "ssh_port_shape")
    require(password and not re.search(r"[\x00\r\n]", password), "ssh_password_shape")
    require(re.fullmatch(r"SHA256:[A-Za-z0-9+/]{43}", fingerprint or "") is not None,
            "ssh_fingerprint_shape")
    return host, user, password, port, fingerprint


def pinned_key(scan, fingerprint, expected_endpoint=None):
    """Accept exactly one ED25519 key whose digest matches the pinned fingerprint."""
    require(re.fullmatch(r"SHA256:[A-Za-z0-9+/]{43}", fingerprint), "fingerprint_format")
    keys = set()
    for line in scan.splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        fields = line.split()
        require(len(fields) == 3 and fields[1] == "ssh-ed25519", "keyscan_record")
        if expected_endpoint is not None:
            require(fields[0] == expected_endpoint, "keyscan_endpoint")
        blob = base64.b64decode(fields[2], validate=True)
        prefix = struct.pack(">I", 11) + b"ssh-ed25519" + struct.pack(">I", 32)
        require(len(blob) == 51 and blob.startswith(prefix), "ed25519_blob")
        keys.add(fields[2])
    require(len(keys) == 1, "ed25519_keys")
    key = keys.pop()
    digest = "SHA256:" + base64.b64encode(
        hashlib.sha256(base64.b64decode(key)).digest()).decode().rstrip("=")
    require(digest == fingerprint, "host_key_not_pinned")
    return key


def endpoint_name(host, port):
    return host if port == "22" else "[%s]:%s" % (host, port)


def ssh_options(known):
    return ["-F", "/dev/null",
            "-o", "HostKeyAlgorithms=ssh-ed25519",
            "-o", "StrictHostKeyChecking=yes", "-o", "UpdateHostKeys=no",
            "-o", "UserKnownHostsFile=%s" % known, "-o", "GlobalKnownHostsFile=/dev/null",
            "-o", "PreferredAuthentications=password", "-o", "PasswordAuthentication=yes",
            "-o", "PubkeyAuthentication=no", "-o", "KbdInteractiveAuthentication=no",
            "-o", "NumberOfPasswordPrompts=1", "-o", "ConnectTimeout=15",
            "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=2",
            "-o", "ForwardAgent=no", "-o", "ClearAllForwardings=yes",
            "-o", "PermitLocalCommand=no", "-o", "ControlMaster=no",
            "-o", "ControlPath=none", "-o", "LogLevel=ERROR"]


def child_environment():
    """Strip the SSH secrets so a nested process cannot inherit them."""
    return {key: value for key, value in os.environ.items()
            if not key.startswith("HOSTINGER_SSH_")
            and key not in {"SSH_AUTH_SOCK", "SSH_ASKPASS", "SSH_ASKPASS_REQUIRE",
                            "SSHPASS", "DISPLAY"}}


# ── host script ───────────────────────────────────────────────────────────
def host_script(phase, env, transfer_id):
    """The exact remote command. Must pass every root and layout check first."""
    require(phase in PHASES, "phase")
    require(re.fullmatch(r"release-[a-f0-9]{16}", transfer_id or "") is not None,
            "transfer_id")
    script = "set -eu\numask 077\n"
    script += 'root="$HOME/%s"\n' % PRODUCTION_ROOT
    script += ('test -d "$root"; test ! -L "$root"; test "$(realpath "$root")" = "$root"\n'
               'test -f "$root/.env"; test ! -L "$root/.env"; test -O "$root/.env"\n'
               'for d in storage database bootstrap/cache public; do\n'
               '  test -d "$root/$d"; test ! -L "$root/$d"\n'
               'done\n'
               'test ! -e "$root/storage/framework/down"\n')
    script += 'parent="$HOME/%s"\n' % TRANSFER_PARENT
    script += ('test -d "$parent"; test ! -L "$parent"; test -O "$parent"\n'
               'test "$(stat -c %a "$parent")" = 700\n')
    directory = '"$parent/%s"' % transfer_id
    if phase == "upload":
        script += "test ! -e %s\ntest ! -L %s\nmkdir -m 700 %s\n" % (
            directory, directory, directory)
        return script
    script += "cd %s\n" % directory
    if phase == "deploy":
        sha = env.get("RELEASE_SHA", "")
        archive_sha = env.get("ARCHIVE_SHA256", "")
        require(re.fullmatch(r"[a-f0-9]{40}", sha or "") is not None, "release_sha")
        require(re.fullmatch(r"[a-f0-9]{64}", archive_sha or "") is not None, "archive_sha")
        script += ("python3 -B single_owner_deploy.py deploy --archive release.tar.gz "
                   "--checksum-file release.sha256 --application-sha %s "
                   "--archive-sha256 %s\n" % (sha, archive_sha))
    else:
        operation = env.get("OPERATION_ID", "")
        require(re.fullmatch(r"[a-z]+-[0-9TZ]+-[0-9a-f]{8}", operation or "") is not None,
                "operation_id")
        script += "python3 -B single_owner_deploy.py rollback --operation %s\n" % (
            shlex.quote(operation))
    return script


def transfer_files(source):
    """The upload set must be exactly the reviewed five, regular and unlinked."""
    directory = Path(source)
    require(directory.is_dir() and not directory.is_symlink(), "transfer_directory")
    present = {p.name for p in directory.iterdir()}
    require(present == set(UPLOAD_FILES), "transfer_inventory")
    files = sorted(directory.iterdir())
    for path in files:
        require(path.is_file() and not path.is_symlink() and path.stat().st_nlink == 1,
                "transfer_entry")
    return files


# ── execution ─────────────────────────────────────────────────────────────
def run_phase(phase, env, source="transfer"):
    require(PRODUCTION_DEPLOY_ACTIVATED is True, "production_transport_not_activated")
    host, user, password, port, fingerprint = connection_values(env)
    transfer_id = env.get("TRANSFER_ID", "")
    script = host_script(phase, env, transfer_id)
    files = transfer_files(source) if phase == "upload" else []
    base = child_environment()
    try:
        scanned = subprocess.run(
            ["ssh-keyscan", "-T", "10", "-p", port, "-t", "ed25519", host],
            capture_output=True, text=True, env=base, timeout=20, check=True)
        endpoint = endpoint_name(host, port)
        key = pinned_key(scanned.stdout, fingerprint, endpoint)
        with tempfile.TemporaryDirectory(prefix="dombi-prod-ssh-") as directory:
            known = Path(directory) / "known_hosts"
            known.write_text("%s ssh-ed25519 %s\n" % (endpoint, key))
            known.chmod(0o600)
            options = ssh_options(known)
            child = dict(base)
            child["SSHPASS"] = password
            target = "%s@%s" % (user, host)
            directory_path = "%s/%s" % (TRANSFER_PARENT, transfer_id)
            if phase == "upload":
                command = ["sshpass", "-e", "scp", *options, "-P", port,
                           *[str(p.resolve()) for p in files],
                           "%s:%s/" % (target, directory_path)]
                subprocess.run(command, capture_output=True, text=True, env=child,
                               timeout=300, check=True)
            else:
                command = ["sshpass", "-e", "ssh", *options, "-T", "-p", port,
                           target, "bash -se"]
                subprocess.run(command, input=script, capture_output=True, text=True,
                               env=child, timeout=900, check=True)
        return {"phase": phase, "transfer_id": transfer_id}
    except (subprocess.SubprocessError, OSError) as error:
        # Never surface stderr: it can contain host banners or command echoes.
        raise TransportError("transport_failed") from error


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--phase", choices=PHASES, required=True)
    parser.add_argument("--transfer", default="transfer")
    args = parser.parse_args(argv)
    try:
        print(json.dumps(run_phase(args.phase, os.environ, args.transfer), sort_keys=True))
        return 0
    except (TransportError, ValueError, KeyError, TypeError):
        print("PRODUCTION_TRANSPORT_ABORT; diagnostics suppressed to protect secrets",
              file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
