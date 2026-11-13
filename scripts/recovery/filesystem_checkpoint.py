#!/usr/bin/env python3
"""Pinned code-only checkpoints. No PHP, database connection, or reopening."""

import argparse
from contextlib import contextmanager
from dataclasses import dataclass
from decimal import Decimal
import datetime as dt
import fcntl
import gzip
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import posixpath
import re
import shutil
import stat
import sys
import tarfile


CANDIDATE = {
    "artifact_id": "14015610232",
    "application_sha": "4ebe5e1da608b0c7404e2667cb99742747db4796",
    "archive_sha256": "5b5a54453badc86134e890cb4f5448a80dce1fc1b391eec03ec41284988225d5",
}
VARIANT = "dombi-filesystem-checkpoint-v1"
METADATA_POLICY = "no-xattrs-acls-hardlinks;integer-ns;shared-parent-stable-identity"
ID_PATTERN = r"dombi-fs-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{32}"
SHA_PATTERN = r"[0-9a-f]{64}"
FLAGS = (
    "admissions_stopped", "scheduler_paused", "workers_drained",
    "doku_callback_delivery_safely_held", "no_deployment_in_flight",
    "same_database_schema_unchanged", "persistent_paths_preserved",
    "external_requirements_reviewed",
)
EVIDENCE = (
    "host_identity", "writer_drain", "callback_hold", "runtime_identity",
    "schema_compatibility", "persistent_preservation", "capacity_quota", "authority",
)


class CheckpointError(Exception):
    pass


def require(condition, reason):
    if not condition:
        raise CheckpointError(reason)


@dataclass(frozen=True)
class Policy:
    root: Path
    private: Path
    account: str

    @property
    def lock(self):
        return self.private / "dombi-filesystem-publication.lock"


PRODUCTION = Policy(
    Path("/home/u399215191/domains/dombicenter.com/public_html/app"),
    Path("/home/u399215191/private-backups"),
    "u399215191",
)


def encoded(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()


def object_digest(value):
    return hashlib.sha256(encoded(value)).hexdigest()


def text(value):
    return isinstance(value, str) and bool(value.strip())


def integer(value):
    return type(value) is int


def stat_identity(s):
    return (s.st_dev, s.st_ino, s.st_mode, s.st_uid, s.st_gid,
            s.st_size, s.st_mtime_ns, s.st_ctime_ns, s.st_nlink)


def relative(name, root_allowed=False):
    require(isinstance(name, str) and "\x00" not in name, "path_type")
    require(name == "." and root_allowed or (
        bool(name) and not name.startswith("/") and name != "."
        and str(PurePosixPath(name)) == name
        and all(p not in ("", ".", "..") for p in name.split("/"))
    ), "noncanonical_path")
    return name


def beneath(name, scope):
    return name == scope or name.startswith(scope + "/")


def ancestors(path):
    require(path.is_absolute(), "absolute_path_required")
    for p in reversed([path, *path.parents]):
        s = p.lstat()
        require(not stat.S_ISLNK(s.st_mode), "symlink_ancestor")
        if p != path:
            require(stat.S_ISDIR(s.st_mode), "ancestor_type")


def private_directory(path):
    ancestors(path)
    s = path.lstat()
    require(stat.S_ISDIR(s.st_mode) and s.st_uid == os.getuid()
            and stat.S_IMODE(s.st_mode) == 0o700, "private_directory")


def check_policy(policy):
    import pwd

    require(pwd.getpwuid(os.getuid()).pw_name == policy.account, "account")
    ancestors(policy.root)
    private_directory(policy.private)
    require(not policy.root.is_relative_to(policy.private)
            and not policy.private.is_relative_to(policy.root), "private_boundary")
    s = policy.root.lstat()
    require(stat.S_ISDIR(s.st_mode) and s.st_uid == os.getuid() and not s.st_mode & 0o022
            and s.st_dev == policy.private.stat().st_dev, "root_identity_or_device")
    return s


@contextmanager
def absolute_parent(path):
    require(path.is_absolute() and str(path) == posixpath.normpath(str(path)), "absolute_path")
    fd = os.open("/", os.O_RDONLY | os.O_DIRECTORY)
    try:
        for component in path.parts[1:-1]:
            next_fd = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = next_fd
        yield fd, path.name
    finally:
        os.close(fd)


@contextmanager
def regular_file(path, private=False):
    with absolute_parent(path) as (parent, name):
        fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
    try:
        s = os.fstat(fd)
        require(stat.S_ISREG(s.st_mode) and s.st_nlink == 1, "regular_file")
        if private:
            require(s.st_uid == os.getuid() and stat.S_IMODE(s.st_mode) == 0o600,
                    "private_file")
        with os.fdopen(fd, "rb", closefd=False) as stream:
            yield stream, s
        end = os.fstat(fd)
        require((s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns)
                == (end.st_dev, end.st_ino, end.st_size, end.st_mtime_ns, end.st_ctime_ns),
                "file_drift")
    finally:
        os.close(fd)


def file_digest(path, private=False):
    with regular_file(path, private) as (stream, _):
        h = hashlib.sha256()
        for block in iter(lambda: stream.read(1048576), b""):
            h.update(block)
        return h.hexdigest()


def pairs(items):
    result = {}
    for key, value in items:
        require(key not in result, "duplicate_json_key")
        result[key] = value
    return result


def json_snapshot(path, private=True, expected_digest=None):
    with regular_file(path, private) as (stream, s):
        require(s.st_size <= 64 * 1024 * 1024, "json_size")
        raw = stream.read(64 * 1024 * 1024 + 1)
        require(len(raw) == s.st_size, "json_size_drift")
        digest = hashlib.sha256(raw).hexdigest()
        require(expected_digest is None or digest == expected_digest, "json_pin")
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=pairs,
                           parse_constant=lambda _: require(False, "json_constant"))
        current = path.lstat()
        require(stat_identity(current) == stat_identity(s), "json_identity_drift")
    require(isinstance(value, dict), "json_object")
    return value, digest, raw


def load_json(path, private=True):
    return json_snapshot(path, private)[0]


def fsync_directory(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def write_json(path, value):
    write_bytes(path, encoded(value) + b"\n")


def write_bytes(path, raw):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "wb") as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    fsync_directory(path.parent)


def validate_boundaries(value):
    require(isinstance(value, dict) and set(value) == {
        "managed_scopes", "protected_paths", "database_paths", "protected_links",
    }, "boundary_fields")
    for field in ("managed_scopes", "protected_paths", "database_paths"):
        names = value[field]
        require(isinstance(names, list) and all(isinstance(n, str) for n in names)
                and len(names) == len(set(names)), "boundary_list")
        for name in names:
            relative(name)
    require(value["managed_scopes"], "empty_managed_scope")
    require(isinstance(value["protected_links"], dict), "protected_links")
    for name, target in value["protected_links"].items():
        relative(name)
        require(text(target) and not target.startswith("/") and "\x00" not in target,
                "protected_link_target")
    return value


def database_file(name, boundaries):
    base = re.sub(r"-(wal|shm|journal)$", "", name, flags=re.I)
    return (bool(re.search(r"\.(sqlite[0-9]*|db[0-9]*|sql)$", base, re.I))
            or any(name == n or name in (n + "-wal", n + "-shm", n + "-journal")
                   for n in boundaries["database_paths"]))


def protected(name, boundaries):
    parts = PurePosixPath(name).parts
    return (
        any(p.startswith(".env") or p in (".git", "node_modules") for p in parts)
        or any(beneath(name, n) for n in (
            "storage", "uploads", "public/uploads", "public/storage", "bootstrap/cache",
        ))
        or name.lower().endswith((".pem", ".key", ".p12", ".pfx"))
        or database_file(name, boundaries)
        or any(beneath(name, n) for n in boundaries["protected_paths"])
        or name in boundaries["protected_links"]
    )


def classification(name, boundaries, directory):
    if name == ".":
        return "shared-parent"
    if protected(name, boundaries):
        return "protected"
    if any(beneath(name, n) for n in boundaries["managed_scopes"]):
        return "managed"
    if directory and any(n.startswith(name + "/") for n in (
        boundaries["managed_scopes"] + boundaries["protected_paths"]
        + boundaries["database_paths"] + list(boundaries["protected_links"])
    )):
        return "shared-parent"
    require(False, "unclassified_entry")


def inventory(policy, boundaries, damaged=None):
    validate_boundaries(boundaries)
    root_stat = check_policy(policy)
    result = {}

    def visit(parent, leaf, path, name):
        s = os.stat(leaf, dir_fd=parent, follow_symlinks=False)
        require(s.st_dev == root_stat.st_dev and not s.st_mode & 0o7000, "metadata_boundary")
        require(hasattr(os, "listxattr"), "unsupported_metadata_platform")
        attribute_path = f"/proc/self/fd/{parent}/{leaf}" if sys.platform == "linux" else path
        require(not os.listxattr(attribute_path, follow_symlinks=False), "unsupported_xattrs_or_acl")
        kind = ("directory" if stat.S_ISDIR(s.st_mode) else
                "file" if stat.S_ISREG(s.st_mode) else
                "symlink" if stat.S_ISLNK(s.st_mode) else None)
        require(kind is not None and (kind != "file" or s.st_nlink == 1), "special_or_hardlink")
        entry = {
            "class": classification(name, boundaries, kind == "directory"),
            "type": kind, "uid": s.st_uid, "gid": s.st_gid,
            "mode": stat.S_IMODE(s.st_mode), "mtime_ns": s.st_mtime_ns,
            "device": s.st_dev, "inode": s.st_ino, "nlink": s.st_nlink,
        }
        if kind == "file":
            entry["size"] = s.st_size
            if database_file(name, boundaries):
                require(entry["class"] == "protected", "database_not_protected")
                entry.update(inventory_mode="metadata-only", content_integrity="not-verified")
            else:
                fd = os.open(leaf, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
                with os.fdopen(fd, "rb") as stream:
                    require(stat_identity(os.fstat(fd)) == stat_identity(s), "inventory_drift")
                    h = hashlib.sha256()
                    for block in iter(lambda: stream.read(1048576), b""):
                        h.update(block)
                    require(stat_identity(os.fstat(fd)) == stat_identity(s), "inventory_drift")
                    entry["sha256"] = h.hexdigest()
        elif kind == "symlink":
            entry["target"] = os.readlink(leaf, dir_fd=parent)
        result[name] = entry
        if kind == "directory":
            fd = os.open(leaf, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
            try:
                require(stat_identity(os.fstat(fd)) == stat_identity(s), "inventory_drift")
                for child in sorted(os.listdir(fd)):
                    visit(fd, child, path / child, child if name == "." else name + "/" + child)
            finally:
                os.close(fd)
        require(stat_identity(os.stat(leaf, dir_fd=parent, follow_symlinks=False))
                == stat_identity(s), "inventory_drift")

    with absolute_parent(policy.root) as (parent, leaf):
        visit(parent, leaf, policy.root, ".")
    for name in sorted(result, key=lambda n: n.count("/"), reverse=True):
        if result[name]["class"] == "protected":
            for parent in PurePosixPath(name).parents:
                p = str(parent)
                if p in result and result[p]["class"] == "managed":
                    result[p]["class"] = "shared-parent"
    validate_links(result, boundaries, policy.root, record=True, damaged=damaged)
    for e in result.values():
        if e["class"] == "managed":
            require(e["uid"] == os.getuid() and e["gid"] in {os.getgid(), *os.getgroups()},
                    "unrestorable_owner")
    return result


def validate_links(items, boundaries, root, record=False, damaged=None):
    for name, entry in items.items():
        if entry["type"] != "symlink":
            continue
        target = entry["target"]
        require(text(target) and not target.startswith("/") and "\x00" not in target, "link_target")
        resolved = posixpath.normpath(posixpath.join(posixpath.dirname(name), target))
        relative(resolved, root_allowed=True)
        parts = PurePosixPath(resolved).parts
        require(all(items.get(str(PurePosixPath(*parts[:i])), {}).get("type") != "symlink"
                    for i in range(1, len(parts) + 1)), "chained_link")
        missing = resolved not in items
        if missing:
            require(damaged is not None and entry["class"] == "managed"
                    and name in damaged and damaged[name]["target"] == target
                    and damaged[name]["resolved"] == resolved
                    and any({k: v for k, v in entry.items() if k != "resolved_boundary"}
                            == {k: v for k, v in record["entry"].items()
                                if k != "resolved_boundary"}
                            for record in damaged[name]["entries"]),
                    "missing_or_external_link_target")
        if entry["class"] == "managed":
            require(missing or items[resolved]["class"] == "managed", "link_into_protected_state")
        else:
            require(boundaries["protected_links"].get(name) == target, "unapproved_protected_link")
        boundary = str(root / resolved)
        if record:
            entry["resolved_boundary"] = boundary
        else:
            require(entry.get("resolved_boundary") == boundary, "resolved_link_boundary")


def identity(policy, reference):
    s = check_policy(policy)
    require(text(reference), "host_reference")
    return {
        "account": policy.account, "root": str(policy.root), "resolved_root": str(policy.root),
        "document_root": str(policy.root / "public"), "uid": s.st_uid, "gid": s.st_gid,
        "mode": stat.S_IMODE(s.st_mode), "device": s.st_dev, "inode": s.st_ino,
        "host_inventory_reference": reference,
    }


def tool_digest():
    return file_digest(Path(__file__).absolute())


def timestamp(value):
    require(isinstance(value, str), "timestamp")
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    require(parsed.utcoffset() == dt.timedelta(0), "utc_required")
    return parsed


def now():
    return dt.datetime.now(dt.timezone.utc)


def authorize(policy, path, operation, checkpoint_id, observed, manifest_sha256=None,
              snapshot=None, expected_digest=None, return_snapshot=False):
    private_directory(path.parent)
    require(path.is_relative_to(policy.private), "approval_boundary")
    snapshot = snapshot or json_snapshot(path, expected_digest=expected_digest)
    a, digest, raw = snapshot
    require(expected_digest is None or digest == expected_digest, "approval_pin")
    require(a.get("operation") == operation and a.get("checkpoint_id") == checkpoint_id
            and re.fullmatch(ID_PATTERN, checkpoint_id), "approval_operation")
    require(a.get("operator") == policy.account and text(a.get("independent_verifier"))
            and a["independent_verifier"] != policy.account, "independent_approval")
    require(a.get("tool_sha256") == tool_digest() and a.get("candidate") == CANDIDATE,
            "approval_tool_or_candidate")
    require(a.get("root_identity") == identity(policy, a.get("host_inventory_reference")),
            "approval_root")
    current = now()
    issued, expiry, witnessed = (timestamp(a.get(k)) for k in
                                ("issued_utc", "expires_utc", "identity_verified_utc"))
    require(current - dt.timedelta(minutes=15) <= issued <= current < expiry
            <= issued + dt.timedelta(minutes=15)
            and current - dt.timedelta(minutes=15) <= witnessed <= current, "approval_expired")
    require(all(a.get(k) is True for k in FLAGS), "missing_assertion")
    require(isinstance(a.get("evidence"), dict)
            and all(text(a["evidence"].get(k)) for k in EVIDENCE), "missing_evidence")
    require(a.get("publisher_lock_path") == str(policy.lock), "publisher_lock")
    require(a.get("effective_identity") == {
        "environment": "production", "url": "https://app.dombicenter.com",
        "database": "u399215191_dombi_pr_1023",
    }, "effective_identity")
    require(a.get("observed_state_sha256") == object_digest(observed), "unapproved_state")
    if operation == "filesystem-code-recovery":
        require(a.get("manifest_sha256") == manifest_sha256, "approval_manifest")
    return snapshot if return_snapshot else a


@contextmanager
def publisher_lock(policy):
    with regular_file(policy.lock, private=True) as (stream, _):
        fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            yield
        finally:
            fcntl.flock(stream.fileno(), fcntl.LOCK_UN)


def checkpoint_path(policy, checkpoint_id):
    require(isinstance(checkpoint_id, str) and re.fullmatch(ID_PATTERN, checkpoint_id), "checkpoint_id")
    return policy.private / checkpoint_id


def payload_entries(items):
    return {n: e for n, e in items.items() if e["class"] != "protected"}


def make_archive(policy, path, items):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "wb") as stream:
        with tarfile.open(fileobj=stream, mode="w:gz", format=tarfile.PAX_FORMAT) as archive:
            for name, e in sorted(payload_entries(items).items()):
                member = tarfile.TarInfo(name)
                member.uid, member.gid, member.mode = e["uid"], e["gid"], e["mode"]
                member.mtime = e["mtime_ns"] // 1_000_000_000
                member.pax_headers = {"mtime": str(Decimal(e["mtime_ns"]) / Decimal(1_000_000_000))}
                if e["type"] == "directory":
                    member.type = tarfile.DIRTYPE
                    archive.addfile(member)
                elif e["type"] == "symlink":
                    member.type, member.linkname = tarfile.SYMTYPE, e["target"]
                    archive.addfile(member)
                else:
                    member.size = e["size"]
                    with regular_file(policy.root / name) as (source, _):
                        archive.addfile(member, source)
        stream.flush()
        os.fsync(stream.fileno())
    fsync_directory(path.parent)


def validate_manifest(policy, m, checkpoint_id):
    require(set(m) == {"schema_version", "checkpoint_id", "historical_release_sha",
                      "root_identity", "capture", "candidate", "boundaries", "inventory",
                      "archives", "recovery_contract"}, "manifest_fields")
    require(type(m["schema_version"]) is int and m["schema_version"] == 1
            and m["checkpoint_id"] == checkpoint_id
            and m["historical_release_sha"] is None and m["candidate"] == CANDIDATE, "manifest_identity")
    require(m["root_identity"] == identity(policy, m["root_identity"].get("host_inventory_reference")),
            "manifest_root")
    require(m["recovery_contract"] == {
        "variant": VARIANT, "tool_sha256": tool_digest(), "metadata_policy": METADATA_POLICY,
        "compatibility_evidence_reference": m["capture"]["schema_compatibility_reference"],
    }, "recovery_contract")
    require(timestamp(m["capture"]["started_utc"]) <= timestamp(m["capture"]["completed_utc"]),
            "capture_time")
    b = validate_boundaries(m["boundaries"])
    items = m["inventory"]
    require(isinstance(items, dict) and "." in items, "manifest_inventory")
    for name, e in items.items():
        relative(name, root_allowed=True)
        require(isinstance(e, dict) and e.get("type") in ("file", "directory", "symlink")
                and e.get("class") in ("managed", "protected", "shared-parent"), "entry_type")
        for key in ("uid", "gid", "mode", "mtime_ns", "device", "inode", "nlink"):
            require(integer(e.get(key)), "entry_integer")
        fields = {"class", "type", "uid", "gid", "mode", "mtime_ns", "device", "inode", "nlink"}
        if e["type"] == "file":
            fields |= {"size", "inventory_mode", "content_integrity"} if database_file(name, b) else {"size", "sha256"}
        elif e["type"] == "symlink":
            fields |= {"target", "resolved_boundary"}
        require(set(e) == fields, "entry_fields")
        require(0 <= e["mode"] <= 0o777 and e["device"] == m["root_identity"]["device"],
                "entry_metadata")
        require(e["class"] == "protected" if protected(name, b) else e["class"] != "protected",
                "protected_classification")
        if e["class"] == "shared-parent":
            require(e["type"] == "directory", "shared_parent_type")
        elif e["class"] == "managed":
            require(any(beneath(name, scope) for scope in b["managed_scopes"])
                    and e["uid"] == os.getuid()
                    and e["gid"] in {os.getgid(), *os.getgroups()}, "managed_scope_or_owner")
        if name != ".":
            parent = str(PurePosixPath(name).parent)
            require(items.get(parent, {}).get("type") == "directory", "entry_parent")
        expected_class = classification(name, b, e["type"] == "directory")
        if expected_class == "managed" and e["type"] == "directory":
            if any(other != name and beneath(other, name) and protected(other, b) for other in items):
                expected_class = "shared-parent"
        require(e["class"] == expected_class, "entry_classification")
        if e["type"] == "file":
            require(integer(e.get("size")) and e["size"] >= 0 and e["nlink"] == 1, "file_metadata")
            if database_file(name, b):
                require("sha256" not in e and e.get("inventory_mode") == "metadata-only"
                        and e.get("content_integrity") == "not-verified", "database_metadata_only")
            else:
                require(isinstance(e.get("sha256"), str) and re.fullmatch(SHA_PATTERN, e["sha256"]),
                        "content_hash")
    require(items["."]["class"] == "shared-parent", "root_classification")
    for name, e in items.items():
        if e["class"] == "protected":
            require(all(items[str(p)]["class"] != "managed" for p in PurePosixPath(name).parents),
                    "protected_descendant")
    validate_links(items, b, policy.root)
    expected = sorted(payload_entries(items))
    require(len(m["archives"]) == 1, "archive_count")
    a = m["archives"][0]
    require(set(a) == {"filename", "size", "sha256", "purpose", "entries"}
            and a["filename"] == "code.tar.gz" and a["purpose"] == "managed-code"
            and a["entries"] == expected and integer(a["size"]) and a["size"] > 0
            and re.fullmatch(SHA_PATTERN, a["sha256"]), "archive_contract")


def validate_archive(path, m, staging=None):
    record = m["archives"][0]
    require(path.lstat().st_size == record["size"]
            and file_digest(path, private=True) == record["sha256"], "archive_pin")
    expected = payload_entries(m["inventory"])
    seen, staged = set(), {}
    with regular_file(path, private=True) as (source, _):
        with gzip.GzipFile(fileobj=source) as compressed:
            total = 0
            limit = sum(e.get("size", 0) for e in expected.values()) + 16384 * (len(expected) + 1)
            for block in iter(lambda: compressed.read(1048576), b""):
                total += len(block)
                require(total <= limit, "archive_expansion")
        source.seek(0)
        with tarfile.open(fileobj=source, mode="r:gz") as archive:
            for member in archive:
                name = relative(member.name, root_allowed=True)
                require(name not in seen and name in expected, "archive_path_or_duplicate")
                seen.add(name)
                e = expected[name]
                kind = ("file" if member.isreg() else "directory" if member.isdir()
                        else "symlink" if member.issym() else None)
                require(kind == e["type"] and member.uid == e["uid"] and member.gid == e["gid"]
                        and member.mode == e["mode"] and "mtime" in member.pax_headers,
                        "archive_metadata")
                ns = Decimal(member.pax_headers["mtime"]) * Decimal(1_000_000_000)
                require(ns.is_finite() and ns == e["mtime_ns"], "archive_mtime")
                require(not member.sparse, "sparse_archive")
                if kind == "symlink":
                    require(member.linkname == e["target"] and member.size == 0, "archive_link")
                elif kind == "directory":
                    require(member.size == 0, "directory_size")
                else:
                    require(member.size == e["size"], "archive_size")
                    h = hashlib.sha256()
                    output = None
                    if staging is not None:
                        destination = staging / ("payload-" + str(len(staged)))
                        fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
                        output = os.fdopen(fd, "wb")
                        staged[name] = destination
                    try:
                        with archive.extractfile(member) as data:
                            for block in iter(lambda: data.read(1048576), b""):
                                h.update(block)
                                if output:
                                    output.write(block)
                        if output:
                            output.flush()
                            os.fsync(output.fileno())
                    finally:
                        if output:
                            output.close()
                    require(h.hexdigest() == e["sha256"], "archive_content")
    require(seen == set(expected), "archive_completeness")
    if staging:
        fsync_directory(staging)
    return staged


def load_checkpoint(policy, checkpoint_id, manifest_sha256):
    check_policy(policy)
    require(isinstance(manifest_sha256, str) and re.fullmatch(SHA_PATTERN, manifest_sha256),
            "manifest_pin_format")
    directory = checkpoint_path(policy, checkpoint_id)
    private_directory(directory)
    path = directory / "manifest.json"
    m = json_snapshot(path, expected_digest=manifest_sha256)[0]
    validate_manifest(policy, m, checkpoint_id)
    receipt = load_json(directory / "verification.json")
    require(receipt == {
        "status": "CHECKPOINT_VERIFIED", "checkpoint_id": checkpoint_id,
        "manifest_sha256": manifest_sha256, "archive_sha256": m["archives"][0]["sha256"],
    }, "incomplete_checkpoint")
    validate_archive(directory / "code.tar.gz", m)
    return directory, m


def stable_protected(items):
    result = {}
    for name, entry in items.items():
        if entry["class"] == "protected":
            result[name] = entry
        elif entry["class"] == "shared-parent":
            result[name] = {k: entry[k] for k in ("type", "device", "inode", "uid", "gid", "mode")}
    return result


def managed_metadata(items):
    return {n: {k: v for k, v in e.items() if k not in ("device", "inode", "nlink")}
            for n, e in items.items() if e["class"] == "managed"}


def removal_plan(m, items):
    desired = {n: e for n, e in m["inventory"].items() if e["class"] == "managed"}
    return {
        n: {"observed_entry_sha256": object_digest(e),
            "reason": "candidate-only" if n not in desired else "type-conflict"}
        for n, e in items.items() if e["class"] == "managed"
        and (n not in desired or e["type"] != desired[n]["type"])
    }


def inspect(policy, checkpoint_id=None, manifest_sha256=None, plan=None, verify=False):
    if plan is not None:
        private_directory(plan.parent)
        require(plan.is_relative_to(policy.private), "plan_boundary")
        p = load_json(plan)
        return {"root_identity": identity(policy, p["host_inventory_reference"]),
                "observed_state_sha256": object_digest(inventory(policy, p["boundaries"]))}
    directory, m = load_checkpoint(policy, checkpoint_id, manifest_sha256)
    damaged = damaged_links(directory, m)
    items = inventory(policy, m["boundaries"], damaged=damaged if not verify else None)
    if verify:
        require(managed_metadata(items) == managed_metadata(m["inventory"]), "managed_inventory_mismatch")
    return {"status": "MANAGED_INVENTORY_MATCH_KEEP_HELD" if verify else "CHECKPOINT_VALID",
            "checkpoint_id": checkpoint_id, "manifest_sha256": manifest_sha256,
            "observed_state_sha256": object_digest(items),
            "removal_plan_sha256": object_digest(removal_plan(m, items)),
            "prior_operations": prior_operations(directory)}


def capture(policy, approval_path):
    check_policy(policy)
    private_directory(approval_path.parent)
    require(approval_path.is_relative_to(policy.private), "approval_boundary")
    snapshot = json_snapshot(approval_path)
    a, approval_sha, approval_raw = snapshot
    b = validate_boundaries(a["boundaries"])
    before = inventory(policy, b)
    checkpoint_id = a["checkpoint_id"]
    approved = authorize(policy, approval_path, "filesystem-checkpoint-capture", checkpoint_id,
                         before, snapshot=snapshot)
    require(approved.get("boundaries") == b, "approval_boundaries")
    directory = checkpoint_path(policy, checkpoint_id)
    started = now().isoformat()
    with publisher_lock(policy):
        require(inventory(policy, b) == before, "capture_drift")
        require(authorize(policy, approval_path, "filesystem-checkpoint-capture", checkpoint_id,
                          before, expected_digest=approval_sha) == approved, "approval_drift")
        require(shutil.disk_usage(policy.private).free >
                3 * sum(e.get("size", 0) for e in payload_entries(before).values())
                + 4 * len(encoded(before)) + 1048576, "insufficient_space")
        directory.mkdir(mode=0o700)
        fsync_directory(policy.private)
        write_bytes(directory / "authorization.json", approval_raw)
        make_archive(policy, directory / "code.tar.gz", before)
        require(inventory(policy, b) == before, "capture_drift")
        m = {
            "schema_version": 1, "checkpoint_id": checkpoint_id, "historical_release_sha": None,
            "root_identity": approved["root_identity"], "candidate": CANDIDATE,
            "capture": {
                "started_utc": started, "completed_utc": now().isoformat(),
                "operator": policy.account, "authorization_reference": approval_sha,
                "publisher_lock_identity": {
                    "path": str(policy.lock), "device": policy.lock.stat().st_dev,
                    "inode": policy.lock.stat().st_ino,
                },
                "writer_drain_reference": approved["evidence"]["writer_drain"],
                "callback_containment_reference": approved["evidence"]["callback_hold"],
                "schema_compatibility_reference": approved["evidence"]["schema_compatibility"],
            },
            "boundaries": b, "inventory": before,
            "archives": [{
                "filename": "code.tar.gz", "size": (directory / "code.tar.gz").stat().st_size,
                "sha256": file_digest(directory / "code.tar.gz", True), "purpose": "managed-code",
                "entries": sorted(payload_entries(before)),
            }],
            "recovery_contract": {
                "variant": VARIANT, "tool_sha256": tool_digest(), "metadata_policy": METADATA_POLICY,
                "compatibility_evidence_reference": approved["evidence"]["schema_compatibility"],
            },
        }
        validate_manifest(policy, m, checkpoint_id)
        validate_archive(directory / "code.tar.gz", m)
        require(inventory(policy, b) == before, "capture_drift")
        authorize(policy, approval_path, "filesystem-checkpoint-capture", checkpoint_id,
                  before, expected_digest=approval_sha)
        write_json(directory / "manifest.json", m)
        digest = file_digest(directory / "manifest.json", True)
        write_json(directory / "verification.json", {
            "status": "CHECKPOINT_VERIFIED", "checkpoint_id": checkpoint_id,
            "manifest_sha256": digest, "archive_sha256": m["archives"][0]["sha256"],
        })
    return {"checkpoint_id": checkpoint_id, "manifest_sha256": digest, "status": "CHECKPOINT_VERIFIED"}


def journal(directory, event):
    path = directory / "journal.jsonl"
    fd = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_NOFOLLOW)
    with os.fdopen(fd, "ab") as stream:
        stream.write(encoded(event) + b"\n")
        stream.flush()
        os.fsync(stream.fileno())


def prior_operations(directory):
    result = {}
    for operation in sorted(directory.glob("recovery-*")):
        require(re.fullmatch(r"recovery-[0-9a-f]{64}", operation.name), "unknown_operation")
        private_directory(operation)
        entries = {}
        for path in sorted(operation.iterdir()):
            require(path.name in ("authorization.json", "pre-state.json", "journal.jsonl", "outcome.json")
                    or re.fullmatch(r"(payload|link)-[0-9]+", path.name), "unknown_operation_entry")
            s = path.lstat()
            require(s.st_uid == os.getuid() and s.st_nlink == 1, "operation_identity")
            if stat.S_ISREG(s.st_mode):
                entries[path.name] = {"sha256": file_digest(path), "inode": s.st_ino,
                                      "device": s.st_dev, "mode": stat.S_IMODE(s.st_mode)}
            elif stat.S_ISLNK(s.st_mode):
                entries[path.name] = {"target": os.readlink(path), "inode": s.st_ino,
                                      "device": s.st_dev}
            else:
                require(False, "unknown_operation_entry")
        require("authorization.json" in entries and "journal.jsonl" in entries, "incomplete_operation_identity")
        require(entries["authorization.json"].get("sha256") == operation.name.removeprefix("recovery-"),
                "operation_authorization_identity")
        result[operation.name] = object_digest(entries)
    return result


def damaged_links(directory, manifest):
    operation_pins = prior_operations(directory)
    allowed = {}
    publications = []
    for operation in sorted(directory.glob("recovery-*")):
        if (operation / "outcome.json").exists():
            continue
        approval = load_json(operation / "authorization.json")
        require(approval.get("checkpoint_id") == manifest["checkpoint_id"]
                and approval.get("manifest_sha256")
                == file_digest(directory / "manifest.json", True), "journal_checkpoint")
        if not (operation / "pre-state.json").exists():
            require(False, "incomplete_operation_identity")
        pre = load_json(operation / "pre-state.json")
        require(object_digest(pre) == approval.get("observed_state_sha256"), "journal_pre_state")
        with regular_file(operation / "journal.jsonl", private=True) as (stream, s):
            require(s.st_size <= 64 * 1024 * 1024, "journal_size")
            raw = stream.read()
        require(raw.endswith(b"\n"), "incomplete_journal")
        events = [json.loads(line, object_pairs_hook=pairs) for line in raw.splitlines()]
        for event in events:
            if event.get("action") == "publish-symlink-intent":
                name = relative(event.get("path"))
                expected = event.get("published_entry")
                baseline = manifest["inventory"].get(name, {})
                require(isinstance(expected, dict) and baseline.get("type") == "symlink"
                        and baseline.get("class") == "managed"
                        and managed_metadata({name: expected}) == managed_metadata({name: baseline})
                        and expected.get("device") == manifest["root_identity"]["device"]
                        and integer(expected.get("inode")) and expected["inode"] > 0
                        and expected.get("nlink") == 1, "journal_publication_identity")
                publications.append((operation.name, approval, pre, name, expected))
                continue
            if event.get("action") != "remove":
                continue
            target = event.get("path")
            relative(target)
            removal = approval.get("removals", {}).get(target, {})
            require(target in pre and event.get("expected") == pre[target]
                    and removal.get("observed_entry_sha256") == object_digest(pre[target]),
                    "journal_removal_binding")
            if removal.get("reason") != "type-conflict":
                continue
            require(manifest["inventory"].get(target, {}).get("class") == "managed",
                    "journal_managed_target")
            for name, entry in pre.items():
                if entry["class"] != "managed" or entry["type"] != "symlink":
                    continue
                resolved = posixpath.normpath(posixpath.join(posixpath.dirname(name), entry["target"]))
                baseline = manifest["inventory"].get(name, {})
                if (resolved == target and baseline.get("type") == "symlink"
                        and baseline.get("target") == entry["target"]):
                    item = allowed.setdefault(name, {"target": entry["target"], "resolved": resolved,
                                                     "entries": []})
                    item["entries"].append({"entry": entry, "operation": operation.name})
    pending = publications
    while pending:
        remaining = []
        for operation_name, approval, pre, name, expected in pending:
            item = allowed.get(name)
            if item is None or not any(
                record["entry"] == pre.get(name)
                and approval.get("prior_operations", {}).get(record["operation"])
                == operation_pins[record["operation"]]
                for record in item["entries"]
            ):
                remaining.append((operation_name, approval, pre, name, expected))
                continue
            record = {"entry": expected, "operation": operation_name}
            if record not in item["entries"]:
                item["entries"].append(record)
        if len(remaining) == len(pending):
            break
        pending = remaining
    return allowed


@contextmanager
def parent_fd(policy, name, directories):
    relative(name)
    with absolute_parent(policy.root) as (parent, leaf):
        fd = os.open(leaf, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
    try:
        chain = "."
        s = os.fstat(fd)
        require((s.st_dev, s.st_ino) == directories[chain], "parent_drift")
        for component in PurePosixPath(name).parts[:-1]:
            next_fd = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = next_fd
            chain = component if chain == "." else chain + "/" + component
            s = os.fstat(fd)
            require((s.st_dev, s.st_ino) == directories[chain], "parent_drift")
        yield fd, PurePosixPath(name).name
    finally:
        os.close(fd)


def restored_matches(policy, m, before):
    after = inventory(policy, m["boundaries"])
    require(managed_metadata(after) == managed_metadata(m["inventory"]), "restored_inventory")
    require(stable_protected(after) == stable_protected(before), "protected_state_changed")


def expected_target(policy, name, expected):
    path = policy.root / name
    ancestors(path.parent)
    if expected is None:
        require(not path.exists() and not path.is_symlink(), "unexpected_target")
        return
    s = path.lstat()
    require((s.st_dev, s.st_ino, s.st_uid, s.st_gid, stat.S_IMODE(s.st_mode))
            == tuple(expected[k] for k in ("device", "inode", "uid", "gid", "mode")),
            "target_drift")
    if expected["type"] == "file":
        require(stat.S_ISREG(s.st_mode) and s.st_nlink == 1
                and s.st_size == expected["size"] and s.st_mtime_ns == expected["mtime_ns"]
                and file_digest(path) == expected["sha256"], "target_content_drift")
    elif expected["type"] == "symlink":
        require(stat.S_ISLNK(s.st_mode) and os.readlink(path) == expected["target"]
                and s.st_mtime_ns == expected["mtime_ns"], "target_link_drift")
    else:
        require(stat.S_ISDIR(s.st_mode), "target_type_drift")


def target_at(fd, leaf, expected):
    try:
        s = os.stat(leaf, dir_fd=fd, follow_symlinks=False)
    except FileNotFoundError:
        require(expected is None, "missing_target")
        return None
    require(expected is not None, "unexpected_target")
    require((s.st_dev, s.st_ino, s.st_uid, s.st_gid, stat.S_IMODE(s.st_mode))
            == tuple(expected[k] for k in ("device", "inode", "uid", "gid", "mode")),
            "target_drift")
    if expected["type"] == "file":
        require(stat.S_ISREG(s.st_mode) and s.st_nlink == 1
                and s.st_size == expected["size"] and s.st_mtime_ns == expected["mtime_ns"],
                "target_content_drift")
        source = os.open(leaf, os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW, dir_fd=fd)
        with os.fdopen(source, "rb") as stream:
            require(stat_identity(os.fstat(source)) == stat_identity(s), "target_drift")
            h = hashlib.sha256()
            for block in iter(lambda: stream.read(1048576), b""):
                h.update(block)
            require(h.hexdigest() == expected["sha256"]
                    and stat_identity(os.fstat(source)) == stat_identity(s), "target_content_drift")
    elif expected["type"] == "symlink":
        require(stat.S_ISLNK(s.st_mode) and os.readlink(leaf, dir_fd=fd) == expected["target"]
                and s.st_mtime_ns == expected["mtime_ns"], "target_link_drift")
    else:
        require(stat.S_ISDIR(s.st_mode), "target_type_drift")
    require(stat_identity(os.stat(leaf, dir_fd=fd, follow_symlinks=False)) == stat_identity(s),
            "target_drift")
    return s


def apply_recovery(policy, m, before, staged, operation):
    desired = {n: e for n, e in m["inventory"].items() if e["class"] == "managed"}
    current = {n: e for n, e in before.items() if e["class"] == "managed"}
    directories = {n: (e["device"], e["inode"]) for n, e in before.items()
                   if e["type"] == "directory"}
    removals = [n for n, e in current.items() if n not in desired or e["type"] != desired[n]["type"]]
    require(not any(e["class"] != "managed" and beneath(n, r)
                    for r in removals for n, e in before.items()), "protected_descendant")
    for name in sorted(removals, key=lambda n: (n.count("/"), n), reverse=True):
        journal(operation, {"action": "remove", "path": name, "expected": current[name]})
        expected_target(policy, name, current[name])
        with parent_fd(policy, name, directories) as (fd, leaf):
            target_at(fd, leaf, current[name])
            if current[name]["type"] == "directory":
                os.rmdir(leaf, dir_fd=fd)
            else:
                os.unlink(leaf, dir_fd=fd)
            os.fsync(fd)
        journal(operation, {"action": "removed", "path": name})
    for index, (name, e) in enumerate(sorted(desired.items(), key=lambda item: (item[0].count("/"), item[0]))):
        journal(operation, {"action": "restore", "path": name, "desired": e})
        expected_target(policy, name, None if name in removals else current.get(name))
        with parent_fd(policy, name, directories) as (fd, leaf):
            if e["type"] == "directory":
                target_at(fd, leaf, None if name in removals else current.get(name))
                try:
                    os.mkdir(leaf, 0o700, dir_fd=fd)
                except FileExistsError:
                    require(stat.S_ISDIR(os.stat(leaf, dir_fd=fd, follow_symlinks=False).st_mode),
                            "directory_replaced")
                child = os.open(leaf, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
                try:
                    os.fchown(child, e["uid"], e["gid"])
                    os.fchmod(child, e["mode"] | 0o700)
                    os.fsync(child)
                    s = os.fstat(child)
                    directories[name] = (s.st_dev, s.st_ino)
                finally:
                    os.close(child)
            else:
                source = staged[name] if e["type"] == "file" else operation / ("link-" + str(index))
                if e["type"] == "symlink":
                    os.symlink(e["target"], source)
                    os.chown(source, e["uid"], e["gid"], follow_symlinks=False)
                    require(stat.S_IMODE(source.lstat().st_mode) == e["mode"], "symlink_mode")
                    os.utime(source, ns=(e["mtime_ns"], e["mtime_ns"]), follow_symlinks=False)
                else:
                    require(file_digest(source) == e["sha256"], "staging_drift")
                    staged_fd = os.open(source, os.O_RDONLY | os.O_NOFOLLOW)
                    try:
                        os.fchown(staged_fd, e["uid"], e["gid"])
                        os.fchmod(staged_fd, e["mode"])
                        os.utime(staged_fd, ns=(e["mtime_ns"], e["mtime_ns"]))
                        os.fsync(staged_fd)
                    finally:
                        os.close(staged_fd)
                fsync_directory(operation)
                if e["type"] == "symlink":
                    s = source.lstat()
                    published = dict(e, device=s.st_dev, inode=s.st_ino, nlink=s.st_nlink,
                                     uid=s.st_uid, gid=s.st_gid, mode=stat.S_IMODE(s.st_mode),
                                     mtime_ns=s.st_mtime_ns)
                    journal(operation, {"action": "publish-symlink-intent", "path": name,
                                        "published_entry": published})
                target_at(fd, leaf, None if name in removals else current.get(name))
                os.replace(source, leaf, dst_dir_fd=fd)
                os.fsync(fd)
                fsync_directory(operation)
            os.fsync(fd)
        journal(operation, {"action": "restored", "path": name})
    for name, e in sorted(desired.items(), key=lambda item: item[0].count("/"), reverse=True):
        if e["type"] == "directory":
            with parent_fd(policy, name, directories) as (fd, leaf):
                child = os.open(leaf, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
                try:
                    os.fchmod(child, e["mode"])
                    os.utime(child, ns=(e["mtime_ns"], e["mtime_ns"]))
                    os.fsync(child)
                finally:
                    os.close(child)


def recover(policy, checkpoint_id, manifest_sha256, approval_path, confirmation):
    directory, m = load_checkpoint(policy, checkpoint_id, manifest_sha256)
    require(confirmation == f"RECOVER {policy.root} TO CHECKPOINT {checkpoint_id} {manifest_sha256}",
            "confirmation")
    damaged = damaged_links(directory, m)
    before = inventory(policy, m["boundaries"], damaged=damaged)
    baseline_shared = {n: e for n, e in stable_protected(m["inventory"]).items()
                       if m["inventory"][n]["class"] == "shared-parent"}
    current_shared = stable_protected(before)
    require(all(current_shared.get(n) == e for n, e in baseline_shared.items()),
            "shared_parent_checkpoint_drift")
    require(not any(n in before and before[n]["class"] != "managed"
                    for n, e in m["inventory"].items() if e["class"] == "managed"),
            "managed_protected_overlap")
    approved, approval_sha, approval_raw = authorize(
        policy, approval_path, "filesystem-code-recovery", checkpoint_id, before,
        manifest_sha256, return_snapshot=True)
    require(approved.get("boundaries") == m["boundaries"], "approval_boundaries")
    require(approved.get("removals") == removal_plan(m, before)
            and text(approved.get("deletion_evidence_reference")), "unapproved_removals")
    previous = prior_operations(directory)
    require(approved.get("prior_operations") == previous, "unapproved_prior_operations")
    operation = directory / ("recovery-" + approval_sha)
    with publisher_lock(policy):
        require(inventory(policy, m["boundaries"], damaged=damaged) == before, "recovery_drift")
        require(prior_operations(directory) == previous, "operation_drift")
        require(shutil.disk_usage(policy.private).free >
                2 * sum(e.get("size", 0) for e in payload_entries(m["inventory"]).values())
                + 4 * len(encoded(before)) + 1048576, "insufficient_space")
        operation.mkdir(mode=0o700)
        fsync_directory(directory)
        write_bytes(operation / "authorization.json", approval_raw)
        write_json(operation / "pre-state.json", before)
        write_json(operation / "journal.jsonl", {"status": "AUTHORIZED_NOT_COMPLETED"})
        staged = validate_archive(directory / "code.tar.gz", m, operation)
        require(load_checkpoint(policy, checkpoint_id, manifest_sha256)[1] == m, "checkpoint_drift")
        require(inventory(policy, m["boundaries"], damaged=damaged) == before, "recovery_drift")
        require(authorize(policy, approval_path, "filesystem-code-recovery", checkpoint_id,
                           before, manifest_sha256, expected_digest=approval_sha) == approved,
                "approval_drift")
        try:
            apply_recovery(policy, m, before, staged, operation)
            restored_matches(policy, m, before)
            write_json(operation / "outcome.json", {"status": "FILESYSTEM_CHECKPOINT_VERIFIED_KEEP_HELD"})
        except BaseException:
            journal(operation, {"status": "FAILED_OR_INTERRUPTED_KEEP_HELD"})
            raise
    return {"status": "FILESYSTEM_CHECKPOINT_VERIFIED_KEEP_HELD"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", nargs="?", choices=("inspect", "verify", "capture", "recover"),
                        default="inspect")
    parser.add_argument("--checkpoint")
    parser.add_argument("--manifest-sha256")
    parser.add_argument("--plan", type=Path)
    parser.add_argument("--approval", type=Path)
    parser.add_argument("--confirm")
    args = parser.parse_args()
    try:
        if args.mode in ("inspect", "verify"):
            require(args.approval is None and args.confirm is None
                    and not (args.plan and (args.checkpoint or args.manifest_sha256))
                    and (args.plan is not None or (args.checkpoint and args.manifest_sha256))
                    and not (args.mode == "verify" and args.plan), "inspection_arguments")
            result = inspect(PRODUCTION, args.checkpoint, args.manifest_sha256,
                             args.plan, args.mode == "verify")
        else:
            require(args.approval is not None and args.plan is None, "approval_required")
            os.umask(0o077)
            if args.mode == "capture":
                require(args.checkpoint is None and args.manifest_sha256 is None
                        and args.confirm is None, "capture_arguments")
                result = capture(PRODUCTION, args.approval)
            else:
                result = recover(PRODUCTION, args.checkpoint, args.manifest_sha256,
                                 args.approval, args.confirm)
        print(json.dumps(result, sort_keys=True))
        return 0
    except (CheckpointError, OSError, ValueError, KeyError, TypeError, tarfile.TarError,
            ArithmeticError):
        print("CHECKPOINT_ABORT; keep admissions held; no automatic cleanup or reopening", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
