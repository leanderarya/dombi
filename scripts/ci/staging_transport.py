#!/usr/bin/env python3
"""Password-only staging SSH/SCP with an explicitly pinned ED25519 host key."""

import base64
import hashlib
import os
from pathlib import Path
import re
import shlex
import struct
import subprocess
import sys
import tempfile


def pinned_key(scan, fingerprint, expected_endpoint=None):
    if not re.fullmatch(r'SHA256:[A-Za-z0-9+/]{43}', fingerprint):
        raise ValueError('Invalid fingerprint format')
    keys = set()
    for line in scan.splitlines():
        if not line.strip() or line.startswith('#'):
            continue
        fields = line.split()
        if (len(fields) != 3 or fields[1] != 'ssh-ed25519' or
                (expected_endpoint is not None and fields[0] != expected_endpoint)):
            raise ValueError('Unexpected keyscan record')
        blob = base64.b64decode(fields[2], validate=True)
        prefix = struct.pack('>I', 11) + b'ssh-ed25519' + struct.pack('>I', 32)
        if len(blob) != 51 or not blob.startswith(prefix):
            raise ValueError('Invalid ED25519 key')
        keys.add(fields[2])
    if len(keys) != 1:
        raise ValueError('Missing or ambiguous ED25519 keys')
    key = keys.pop()
    digest = 'SHA256:' + base64.b64encode(hashlib.sha256(base64.b64decode(key)).digest()).decode().rstrip('=')
    if digest != fingerprint:
        raise ValueError('Pinned ED25519 key not found')
    return key


def connection_values(env, require_database=True):
    host, user, password, port, fingerprint = [env.get('HOSTINGER_SSH_' + name, '')
                                             for name in ('HOST', 'USER', 'PASSWORD', 'PORT', 'FINGERPRINT')]
    database = env.get('STAGING_DATABASE_NAME', '')
    if (not host or len(host) > 253 or not all(
            re.fullmatch(r'[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?', label)
            for label in host.split('.')) or
            not re.fullmatch(r'[A-Za-z0-9_][A-Za-z0-9_.-]*', user) or
            not port.isascii() or not port.isdigit() or not 1 <= int(port) <= 65535 or
            str(int(port)) != port or not password or re.search(r'[\x00\r\n]', password) or
            (require_database and (not database or re.search(r'[;\x00-\x1f]', database))) or
            not re.fullmatch(r'SHA256:[A-Za-z0-9+/]{43}', fingerprint)):
        raise ValueError('Invalid or unsupported staging secret')
    return host, user, password, port, fingerprint, database


def endpoint_name(host, port):
    return host if port == '22' else f'[{host}]:{port}'


def ssh_options(known):
    return ['-F', '/dev/null',
            '-o', 'HostKeyAlgorithms=ssh-ed25519',
            '-o', 'StrictHostKeyChecking=yes', '-o', 'UpdateHostKeys=no',
            '-o', f'UserKnownHostsFile={known}', '-o', 'GlobalKnownHostsFile=/dev/null',
            '-o', 'PreferredAuthentications=password', '-o', 'PasswordAuthentication=yes',
            '-o', 'PubkeyAuthentication=no', '-o', 'KbdInteractiveAuthentication=no',
            '-o', 'NumberOfPasswordPrompts=1', '-o', 'ConnectTimeout=15',
            '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=2',
            '-o', 'ForwardAgent=no', '-o', 'ClearAllForwardings=yes',
            '-o', 'PermitLocalCommand=no', '-o', 'ControlMaster=no',
            '-o', 'ControlPath=none', '-o', 'LogLevel=ERROR']


PREPARE_SCRIPT = r'''set -eu
umask 077
root="$HOME/domains/dombicenter.com/public_html/staging"
test -d "$root"
test "$(realpath "$root")" = "$root"
parent="$HOME/dombi-ci-staging"
if test ! -e "$parent" && test ! -L "$parent"; then mkdir -m 700 "$parent"; fi
test ! -L "$parent"
test -O "$parent"
test "$(realpath "$parent")" = "$parent"
test "$(stat -c %a "$parent")" = 700
mkdir -m 700 "$parent/$TRANSFER_ID"
'''


def child_environment():
    return {key: value for key, value in os.environ.items()
            if not key.startswith('HOSTINGER_SSH_') and key not in {
                'STAGING_DATABASE_NAME', 'SSH_AUTH_SOCK', 'SSH_ASKPASS', 'SSH_ASKPASS_REQUIRE',
                'SSHPASS', 'DISPLAY',
            }}


def run(phase):
    if phase not in {'prepare', 'upload', 'deploy'}:
        raise ValueError('Unsupported transport phase')
    host, user, password, port, fingerprint, database = connection_values(
        os.environ, require_database=phase == 'deploy',
    )
    transfer_id = os.environ.get('TRANSFER_ID', '')
    if not re.fullmatch(r'[1-9][0-9]*-[1-9][0-9]*', transfer_id):
        raise ValueError('Invalid transfer ID')
    sha = os.environ.get('RELEASE_SHA', '')
    if phase == 'deploy' and not re.fullmatch(r'[a-f0-9]{40}', sha):
        raise ValueError('Invalid release SHA')
    files = []
    if phase == 'upload':
        source = Path('transfer')
        names = {'release.tar.gz', 'release.sha256', 'release.py', 'deploy-staging.sh'}
        if source.is_symlink() or not source.is_dir() or {p.name for p in source.iterdir()} != names:
            raise ValueError('Invalid transfer inventory')
        files = sorted(source.iterdir())
        if any(p.is_symlink() or not p.is_file() or p.stat().st_nlink != 1 for p in files):
            raise ValueError('Unsafe transfer input')
    env = child_environment()
    scanned = subprocess.run(['ssh-keyscan', '-T', '10', '-p', port, '-t', 'ed25519', host],
                             capture_output=True, text=True, env=env, timeout=20, check=True)
    endpoint = endpoint_name(host, port)
    key = pinned_key(scanned.stdout, fingerprint, endpoint)
    with tempfile.TemporaryDirectory(prefix='dombi-staging-ssh-') as directory:
        known = Path(directory) / 'known_hosts'
        known.write_text(f'{endpoint} ssh-ed25519 {key}\n')
        known.chmod(0o600)
        options = ssh_options(known)
        env['SSHPASS'] = password
        if phase == 'upload':
            command = ['sshpass', '-e', 'scp', *options, '-P', port,
                       *[str(p.resolve()) for p in files], f'{user}@{host}:dombi-ci-staging/{transfer_id}/']
            subprocess.run(command, capture_output=True, text=True, env=env, timeout=300, check=True)
        else:
            script = 'TRANSFER_ID=' + shlex.quote(transfer_id) + '\n'
            if phase == 'prepare':
                script += PREPARE_SCRIPT
            else:
                script += ('set -eu\nexport STAGING_DB_DATABASE=' + shlex.quote(database) + '\n'
                           'bash "$HOME/dombi-ci-staging/$TRANSFER_ID/deploy-staging.sh" '
                           '"$HOME/dombi-ci-staging/$TRANSFER_ID" ' + shlex.quote(sha) + '\n')
            command = ['sshpass', '-e', 'ssh', *options, '-T', '-p', port, f'{user}@{host}', 'bash -se']
            subprocess.run(command, input=script, capture_output=True, text=True, env=env,
                           timeout=660 if phase == 'deploy' else 60, check=True)
    print('STAGING_TRANSPORT_' + phase.upper() + '_PASS')


def main():
    try:
        if len(sys.argv) != 2:
            raise ValueError('Exactly one phase required')
        run(sys.argv[1])
        return 0
    except Exception:
        print('STAGING_TRANSPORT_FAIL: raw diagnostics suppressed to protect secrets')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
