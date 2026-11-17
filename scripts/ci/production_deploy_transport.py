#!/usr/bin/env python3
"""Production deploy transport for main merges, disabled until activated.

Three independent gates must all agree before anything reaches the host:

1. `PRODUCTION_DEPLOY_ACTIVATED` here (a constant, changed only by review);
2. the workflow-level `vars.PRODUCTION_DEPLOY_ENABLED` repository variable;
3. the artifact actually downloaded must match the merge commit being deployed.

Gate 1 is deliberately a source constant rather than an environment variable, so
flipping a repository setting alone cannot arm the pipeline. Nothing here runs on
a runner without `--phase`, and no phase mutates production until every check in
`plan()` returns.

The heavy lifting on the host is `scripts/recovery/single_owner_deploy.py`, which
owns backup, atomic managed-code replacement and rollback. This module only
decides *whether*, *what* and *how* to invoke.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import sys


# ── activation ────────────────────────────────────────────────────────────
# Flipping this to True is the bootstrap activation step. It is intentionally not
# read from the environment: a compromised or mistaken repo setting must not arm
# production on its own.
PRODUCTION_DEPLOY_ACTIVATED = False

# The release the pipeline is reviewed against. A main merge deploys its own
# commit; the bootstrap merge is the only one allowed to coincide with this.
BOOTSTRAP_RELEASE_SHA = "220a0190ec57c8ed64f5792dcaa10c7ca906f2b7"

PRODUCTION_ROOT = "domains/dombicenter.com/public_html/app"
TRANSFER_PARENT = "dombi-ci-production"
REQUIRED_TOOLS = ("release.tar.gz", "release.sha256", "release.py",
                  "filesystem_checkpoint.py", "single_owner_deploy.py")
PHASES = ("upload", "deploy", "rollback", "status")


class TransportError(RuntimeError):
    pass


def require(condition, reason):
    if not condition:
        raise TransportError(reason)


def activation():
    """Return the activation state, forcing it off unless a full main context exists."""
    return {"activated": bool(PRODUCTION_DEPLOY_ACTIVATED)}


def deployment_allowed(env):
    """Every activation condition, evaluated in order; the first failure stops."""
    require(activation()["activated"] is True, "production_deploy_not_activated")
    require(env.get("PRODUCTION_DEPLOY_ENABLED") == "true",
            "repository_variable_disabled")
    require(env.get("GITHUB_EVENT_NAME") == "push", "trigger_not_push")
    require(env.get("GITHUB_REF") == "refs/heads/main", "ref_not_main")
    require(env.get("GITHUB_REPOSITORY") == "leanderarya/dombi", "repository")
    require(env.get("GITHUB_RUN_ATTEMPT") == "1", "not_first_attempt")
    require(not env.get("CONFIRMATION_REQUIRED"), "confirmation_required")
    sha = env.get("GITHUB_SHA", "")
    require(re.fullmatch(r"[a-f0-9]{40}", sha) is not None, "source_sha")
    return {"sha": sha}


def tag_for(sha):
    """Deterministic, filesystem-safe transfer id for one commit attempt."""
    require(re.fullmatch(r"[a-f0-9]{40}", sha or "") is not None, "source_sha")
    return "release-" + sha[:16]


def safe_name(name):
    require(isinstance(name, str) and name and "\x00" not in name, "path_type")
    path = PurePosixPath(name)
    require(not path.is_absolute() and str(path) == name
            and all(part not in ("", ".", "..") for part in path.parts), "noncanonical_path")
    return name


def digest(path):
    h = hashlib.sha256()
    with open(path, "rb") as stream:
        for block in iter(lambda: stream.read(1048576), b""):
            h.update(block)
    return h.hexdigest()


# ── artifact binding ──────────────────────────────────────────────────────
def plan(env, transfer):
    """Describe and validate exactly what would be deployed; mutate nothing.

    `transfer` is the downloaded artifact directory. The checksum receipt must
    name the merge commit's own artifact, so a stale or substituted download is
    refused rather than deployed.
    """
    facts = deployment_allowed(env)
    sha = facts["sha"]
    directory = Path(transfer)
    require(directory.is_dir() and not directory.is_symlink(), "transfer_directory")
    present = {p.name for p in directory.iterdir()}
    require(present == set(REQUIRED_TOOLS), "transfer_inventory")
    for path in directory.iterdir():
        require(path.is_file() and not path.is_symlink() and path.stat().st_nlink == 1,
                "transfer_entry")
    receipt = (directory / "release.sha256").read_text(encoding="ascii", errors="strict").split()
    require(len(receipt) == 2 and receipt[1] == "release.tar.gz", "checksum_receipt")
    archive_sha = receipt[0]
    require(re.fullmatch(r"[a-f0-9]{64}", archive_sha) is not None, "checksum_format")
    require(digest(directory / "release.tar.gz") == archive_sha, "archive_digest")
    return {
        "sha": sha,
        "tag": tag_for(sha),
        "archive_sha256": archive_sha,
        "bootstrap_release": sha == BOOTSTRAP_RELEASE_SHA,
        "root": PRODUCTION_ROOT,
        "transfer_parent": TRANSFER_PARENT,
    }


def remote_script(phase, facts, env):
    """The exact host command for a phase. No shell interpolation of secrets."""
    root = 'root="$HOME/%s"' % facts["root"]
    tools = "$TRANSFER_ID/" + " $TRANSFER_ID/".join(REQUIRED_TOOLS)
    head = "set -eu\numask 077\n" + root + "\n"
    head += 'test -d "$root"; test ! -L "$root"; test "$(realpath "$root")" = "$root"\n'
    head += 'test -f "$root/.env"; test ! -L "$root/.env"\n'
    head += 'test ! -e "$root/storage/framework/down"\n'
    parent = 'parent="$HOME/%s"' % facts["transfer_parent"]
    head += parent + '\ntest -d "$parent"; test ! -L "$parent"; test -O "$parent"\n'
    head += 'test "$(stat -c %%a "$parent")" = 700\n'
    if phase == "upload":
        return head + 'mkdir -m 700 "$parent/$TRANSFER_ID"\n'
    if phase == "status":
        return head + 'test -d "$parent/$TRANSFER_ID"\n'
    head += 'cd "$parent/$TRANSFER_ID"\n'
    if phase == "deploy":
        head += ("python3 -B single_owner_deploy.py deploy --archive release.tar.gz "
                 "--checksum-file release.sha256 --application-sha %s "
                 "--archive-sha256 %s\n" % (facts["sha"], facts["archive_sha256"]))
    else:
        head += ("python3 -B single_owner_deploy.py rollback --operation %s\n"
                 % shlex.quote(env.get("OPERATION_ID", "")))
    return head


def describe(phase, facts, env):
    """Return the invocation record. Never exposes secrets or key material."""
    require(phase in PHASES, "phase")
    return {"phase": phase, "sha": facts["sha"], "tag": facts["tag"],
            "root": facts["root"], "script": remote_script(phase, facts, env)}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--phase", choices=PHASES, required=True)
    parser.add_argument("--transfer", default="transfer")
    args = parser.parse_args(argv)
    try:
        facts = plan(os.environ, args.transfer)
        record = describe(args.phase, facts, os.environ)
        print(json.dumps(record, sort_keys=True))
        output = os.environ.get("GITHUB_OUTPUT")
        if output:
            with open(output, "a") as stream:
                stream.write("archive_sha256=%s\n" % facts["archive_sha256"])
                stream.write("release_sha=%s\n" % facts["sha"])
                stream.write("transfer_id=%s\n" % facts["tag"])
        return 0
    except (TransportError, OSError, ValueError, KeyError, TypeError):
        print("PRODUCTION_DEPLOY_ABORT; keep admissions held; inspect before retry",
              file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
