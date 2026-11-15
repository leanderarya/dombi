#!/usr/bin/env python3
"""Fixture-only managed-code publisher behind a gated, unprovisioned production door.

The production door (`publish_artifact_production` / `--production`) still needs an
operator-held signature key, a detached approval signature, a verified candidate
artifact, a verified checkpoint and the shared publisher lock. None of those are
provisioned here, so this repository still cannot publish code anywhere.
"""

import argparse
import datetime as dt
import hashlib
import hmac
import importlib.util
import json
import os
from contextlib import contextmanager
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import sys
import tarfile


VARIANT = "dombi-code-publisher-v1"
OPERATION = "filesystem-code-publication"
PUBLICATION_PATTERN = r"publication-[0-9a-f]{64}"
PUBLICATION_ENTRIES = ("authorization.json", "pre-state.json", "journal.jsonl", "outcome.json")
PAYLOAD_PATTERN = r"payload-[0-9]+"
SUCCESS = "CODE_PUBLISH_COMPLETE_KEEP_HELD"
DISABLED = ("PUBLISHER_DISABLED; fixture publication only; production needs --production, a "
            "provisioned approval key and every fail-closed prerequisite; keep doors held")
PRODUCTION_ABORT = "PRODUCTION_ABORT; keep doors held; no automatic cleanup or reopening"
SIGNATURE_CONTEXT = b"dombi-code-publication-approval-v1\x00"
SIGNATURE_PATTERN = r"[0-9a-f]{64}"
KEY_MINIMUM_BYTES = 32
KEY_MAXIMUM_BYTES = 4096


def checkpoint_module():
    """Reuse the sibling checkpoint module so error types and gates stay identical."""
    name = "filesystem_checkpoint"
    source = Path(__file__).with_name("filesystem_checkpoint.py").resolve()
    module = sys.modules.get(name)
    if module is not None and getattr(module, "VARIANT", None) == "dombi-filesystem-checkpoint-v1":
        if Path(module.__file__).resolve() != source:
            raise ImportError("foreign_checkpoint_module")
        return module
    spec = importlib.util.spec_from_file_location(name, source)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


fs = checkpoint_module()


def publisher_digest():
    return fs.file_digest(Path(__file__).absolute())


def require_fixture_policy(policy):
    """The fixed production identity is refused even from a direct Python call.

    There is no flag, environment variable or argument that lifts this refusal: a
    production publisher needs its own separately authorized implementation.
    """
    production = fs.PRODUCTION
    root, private = Path(policy.root), Path(policy.private)
    fs.require(policy.account != production.account
               and root != production.root and not root.is_relative_to(production.root)
               and private != production.private
               and not private.is_relative_to(production.private)
               and not production.private.is_relative_to(private),
               "production_execution_disabled")


PRODUCTION_REALM = "production"
FIXTURE_REALM = "fixture"
REALMS = (FIXTURE_REALM, PRODUCTION_REALM)

# ── Volatile runtime paths ────────────────────────────────────────────────
#
# A production filesystem is never perfectly still: the framework appends to its
# logs while a publication runs, and the checkpoint pins a digest of the *whole*
# root inventory. Without an explicit allowance, a single appended log line aborts
# the run after some files have already been replaced.
#
# The allowance is deliberately narrow and structural:
#
#   * only a DIRECT child file of one of the exact directories below;
#   * only `protected` entries (so it can never excuse a managed-code change);
#   * only a regular file that is still the same inode, owner and mode;
#   * only append-style content/mtime/size drift is tolerated.
#
# Everything else still aborts: additions, removals, type changes, symlink
# substitution, ownership/mode changes, and any drift outside these directories.
# `storage/app` (uploads, backups, delivery proofs) and `storage/framework/cache`,
# `sessions` and `views` are intentionally NOT listed: they hold business or
# generated state whose change must keep failing closed.
VOLATILE_LOG_PREFIX = "storage/logs/"
VOLATILE_POLICY_SCHEMA = "dombi-volatile-runtime-v1"
VOLATILE_POLICY_FIELDS = ("schema", "allowed_prefixes", "mode")

# The only drift an allowed volatile entry may exhibit: content hash, size and
# mtime. Structure (type/inode/owner/mode/class/device) must be identical.
VOLATILE_DRIFT_FIELDS = ("size", "sha256", "mtime_ns")


def volatile_policy():
    """The single allowlist the approval must echo exactly."""
    return {
        "schema": VOLATILE_POLICY_SCHEMA,
        "allowed_prefixes": [VOLATILE_LOG_PREFIX],
        "mode": "append-only",
    }


def require_volatile_policy(value):
    """Bound to the approval: a missing, widened or narrowed policy is rejected.

    Equality is exact, so an approval cannot quietly add `storage/app/` or drop the
    restriction; the publisher only ever honours the one reviewed policy.
    """
    fs.require(value == volatile_policy(), "volatile_policy_mismatch")


def volatile_path(name):
    """True only for a direct child file of an allowed volatile directory."""
    for prefix in volatile_policy()["allowed_prefixes"]:
        if name.startswith(prefix):
            leaf = name[len(prefix):]
            return bool(leaf) and "/" not in leaf
    return False


def volatile_structure_unchanged(baseline, entry):
    """True only if every non-content field still matches the baseline entry."""
    if baseline is None or entry.get("class") != "protected" or baseline.get("class") != "protected":
        return False
    if any(entry.get(k) != baseline.get(k) for k in entry.keys()
           if k not in VOLATILE_DRIFT_FIELDS):
        return False
    return all(k in entry for k in VOLATILE_DRIFT_FIELDS if k in baseline)


def append_only_prefix_intact(policy, name, baseline):
    """True only when the baseline bytes are still an exact prefix of the file.

    "append-only" cannot be proven from metadata: a same-size overwrite or a
    truncate-and-regrow keeps size and structure identical. The baseline entry
    carries the SHA-256 of the whole file as it was, so re-reading exactly
    `baseline["size"]` bytes and hashing them proves the old content survived
    with only appends after it.

    Returns False for a truncated file or a prefix mismatch (the caller then
    declines to normalise, so the drift check aborts). Raises for unsafe
    conditions — unreadable file, symlink, or a change observed while reading —
    because those must never be silently tolerated.
    """
    fs.require(baseline.get("type") == "file", "volatile_baseline_type")
    size, digest = baseline.get("size"), baseline.get("sha256")
    fs.require(fs.integer(size) and size >= 0, "volatile_baseline_size")
    fs.require(isinstance(digest, str) and re.fullmatch(fs.SHA_PATTERN, digest) is not None,
               "volatile_baseline_hash")
    with fs.absolute_parent(policy.root / name) as (parent, leaf):
        try:
            fd = os.open(leaf, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
        except OSError as error:
            # ELOOP/EISDIR/ENOENT here means the entry was substituted or removed
            # between inventory and this read; that is drift, never tolerance.
            raise fs.CheckpointError("volatile_open_failed") from error
        try:
            opened = os.fstat(fd)
            fs.require(stat.S_ISREG(opened.st_mode) and opened.st_nlink == 1,
                       "volatile_not_regular")
            if opened.st_size < size:
                return False
            h, remaining = hashlib.sha256(), size
            while remaining > 0:
                block = os.read(fd, min(1048576, remaining))
                if not block:
                    return False
                h.update(block)
                remaining -= len(block)
            # A concurrent append or rewrite during the read invalidates the
            # comparison; refuse rather than reason about a torn snapshot.
            fs.require(fs.stat_identity(opened) == fs.stat_identity(os.fstat(fd)),
                       "volatile_read_drift")
            return h.hexdigest() == digest
        finally:
            os.close(fd)


def normalize_volatile(policy, before, after):
    """Drop tolerated drift from allowed volatile entries.

    Returns a copy of `after` in which every allowed volatile entry that is still the
    same structural file *and* whose baseline bytes survive as an exact prefix has
    its content-bearing fields replaced by the baseline's. Anything else is left
    untouched so the existing equality check catches it.
    """
    result = dict(after)
    for name, entry in after.items():
        baseline = before.get(name)
        if not volatile_path(name) or not volatile_structure_unchanged(baseline, entry):
            continue
        if not append_only_prefix_intact(policy, name, baseline):
            continue
        result[name] = dict(entry, **{k: baseline[k] for k in VOLATILE_DRIFT_FIELDS
                                      if k in baseline})
    return result


def inventory_matches(policy, boundaries, before, expected=None):
    """Full-inventory equality that tolerates only the approved volatile drift.

    `expected` defaults to `before`, so the common call is "has anything changed?".
    """
    baseline = before if expected is None else expected
    observed = fs.inventory(policy, boundaries)
    return normalize_volatile(policy, baseline, observed) == baseline, observed


def require_no_drift(policy, boundaries, before, reason):
    """Fail closed unless the tree still matches the baseline modulo volatile drift."""
    matched, _ = inventory_matches(policy, boundaries, before)
    fs.require(matched, reason)


def require_production_policy(policy):
    """The production realm needs a self-consistent host/account/root policy.

    This is the mirror of `require_fixture_policy()`: it does not exclude the pinned
    identity, it validates that the supplied policy really describes the account,
    root, device and private directory the caller claims. It is never reachable from
    `main()` with an operator-supplied path; `main()` always passes `fs.PRODUCTION`.
    """
    fs.require(isinstance(policy, fs.Policy), "policy_type")
    try:
        fs.check_policy(policy)
    except OSError as error:
        raise fs.CheckpointError("production_policy_identity") from error


def enforce_realm(policy, realm):
    """Apply exactly one realm guard from a closed set, so neither realm can borrow the other.

    The realm is a constant, never a callback: a caller cannot inject a no-op guard to
    skip the fixture refusal, and cannot reach the production branch under the
    fixture name.
    """
    fs.require(realm in REALMS, "publisher_realm")
    if realm == PRODUCTION_REALM:
        require_production_policy(policy)
    else:
        require_fixture_policy(policy)


def require_publication_lock(policy):
    """The shared lock must already exist as a private single-link regular file.

    The production path never creates the lock: provisioning it is a separate,
    externally authorized host action.
    """
    try:
        with fs.regular_file(Path(policy.lock), private=True):
            pass
    except FileNotFoundError:
        raise fs.CheckpointError("publisher_lock_missing") from None


def approval_key(key_path, policy):
    """Read the operator-held symmetric approval key; it is never logged or returned twice.

    The key is a local operator secret: 32..4096 raw bytes in a `0600` single-link
    regular file owned by the publisher account, outside the application root and
    outside the private state directory that also holds approvals.
    """
    key_path = Path(key_path)
    fs.require(key_path.is_absolute(), "approval_key_path")
    fs.require(not key_path.is_relative_to(policy.root), "approval_key_inside_root")
    fs.require(not key_path.is_relative_to(policy.private), "approval_key_private_boundary")
    try:
        with fs.regular_file(key_path, private=True) as (stream, opened):
            fs.require(KEY_MINIMUM_BYTES <= opened.st_size <= KEY_MAXIMUM_BYTES,
                       "approval_key_size")
            key = stream.read(KEY_MAXIMUM_BYTES + 1)
            fs.require(len(key) == opened.st_size, "approval_key_drift")
    except FileNotFoundError:
        raise fs.CheckpointError("approval_key_missing") from None
    return key


def approval_signature(approval_raw, key):
    """Symmetric HMAC-SHA256 over the exact approval bytes, domain-separated."""
    return hmac.new(key, SIGNATURE_CONTEXT + approval_raw, hashlib.sha256).hexdigest()


def signed_approval_digest(policy, approval_path, signature_path, key):
    """Verify a detached signature and return the digest of the signed approval bytes.

    This is an operator-held shared key, not a third-party identity: a valid
    signature proves the signer possessed the key file, nothing about who they are.
    """
    approval_path, signature_path = Path(approval_path), Path(signature_path)
    fs.private_directory(approval_path.parent)
    fs.private_directory(signature_path.parent)
    fs.require(approval_path.is_relative_to(policy.private), "approval_boundary")
    fs.require(signature_path.is_relative_to(policy.private), "approval_signature_boundary")
    fs.require(approval_path != signature_path, "approval_signature_boundary")
    try:
        with fs.regular_file(signature_path, private=True) as (stream, opened):
            fs.require(opened.st_size <= 4096, "approval_signature_size")
            raw = stream.read(4097)
    except FileNotFoundError:
        raise fs.CheckpointError("approval_signature_missing") from None
    try:
        token = raw.decode("ascii", "strict").strip()
    except UnicodeDecodeError as error:
        raise fs.CheckpointError("approval_signature") from error
    fs.require(re.fullmatch(SIGNATURE_PATTERN, token) is not None, "approval_signature")
    try:
        _, digest, approval_raw = fs.json_snapshot(approval_path)
    except FileNotFoundError:
        raise fs.CheckpointError("approval_missing") from None
    fs.require(hmac.compare_digest(approval_signature(approval_raw, key), token),
               "approval_signature_mismatch")
    return digest


def publication_plan(manifest, observed):
    """Return the managed files to publish, or raise instead of guessing.

    The target tree must already hold the directory structure of every managed
    entry and nothing extra: unlisted, missing-parent, retyped or retargeted
    managed entries block publication. Only a missing managed regular file can be
    republished, and only while its parent directories are intact; a missing
    managed directory or symlink is never recreated and blocks publication.
    Nothing is deleted, no directory is created, and no protected or
    shared-parent entry is published. A managed file that already matches its
    checkpoint metadata is left alone; every managed directory has its metadata
    restored afterwards.
    """
    baseline = {n: e for n, e in manifest["inventory"].items() if e["class"] == "managed"}
    current = {n: e for n, e in observed.items() if e["class"] == "managed"}
    fs.require(not any(name not in baseline for name in current), "unexpected_target_inventory")
    for name, desired in baseline.items():
        entry = current.get(name)
        if entry is None:
            fs.require(desired["type"] == "file", "missing_target_entry")
            fs.require(ancestors_present(name, observed), "missing_target_parent")
            continue
        fs.require(entry["type"] == desired["type"], "target_type_conflict")
        if desired["type"] == "symlink":
            fs.require(entry["target"] == desired["target"]
                       and entry["resolved_boundary"] == desired["resolved_boundary"],
                       "symlink_target_changed")
            fs.require(fs.managed_metadata({name: entry})
                       == fs.managed_metadata({name: desired}),
                       "managed_symlink_drift")
    return sorted(
        (n for n, e in baseline.items()
         if e["type"] == "file" and (
             n not in current
             or fs.managed_metadata({n: current[n]}) != fs.managed_metadata({n: e}))),
        key=lambda n: (n.count("/"), n))


def ancestors_present(name, observed):
    """True only when every ancestor of a missing managed entry is a live directory."""
    parent = str(PurePosixPath(name).parent)
    while parent not in (".", ""):
        if observed.get(parent, {}).get("type") != "directory":
            return False
        parent = str(PurePosixPath(parent).parent)
    return True


def prior_publications(directory):
    """Digest every prior publication directory; unknown or incomplete ones block."""
    result = {}
    for operation in sorted(directory.glob("publication-*")):
        fs.require(re.fullmatch(PUBLICATION_PATTERN, operation.name) is not None,
                   "unknown_publication")
        fs.private_directory(operation)
        entries = {}
        for path in sorted(operation.iterdir()):
            fs.require(path.name in PUBLICATION_ENTRIES
                       or re.fullmatch(PAYLOAD_PATTERN, path.name) is not None,
                       "unknown_publication_entry")
            s = path.lstat()
            fs.require(s.st_uid == os.getuid() and s.st_nlink == 1
                       and stat.S_ISREG(s.st_mode), "publication_identity")
            entries[path.name] = {"sha256": fs.file_digest(path), "inode": s.st_ino,
                                  "device": s.st_dev, "mode": stat.S_IMODE(s.st_mode)}
        fs.require("authorization.json" in entries and "journal.jsonl" in entries,
                   "incomplete_publication_identity")
        fs.require(entries["authorization.json"]["sha256"]
                   == operation.name.removeprefix("publication-"),
                   "publication_authorization_identity")
        result[operation.name] = fs.object_digest(entries)
    return result


def prior_operation_lineage(directory):
    """Acknowledge both lineages, and refuse to publish onto an unfinished recovery."""
    for operation in sorted(directory.glob("recovery-*")):
        fs.require((operation / "outcome.json").exists(), "incomplete_prior_recovery")
    return {"publication": prior_publications(directory),
            "recovery": fs.prior_operations(directory)}


@contextmanager
def staged_file(source, desired):
    """Pin one staged payload to the manifest metadata without following links."""
    with fs.absolute_parent(source) as (directory, leaf):
        fd = os.open(leaf, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory)
        try:
            opened = os.fstat(fd)
            fs.require(stat.S_ISREG(opened.st_mode) and opened.st_nlink == 1,
                       "staged_not_regular")
            os.fchown(fd, desired["uid"], desired["gid"])
            os.fchmod(fd, desired["mode"])
            os.utime(fd, ns=(desired["mtime_ns"], desired["mtime_ns"]))
            os.fsync(fd)
            digest, size = hashlib.sha256(), 0
            for block in iter(lambda: os.read(fd, 1048576), b""):
                digest.update(block)
                size += len(block)
            pinned = os.fstat(fd)
            fs.require(size == desired["size"] and digest.hexdigest() == desired["sha256"]
                       and (pinned.st_size, pinned.st_mtime_ns, stat.S_IMODE(pinned.st_mode),
                            pinned.st_uid, pinned.st_gid)
                       == (size, desired["mtime_ns"], desired["mode"],
                           desired["uid"], desired["gid"]),
                       "staging_drift")
            yield directory, leaf, pinned
        finally:
            os.close(fd)


def staged_payload(source, desired):
    """Verify a staged payload's bytes without publishing or touching the target."""
    with fs.absolute_parent(source) as (directory, leaf):
        fd = os.open(leaf, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory)
        try:
            opened = os.fstat(fd)
            fs.require(stat.S_ISREG(opened.st_mode) and opened.st_nlink == 1,
                       "staged_not_regular")
            digest, size = hashlib.sha256(), 0
            for block in iter(lambda: os.read(fd, 1048576), b""):
                digest.update(block)
                size += len(block)
            fs.require(size == desired["size"] and digest.hexdigest() == desired["sha256"],
                       "staging_drift")
        finally:
            os.close(fd)


def publication_preflight(policy, manifest, before, plan):
    """Complete every inventory and type check before the first file replacement."""
    require_fixture_policy(policy)
    desired = {n: e for n, e in manifest["inventory"].items() if e["class"] == "managed"}
    for name in plan:
        fs.expected_target(policy, name, before.get(name))
    for name, e in desired.items():
        if e["type"] == "directory":
            fs.expected_target(policy, name, before[name])


def verify_staged(staged, manifest, plan):
    """Verify every payload that is about to be published, before the first replace."""
    for name in plan:
        staged_payload(staged[name], manifest["inventory"][name])


def publish_file(policy, name, desired, before, staged, operation, directories):
    require_fixture_policy(policy)
    fs.journal(operation, {"action": "publish-intent", "path": name, "desired": desired})
    with staged_file(staged, desired) as (source_parent, source, pinned):
        fs.journal(operation, {"action": "publish-staged", "path": name,
                               "staged": {"device": pinned.st_dev, "inode": pinned.st_ino,
                                          "size": pinned.st_size}})
        observed = before.get(name)
        fs.expected_target(policy, name, observed)
        with fs.parent_fd(policy, name, directories) as (target_parent, target):
            fs.target_at(target_parent, target, observed)
            os.replace(source, target, src_dir_fd=source_parent, dst_dir_fd=target_parent)
            os.fsync(target_parent)
    fs.fsync_directory(operation)
    fs.journal(operation, {"action": "published", "path": name})


def apply_publication(policy, manifest, before, staged, operation, plan):
    require_fixture_policy(policy)
    publication_preflight(policy, manifest, before, plan)
    verify_staged(staged, manifest, plan)
    desired = {n: e for n, e in manifest["inventory"].items() if e["class"] == "managed"}
    directories = {n: (e["device"], e["inode"]) for n, e in before.items()
                   if e["type"] == "directory"}
    for name in plan:
        publish_file(policy, name, desired[name], before, staged[name],
                     operation, directories)
    for name, e in sorted(desired.items(), key=lambda item: (item[0].count("/"), item[0]),
                          reverse=True):
        if e["type"] != "directory":
            continue
        fs.expected_target(policy, name, before[name])
        with fs.parent_fd(policy, name, directories) as (parent, leaf):
            child = os.open(leaf, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
            try:
                os.fchmod(child, e["mode"])
                os.utime(child, ns=(e["mtime_ns"], e["mtime_ns"]))
                os.fsync(child)
            finally:
                os.close(child)


def publish(policy, checkpoint_id, manifest_sha256, approval_path):
    """Publish checkpoint-managed code into a fixture tree under the shared lock."""
    require_fixture_policy(policy)
    approval_path = Path(approval_path)
    fs.private_directory(approval_path.parent)
    fs.require(approval_path.is_relative_to(policy.private), "approval_boundary")
    directory, manifest = fs.load_checkpoint(policy, checkpoint_id, manifest_sha256)
    before = fs.inventory(policy, manifest["boundaries"])
    baseline_shared = {n: e for n, e in fs.stable_protected(manifest["inventory"]).items()
                       if manifest["inventory"][n]["class"] == "shared-parent"}
    fs.require(all(fs.stable_protected(before).get(n) == e for n, e in baseline_shared.items()),
               "shared_parent_checkpoint_drift")
    fs.require(not any(n in before and before[n]["class"] != "managed"
                       for n, e in manifest["inventory"].items() if e["class"] == "managed"),
               "managed_protected_overlap")
    plan = publication_plan(manifest, before)
    approved, approval_sha, approval_raw = fs.authorize(
        policy, approval_path, OPERATION, checkpoint_id, before,
        manifest_sha256, return_snapshot=True)
    fs.require(approved.get("boundaries") == manifest["boundaries"], "approval_boundaries")
    fs.require(approved.get("manifest_sha256") == manifest_sha256, "approval_manifest")
    fs.require(approved.get("publisher_sha256") == publisher_digest(), "approval_publisher")
    previous = prior_operation_lineage(directory)
    fs.require(approved.get("prior_operations") == previous, "unapproved_prior_publications")
    operation = directory / ("publication-" + approval_sha)
    with fs.publisher_lock(policy):
        fs.require(fs.inventory(policy, manifest["boundaries"]) == before, "publication_drift")
        fs.require(prior_operation_lineage(directory) == previous, "publication_lineage_drift")
        fs.require(shutil.disk_usage(policy.private).free >
                   2 * sum(e.get("size", 0)
                            for e in fs.payload_entries(manifest["inventory"]).values())
                   + 4 * len(fs.encoded(before)) + 1048576, "insufficient_space")
        publication_preflight(policy, manifest, before, plan)
        try:
            operation.mkdir(mode=0o700)
        except FileExistsError:
            raise fs.CheckpointError("publication_approval_used") from None
        fs.fsync_directory(directory)
        fs.write_bytes(operation / "authorization.json", approval_raw)
        fs.write_json(operation / "pre-state.json", before)
        fs.write_json(operation / "journal.jsonl", {"status": "AUTHORIZED_NOT_COMPLETED"})
        staged = fs.validate_archive(directory / "code.tar.gz", manifest, operation)
        fs.require(fs.load_checkpoint(policy, checkpoint_id, manifest_sha256)[1] == manifest,
                   "checkpoint_drift")
        fs.require(fs.inventory(policy, manifest["boundaries"]) == before, "publication_drift")
        fs.require(fs.authorize(policy, approval_path, OPERATION, checkpoint_id, before,
                                expected_digest=approval_sha) == approved, "approval_drift")
        verify_staged(staged, manifest, plan)
        try:
            apply_publication(policy, manifest, before, staged, operation, plan)
            fs.restored_matches(policy, manifest, before)
            fs.write_json(operation / "outcome.json", {"status": SUCCESS})
        except BaseException:
            fs.journal(operation, {"status": "FAILED_OR_INTERRUPTED_KEEP_HELD"})
            raise
    return {"status": SUCCESS, "checkpoint_id": checkpoint_id,
            "manifest_sha256": manifest_sha256, "published": plan}


def release_module():
    """Load the existing release-format validator so the artifact contract is reused."""
    name = "dombi_release"
    source = Path(__file__).parents[1] / "ci" / "release.py"
    module = sys.modules.get(name)
    if module is not None:
        return module
    spec = importlib.util.spec_from_file_location(name, source)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


release = release_module()


def checksum_token(checksum_path):
    """Read the pinned release checksum receipt; return its digest token."""
    with fs.regular_file(Path(checksum_path), private=True) as (stream, opened):
        fs.require(opened.st_size <= 4096, "artifact_checksum_size")
        raw = stream.read(4097)
    fields = raw.decode("ascii", "strict").split()
    fs.require(len(fields) == 2 and fields[1] == "release.tar.gz",
               "artifact_checksum_receipt")
    return fields[0]


def artifact_files(archive_path, application_sha, archive_sha256):
    """Validate a candidate release artifact and return its manifest and payload size.

    Reuses the release format's own verifier (schema, allowed paths, member modes,
    inventory equality, per-member digests) plus a digest re-check for substitution.
    """
    fs.require(isinstance(archive_path, Path), "artifact_path")
    fs.require(re.fullmatch(r"[a-f0-9]{40}", application_sha or "") is not None,
               "artifact_application_sha")
    fs.require(re.fullmatch(r"[a-f0-9]{64}", archive_sha256 or "") is not None,
               "artifact_archive_sha256")
    fs.require(fs.file_digest(archive_path, private=True) == archive_sha256,
               "artifact_pin")
    try:
        manifest = release.verify(str(archive_path), application_sha, archive_sha256)
    except (ValueError, KeyError, TypeError, OSError, EOFError) as error:
        raise fs.CheckpointError("artifact_invalid") from error
    fs.require(fs.file_digest(archive_path, private=True) == archive_sha256,
               "artifact_pin_drift")
    files = manifest["files"]
    fs.require(isinstance(files, dict) and files, "artifact_empty")
    payload = 0
    for name in files:
        fs.relative(name)
    with fs.regular_file(archive_path, private=True) as (source, _):
        with tarfile.open(fileobj=source, mode="r:gz") as archive:
            for member in archive:
                if member.name == "release.json":
                    continue
                fs.require(member.isfile() and member.size >= 0, "artifact_member")
                payload += member.size
    return manifest, payload


def artifact_plan(manifest, observed, files):
    """Plan managed-file additions, replacements and removals against a checkpoint.

    The checkpoint defines the managed scope and the pre-release baseline; the
    artifact defines the candidate file set. Anything the artifact cannot express
    (directories, symlinks) must already exist and stay unchanged.
    """
    boundaries = manifest["boundaries"]
    baseline = {n: e for n, e in manifest["inventory"].items() if e["class"] == "managed"}
    baseline_files = {n for n, e in baseline.items() if e["type"] == "file"}
    for name in files:
        fs.relative(name)
        fs.require(any(fs.beneath(name, scope) for scope in boundaries["managed_scopes"]),
                   "artifact_path_outside_managed_scope")
        fs.require(not fs.protected(name, boundaries), "artifact_path_protected")
        fs.require(fs.classification(name, boundaries, False) == "managed",
                   "artifact_path_not_managed")
        entry = observed.get(name)
        if entry is None:
            fs.require(ancestors_present(name, observed), "missing_target_parent")
        else:
            fs.require(entry["type"] == "file", "target_type_conflict")

    current = {n: e for n, e in observed.items()
               if e["class"] == "managed" and e["type"] == "file"}
    removals = {}
    for name, entry in current.items():
        if name in files:
            continue
        fs.require(name in baseline_files, "unbaselined_target_removal")
        fs.require(not fs.protected(name, boundaries), "removal_of_protected")
        fs.require(not any(other != name and fs.beneath(other, name)
                           and observed[other]["class"] != "managed" for other in observed),
                   "removal_ancestor_of_protected")
        removals[name] = {"observed_entry_sha256": fs.object_digest(entry)}

    additions, replacements, unchanged = [], [], []
    for name in sorted(files):
        entry = current.get(name)
        if entry is None:
            additions.append(name)
        elif (entry["sha256"] != files[name] or entry["mode"] != 0o644
              or entry["nlink"] != 1):
            replacements.append(name)
        else:
            unchanged.append(name)
    return {"additions": additions, "replacements": replacements,
            "removals": removals, "unchanged": unchanged}


def plan_digest(plan):
    return fs.object_digest({"additions": plan["additions"],
                             "replacements": plan["replacements"],
                             "removals": plan["removals"]})


def stage_artifact(archive_path, files, operation):
    """Extract verified members into the private operation directory only."""
    staged = {}
    with fs.regular_file(archive_path, private=True) as (source, _):
        with tarfile.open(fileobj=source, mode="r:gz") as archive:
            for member in archive:
                name = fs.relative(member.name)
                if name == "release.json":
                    continue
                fs.require(name in files and name not in staged, "artifact_member")
                destination = operation / ("payload-" + str(len(staged)))
                fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL
                             | os.O_NOFOLLOW, 0o600)
                digest = hashlib.sha256()
                with os.fdopen(fd, "wb") as output:
                    with archive.extractfile(member) as data:
                        for block in iter(lambda: data.read(1048576), b""):
                            digest.update(block)
                            output.write(block)
                    output.flush()
                    os.fsync(output.fileno())
                fs.require(digest.hexdigest() == files[name], "artifact_content")
                staged[name] = destination
    fs.require(set(staged) == set(files), "artifact_completeness")
    fs.fsync_directory(operation)
    return staged


def artifact_preflight(policy, manifest, before, plan, files, staged,
                       realm=FIXTURE_REALM):
    """Complete every inventory, type and staging check before the first mutation."""
    enforce_realm(policy, realm)
    for name in plan["replacements"] + plan["additions"]:
        fs.expected_target(policy, name, before.get(name))
        staged_payload(staged[name], {"size": staged[name].stat().st_size,
                                      "sha256": files[name]})
    for name in plan["additions"]:
        fs.require(ancestors_present(name, before), "missing_target_parent")
    for name in plan["removals"]:
        fs.expected_target(policy, name, before[name])


def publish_artifact_file(policy, name, sha256, staged, before, operation, directories,
                          realm=FIXTURE_REALM):
    enforce_realm(policy, realm)
    observed = before.get(name)
    fs.journal(operation, {"action": "publish-intent", "path": name, "sha256": sha256,
                           "mode": 0o644, "observed": observed})
    fs.require(fs.file_digest(staged) == sha256, "staging_drift")
    with fs.absolute_parent(staged) as (source_parent, source):
        fd = os.open(source, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=source_parent)
        try:
            fs.require(stat.S_ISREG(os.fstat(fd).st_mode), "staged_not_regular")
            os.fchown(fd, os.getuid(), os.getgid())
            os.fchmod(fd, 0o644)
            os.fsync(fd)
            pinned = os.fstat(fd)
            fs.journal(operation, {"action": "publish-staged", "path": name,
                                   "staged": {"device": pinned.st_dev,
                                              "inode": pinned.st_ino,
                                              "size": pinned.st_size}})
            fs.expected_target(policy, name, observed)
            with fs.parent_fd(policy, name, directories) as (target_parent, target):
                fs.target_at(target_parent, target, observed)
                os.replace(source, target, src_dir_fd=source_parent,
                           dst_dir_fd=target_parent)
                os.fsync(target_parent)
        finally:
            os.close(fd)
    fs.fsync_directory(operation)
    fs.journal(operation, {"action": "published", "path": name})


def remove_artifact_file(policy, name, observed, operation, directories,
                         realm=FIXTURE_REALM):
    enforce_realm(policy, realm)
    fs.journal(operation, {"action": "remove-intent", "path": name, "expected": observed})
    fs.expected_target(policy, name, observed)
    with fs.parent_fd(policy, name, directories) as (parent, leaf):
        fs.target_at(parent, leaf, observed)
        os.unlink(leaf, dir_fd=parent)
        os.fsync(parent)
    fs.journal(operation, {"action": "removed", "path": name})


def artifact_matches(policy, manifest, before, files):
    """Verify the published tree equals the artifact for managed files, nothing else."""
    after = fs.inventory(policy, manifest["boundaries"])
    managed = {n: e for n, e in after.items() if e["class"] == "managed"}
    present = {n for n, e in managed.items() if e["type"] == "file"}
    fs.require(present == set(files), "artifact_inventory_mismatch")
    for name, entry in managed.items():
        if entry["type"] != "file":
            continue
        fs.require(entry["sha256"] == files[name] and entry["mode"] == 0o644
                   and entry["nlink"] == 1, "artifact_metadata_mismatch")
    before_links = {n: fs.managed_metadata({n: e}) for n, e in before.items()
                    if e["class"] == "managed" and e["type"] == "symlink"}
    after_links = {n: fs.managed_metadata({n: e}) for n, e in managed.items()
                   if e["type"] == "symlink"}
    fs.require(before_links == after_links, "managed_symlink_changed")
    before_dirs = {n for n, e in before.items() if e["class"] == "managed"
                   and e["type"] == "directory"}
    after_dirs = {n for n, e in managed.items() if e["type"] == "directory"}
    fs.require(before_dirs == after_dirs, "managed_directory_changed")
    # Protected state must still match, modulo the approved volatile log drift.
    # `normalize_volatile` only rewrites allowed volatile entries whose structure
    # is unchanged *and* whose baseline bytes survive as an exact prefix, so a
    # symlink swap, inode/ownership/mode change, truncation or same-size overwrite
    # all still fail here.
    fs.require(fs.stable_protected(normalize_volatile(policy, before, after))
               == fs.stable_protected(before), "protected_state_changed")


def publish_artifact(policy, checkpoint_id, manifest_sha256, approval_path,
                     archive_path, checksum_path):
    """Publish a verified candidate release artifact onto a checkpointed fixture tree."""
    return artifact_publication(
        policy, checkpoint_id, manifest_sha256, approval_path, archive_path,
        checksum_path, realm=FIXTURE_REALM)


def artifact_publication(policy, checkpoint_id, manifest_sha256, approval_path,
                         archive_path, checksum_path, realm, authenticate=None,
                         checkpoint_check=None):
    """The shared artifact publication body; the realm and extra proof are injected.

    `realm` selects exactly one identity guard (see `enforce_realm`), `authenticate`
    is the optional extra approval proof a realm requires, and `checkpoint_check` is
    an optional extra checkpoint requirement. Only one implementation of the apply
    sequence exists, so the fixture and production realms cannot diverge in what they
    validate or mutate; they differ only in who may run them and what extra proof is
    demanded.
    """
    enforce_realm(policy, realm)
    approval_path, archive_path = Path(approval_path), Path(archive_path)
    fs.private_directory(approval_path.parent)
    fs.private_directory(archive_path.parent)
    fs.require(approval_path.is_relative_to(policy.private), "approval_boundary")
    fs.require(archive_path.is_relative_to(policy.private), "artifact_boundary")
    directory, manifest = fs.load_checkpoint(policy, checkpoint_id, manifest_sha256)
    if checkpoint_check is not None:
        checkpoint_check(directory, manifest)
    before = fs.inventory(policy, manifest["boundaries"])
    baseline_shared = {n: e for n, e in fs.stable_protected(manifest["inventory"]).items()
                       if manifest["inventory"][n]["class"] == "shared-parent"}
    fs.require(all(fs.stable_protected(before).get(n) == e for n, e in baseline_shared.items()),
               "shared_parent_checkpoint_drift")
    fs.require(not any(n in before and before[n]["class"] != "managed"
                       for n, e in manifest["inventory"].items() if e["class"] == "managed"),
               "managed_protected_overlap")

    approved, approval_sha, approval_raw = fs.authorize(
        policy, approval_path, OPERATION, checkpoint_id, before,
        manifest_sha256, return_snapshot=True)
    if authenticate is not None:
        authenticate(approved, approval_sha)
    fs.require(approved.get("boundaries") == manifest["boundaries"], "approval_boundaries")
    fs.require(approved.get("manifest_sha256") == manifest_sha256, "approval_manifest")
    fs.require(approved.get("publisher_sha256") == publisher_digest(), "approval_publisher")
    require_volatile_policy(approved.get("volatile_policy"))
    application_sha = approved.get("artifact_application_sha")
    archive_sha256 = approved.get("artifact_sha256")
    fs.require(checksum_token(checksum_path) == archive_sha256,
               "artifact_checksum_receipt")
    artifact, payload_bytes = artifact_files(archive_path, application_sha, archive_sha256)
    files = artifact["files"]
    plan = artifact_plan(manifest, before, files)
    fs.require(approved.get("artifact_entries_sha256") == fs.object_digest(files),
               "approval_artifact_inventory")
    fs.require(approved.get("publication_plan_sha256") == plan_digest(plan),
               "approval_publication_plan")
    fs.require(approved.get("removals") == plan["removals"], "approval_removals")
    previous = prior_operation_lineage(directory)
    fs.require(approved.get("prior_operations") == previous, "unapproved_prior_publications")

    operation = directory / ("publication-" + approval_sha)
    with fs.publisher_lock(policy):
        require_no_drift(policy, manifest["boundaries"], before, "publication_drift")
        fs.require(prior_operation_lineage(directory) == previous, "publication_lineage_drift")
        fs.require(shutil.disk_usage(policy.private).free >
                   2 * payload_bytes + 4 * len(fs.encoded(before)) + 1048576,
                   "insufficient_space")
        try:
            operation.mkdir(mode=0o700)
        except FileExistsError:
            raise fs.CheckpointError("publication_approval_used") from None
        fs.fsync_directory(directory)
        fs.write_bytes(operation / "authorization.json", approval_raw)
        fs.write_json(operation / "pre-state.json", before)
        fs.write_json(operation / "journal.jsonl", {"status": "AUTHORIZED_NOT_COMPLETED"})
        staged = stage_artifact(archive_path, files, operation)
        fs.require(fs.load_checkpoint(policy, checkpoint_id, manifest_sha256)[1] == manifest,
                   "checkpoint_drift")
        require_no_drift(policy, manifest["boundaries"], before, "publication_drift")
        fs.require(fs.authorize(policy, approval_path, OPERATION, checkpoint_id, before,
                                expected_digest=approval_sha) == approved, "approval_drift")
        artifact_preflight(policy, manifest, before, plan, files, staged, realm)
        directories = {n: (e["device"], e["inode"]) for n, e in before.items()
                       if e["type"] == "directory"}
        try:
            for name in sorted(plan["removals"], key=lambda n: (n.count("/"), n), reverse=True):
                remove_artifact_file(policy, name, before[name], operation, directories, realm)
            for name in plan["replacements"] + plan["additions"]:
                publish_artifact_file(policy, name, files[name], staged[name],
                                      before, operation, directories, realm)
            artifact_matches(policy, manifest, before, files)
            fs.write_json(operation / "outcome.json", {"status": SUCCESS})
        except BaseException:
            fs.journal(operation, {"status": "FAILED_OR_INTERRUPTED_KEEP_HELD"})
            raise
    return {"status": SUCCESS, "checkpoint_id": checkpoint_id,
            "manifest_sha256": manifest_sha256,
            "artifact_application_sha": application_sha,
            "artifact_sha256": archive_sha256,
            "additions": plan["additions"], "replacements": plan["replacements"],
            "removals": sorted(plan["removals"])}


def candidate_pin(candidate):
    """Validate the fixed release-candidate pin the production caller supplies.

    `main()` always supplies `fs.CANDIDATE`. The pin is what binds the artifact the
    publisher is willing to write to one reviewed release identity, so a substituted
    artifact that merely has a valid internal manifest cannot be published.
    """
    fs.require(isinstance(candidate, dict)
               and set(candidate) == {"artifact_id", "application_sha", "archive_sha256"}
               and isinstance(candidate["artifact_id"], str)
               and bool(candidate["artifact_id"].strip())
               and re.fullmatch(r"[a-f0-9]{40}", candidate["application_sha"] or "") is not None
               and re.fullmatch(SIGNATURE_PATTERN, candidate["archive_sha256"] or "") is not None,
               "production_candidate_pin")
    return candidate


def checkpoint_freshness(directory, manifest):
    """Production-only: the checkpoint baseline must be recent, not future-dated.

    A checkpoint is the pre-release baseline. Publishing against a stale baseline
    would push code over state nobody recently reviewed, so the production realm
    additionally requires the capture to have completed inside the same bounded
    window the approval itself lives in.
    """
    completed = fs.timestamp(manifest["capture"]["completed_utc"])
    current = fs.now()
    fs.require(current - dt.timedelta(minutes=15) <= completed <= current,
               "production_checkpoint_stale")


def publish_artifact_production(policy, checkpoint_id, manifest_sha256, approval_path,
                                signature_path, key_path, archive_path, checksum_path,
                                candidate=None):
    """The gated production door. Every prerequisite is checked before any mutation.

    Prerequisites, in order: a self-consistent production policy, the shared
    publisher lock already present, a readable operator approval key, a detached
    HMAC-SHA256 signature over the exact approval bytes, an approval that pins the
    key identity and the fixed candidate digests, then the shared body's verified
    checkpoint, verified candidate artifact, protected-state equality, single-use
    approval and interruption journal.

    `candidate` defaults to the fixed `fs.CANDIDATE`; `main()` never overrides it.
    Nothing about this door is provisioned in this repository: no key, no lock, no
    approval and no production approval policy exist yet.
    """
    pin = candidate_pin(fs.CANDIDATE if candidate is None else candidate)
    require_production_policy(policy)
    require_publication_lock(policy)
    key = approval_key(key_path, policy)
    key_identity = hashlib.sha256(key).hexdigest()
    signed_digest = signed_approval_digest(policy, approval_path, signature_path, key)

    def authenticate(approved, approval_sha):
        fs.require(hmac.compare_digest(approval_sha, signed_digest),
                   "approval_signature_drift")
        fs.require(approved.get("production_key_sha256") == key_identity,
                   "approval_key_identity")
        fs.require(approved.get("artifact_application_sha") == pin["application_sha"],
                   "approval_candidate_application")
        fs.require(approved.get("artifact_sha256") == pin["archive_sha256"],
                   "approval_candidate_archive")

    result = artifact_publication(
        policy, checkpoint_id, manifest_sha256, approval_path, archive_path,
        checksum_path, realm=PRODUCTION_REALM, authenticate=authenticate,
        checkpoint_check=checkpoint_freshness)
    return dict(result, realm=PRODUCTION_REALM, approval_key_sha256=key_identity)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", nargs="?", choices=("publish",), default="publish")
    parser.add_argument("--checkpoint")
    parser.add_argument("--manifest-sha256")
    parser.add_argument("--approval", type=Path)
    parser.add_argument("--archive", type=Path)
    parser.add_argument("--checksum", type=Path)
    parser.add_argument("--signature", type=Path)
    parser.add_argument("--approval-key", type=Path)
    parser.add_argument("--production", action="store_true")
    args = parser.parse_args(argv)
    if not args.production:
        print(DISABLED, file=sys.stderr)
        return 1
    try:
        fs.require(args.signature is not None and args.approval_key is not None
                   and bool(args.checkpoint) and bool(args.manifest_sha256)
                   and args.approval is not None and args.archive is not None
                   and args.checksum is not None, "production_arguments")
        os.umask(0o077)
        result = publish_artifact_production(
            fs.PRODUCTION, args.checkpoint, args.manifest_sha256, args.approval,
            args.signature, args.approval_key, args.archive, args.checksum)
        print(json.dumps(result, sort_keys=True))
        return 0
    except (fs.CheckpointError, OSError, ValueError, KeyError, TypeError,
            tarfile.TarError, ArithmeticError):
        print(PRODUCTION_ABORT, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
