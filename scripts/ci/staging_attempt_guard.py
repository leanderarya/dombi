#!/usr/bin/env python3
"""Atomically consume and verify the persistent one-use staging release claim."""

import argparse
import json
import os
from pathlib import Path
import re
import stat
import sys


REPOSITORY = "leanderarya/dombi"
OWNER = "leanderarya"
REF = "refs/heads/develop"
WORKFLOW_REF = (
    "leanderarya/dombi/.github/workflows/deploy-staging.yml@refs/heads/develop"
)
GUARD_PREFIX = "staging-release-"
FIELDS = {
    "version",
    "repository",
    "actor",
    "ref",
    "workflow_ref",
    "workflow_sha",
    "source_sha",
    "release_sha",
    "ci_run_id",
    "artifact_id",
    "artifact_run_id",
    "archive_sha256",
    "github_run_id",
    "github_run_attempt",
    "transfer_id",
}


def _directory_flags():
    if not hasattr(os, "O_DIRECTORY") or not hasattr(os, "O_NOFOLLOW"):
        raise RuntimeError("Directory fsync and no-follow opens are required")
    return os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW


def _fsync_directory(path):
    descriptor = os.open(path, _directory_flags())
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _secure_parent(parent, create):
    home_value = os.environ.get("HOME")
    if not home_value:
        raise ValueError("HOME is required")
    home = Path(home_value).resolve(strict=True)
    expected = home / "dombi-ci-staging"
    requested = Path(parent)
    if requested.resolve(strict=False) != expected:
        raise ValueError("One-use guard parent is outside the private staging area")
    parent = expected

    if create:
        try:
            os.mkdir(parent, 0o700)
        except FileExistsError:
            pass
        else:
            _fsync_directory(home)

    info = os.lstat(parent)
    if (not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or
            stat.S_IMODE(info.st_mode) != 0o700 or parent.resolve(strict=True) != parent):
        raise ValueError("Private staging parent identity or permissions are unsafe")
    return parent


def _positive_id(value, name):
    if not isinstance(value, str) or not re.fullmatch(r"[1-9][0-9]{0,17}", value):
        raise ValueError(f"Invalid {name}")


def validate_claim(claim):
    if not isinstance(claim, dict) or set(claim) != FIELDS:
        raise ValueError("Invalid one-use claim fields")
    if (type(claim["version"]) is not int or claim["version"] != 1 or
            claim["repository"] != REPOSITORY or
            claim["actor"] != OWNER or claim["ref"] != REF or
            claim["workflow_ref"] != WORKFLOW_REF):
        raise ValueError("One-use claim repository, owner, ref, or workflow mismatch")

    for name in ("workflow_sha", "source_sha", "release_sha"):
        if not isinstance(claim[name], str) or not re.fullmatch(r"[a-f0-9]{40}", claim[name]):
            raise ValueError(f"Invalid {name}")
    if claim["workflow_sha"] != claim["source_sha"]:
        raise ValueError("Workflow and source revisions differ")
    if not isinstance(claim["archive_sha256"], str) or not re.fullmatch(
        r"[a-f0-9]{64}", claim["archive_sha256"]
    ):
        raise ValueError("Invalid archive checksum")

    for name in ("ci_run_id", "artifact_id", "artifact_run_id", "github_run_id"):
        _positive_id(claim[name], name)
    if (claim["ci_run_id"] != "44032192481" or
            claim["artifact_id"] != "14305937487" or
            claim["artifact_run_id"] != "44032192481"):
        raise ValueError("One-use claim does not identify the approved CI artifact")
    if claim["github_run_attempt"] != "1":
        raise ValueError("Only the first deployment run attempt may claim staging")
    _positive_id(claim["github_run_attempt"], "deployment attempt")
    if claim["transfer_id"] != f'{claim["github_run_id"]}-{claim["github_run_attempt"]}':
        raise ValueError("Transfer ID does not match the deployment run")
    return claim


def claim_path(parent, release_sha):
    if not isinstance(release_sha, str) or not re.fullmatch(r"[a-f0-9]{40}", release_sha):
        raise ValueError("Invalid release SHA")
    return Path(parent) / f"{GUARD_PREFIX}{release_sha}"


def claim_from_environment(env):
    claim = {
        "version": 1,
        "repository": env.get("STAGING_REPOSITORY", ""),
        "actor": env.get("STAGING_ACTOR", ""),
        "ref": env.get("STAGING_REF", ""),
        "workflow_ref": env.get("STAGING_WORKFLOW_REF", ""),
        "workflow_sha": env.get("STAGING_WORKFLOW_SHA", ""),
        "source_sha": env.get("STAGING_SOURCE_SHA", ""),
        "release_sha": env.get("RELEASE_SHA", ""),
        "ci_run_id": env.get("CI_RUN_ID", ""),
        "artifact_id": env.get("ARTIFACT_ID", ""),
        "artifact_run_id": env.get("ARTIFACT_RUN_ID", ""),
        "archive_sha256": env.get("ARCHIVE_SHA256", ""),
        "github_run_id": env.get("STAGING_RUN_ID", ""),
        "github_run_attempt": env.get("STAGING_RUN_ATTEMPT", ""),
        "transfer_id": env.get("TRANSFER_ID", ""),
    }
    return validate_claim(claim)


def create_claim(parent, claim):
    claim = validate_claim(claim)
    parent = _secure_parent(parent, create=True)
    guard = claim_path(parent, claim["release_sha"])
    parent_fd = os.open(parent, _directory_flags())
    guard_fd = None
    claim_fd = None
    try:
        parent_info = os.fstat(parent_fd)
        if (not stat.S_ISDIR(parent_info.st_mode) or parent_info.st_uid != os.getuid() or
                stat.S_IMODE(parent_info.st_mode) != 0o700):
            raise ValueError("Private staging parent changed during claim")
        try:
            os.mkdir(guard.name, 0o700, dir_fd=parent_fd)
        except FileExistsError as error:
            raise ValueError(
                "This staging release has already consumed its one-use claim"
            ) from error
        os.fsync(parent_fd)
        guard_fd = os.open(guard.name, _directory_flags(), dir_fd=parent_fd)
        guard_info = os.fstat(guard_fd)
        if (guard_info.st_uid != os.getuid() or stat.S_IMODE(guard_info.st_mode) != 0o700):
            raise ValueError("New one-use guard directory is unsafe")
        claim_fd = os.open(
            "claim.json",
            os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
            0o600,
            dir_fd=guard_fd,
        )
        payload = (json.dumps(claim, sort_keys=True, separators=(",", ":")) + "\n").encode()
        remaining = memoryview(payload)
        while remaining:
            written = os.write(claim_fd, remaining)
            if written <= 0:
                raise OSError("Short write while persisting one-use claim")
            remaining = remaining[written:]
        os.fsync(claim_fd)
        os.fchmod(claim_fd, 0o400)
        os.fsync(claim_fd)
        os.fsync(guard_fd)
        os.fchmod(guard_fd, 0o500)
        os.fsync(guard_fd)
    finally:
        if claim_fd is not None:
            os.close(claim_fd)
        if guard_fd is not None:
            os.close(guard_fd)
        os.close(parent_fd)
    return claim


def verify_claim(parent, transfer_id, workflow_sha, release_sha, mode):
    if mode not in {"deploy", "rollback"}:
        raise ValueError("Unsupported one-use claim verification mode")
    parent = _secure_parent(parent, create=False)
    guard = claim_path(parent, release_sha)
    parent_fd = os.open(parent, _directory_flags())
    guard_fd = None
    descriptor = None
    try:
        guard_fd = os.open(guard.name, _directory_flags(), dir_fd=parent_fd)
        guard_info = os.fstat(guard_fd)
        if (not stat.S_ISDIR(guard_info.st_mode) or guard_info.st_uid != os.getuid() or
                stat.S_IMODE(guard_info.st_mode) != 0o500):
            raise ValueError("Persistent one-use guard is missing or unsafe")
        descriptor = os.open("claim.json", os.O_RDONLY | os.O_NOFOLLOW, dir_fd=guard_fd)
        opened = os.fstat(descriptor)
        if (not stat.S_ISREG(opened.st_mode) or opened.st_uid != os.getuid() or
                opened.st_nlink != 1 or stat.S_IMODE(opened.st_mode) != 0o400 or
                opened.st_size > 16384):
            raise ValueError("Persistent one-use claim receipt is missing or unsafe")
        with os.fdopen(os.dup(descriptor), "r", encoding="utf-8") as source:
            claim = json.load(source)
    finally:
        if descriptor is not None:
            os.close(descriptor)
        if guard_fd is not None:
            os.close(guard_fd)
        os.close(parent_fd)

    validate_claim(claim)
    if (claim["release_sha"] != release_sha or claim["transfer_id"] != transfer_id or
            claim["workflow_sha"] != workflow_sha):
        raise ValueError("Persistent claim is bound to a different deployment attempt")
    return claim


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    claim_parser = commands.add_parser("claim")
    claim_parser.add_argument("--parent", required=True)
    claim_parser.add_argument("--claim-json", required=True)
    verify_parser = commands.add_parser("verify")
    verify_parser.add_argument("--parent", required=True)
    verify_parser.add_argument("--transfer-id", required=True)
    verify_parser.add_argument("--workflow-sha", required=True)
    verify_parser.add_argument("--release-sha", required=True)
    verify_parser.add_argument("--mode", choices=("deploy", "rollback"), required=True)
    args = parser.parse_args(argv)

    try:
        if args.command == "claim":
            claim = json.loads(args.claim_json)
            create_claim(args.parent, claim)
            print("STAGING_ATTEMPT_GUARD_CLAIM_PASS")
        else:
            verify_claim(
                args.parent, args.transfer_id, args.workflow_sha, args.release_sha, args.mode,
            )
            print(f"STAGING_ATTEMPT_GUARD_{args.mode.upper()}_PASS")
        return 0
    except Exception:
        print("STAGING_ATTEMPT_GUARD_FAIL: persistent one-use state rejected", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
