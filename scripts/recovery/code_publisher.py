#!/usr/bin/env python3
"""Fixture-only managed-code publisher. Production execution is hard-disabled."""

import argparse
import hashlib
import importlib.util
import os
from contextlib import contextmanager
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import sys


VARIANT = "dombi-code-publisher-v1"
OPERATION = "filesystem-code-publication"
PUBLICATION_PATTERN = r"publication-[0-9a-f]{64}"
PUBLICATION_ENTRIES = ("authorization.json", "pre-state.json", "journal.jsonl", "outcome.json")
PAYLOAD_PATTERN = r"payload-[0-9]+"
SUCCESS = "CODE_PUBLISH_COMPLETE_KEEP_HELD"
DISABLED = "PUBLISHER_DISABLED; no production publication path exists; keep doors held"


def checkpoint_module():
    """Reuse the sibling checkpoint module so error types and gates stay identical."""
    name = "filesystem_checkpoint"
    source = Path(__file__).with_name("filesystem_checkpoint.py").resolve()
    module = sys.modules.get(name)
    if module is not None and getattr(module, "VARIANT", None) == "dombi-filesystem-checkpoint-v1":
        fs.require(Path(module.__file__).resolve() == source, "foreign_checkpoint_module")
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


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", nargs="?", choices=("publish",), default="publish")
    parser.add_argument("--checkpoint")
    parser.add_argument("--manifest-sha256")
    parser.add_argument("--approval", type=Path)
    parser.parse_args(argv)
    print(DISABLED, file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
