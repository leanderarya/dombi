#!/usr/bin/env python3
"""Plan the shared publisher lock and pinned checkpoint tool provisioning.

Plan-only by default. The script resolves and validates every path, computes the
SHA-256 of the local tool, and prints exactly what an apply run would do. It writes
nothing unless ``--apply`` is combined with an explicit action flag, and even then
only inside the operator-owned ``0700`` private directory passed on the command
line. No host, account, root or destination is built in: there is no default target
to act on, so an accidental run without arguments does nothing.

This script provisions two independent artifacts that the checkpoint contract
requires to exist before capture:

* ``dombi-filesystem-publication.lock`` - the shared publisher lock, created as a
  ``0600`` regular single-link file with ``O_CREAT|O_EXCL|O_NOFOLLOW``.
* ``filesystem_checkpoint.py`` - the reviewed tool, published by exclusive staging
  plus an atomic no-overwrite hard link, then verified by digest and mode.

Provisioning is not capture authorization. This script never inspects the
application root, never creates a checkpoint and never runs a publication.
"""

import argparse
from contextlib import contextmanager
import errno
import hashlib
import os
from pathlib import Path
import posixpath
import re
import secrets
import stat
import sys


LOCK_NAME = "dombi-filesystem-publication.lock"
TOOL_NAME = "filesystem_checkpoint.py"
NAME_PATTERN = r"[A-Za-z0-9][A-Za-z0-9._-]{0,120}"
SHA_PATTERN = r"[0-9a-f]{64}"
BLOCK_SIZE = 1048576


class ProvisionError(Exception):
    pass


def require(condition, reason):
    if not condition:
        raise ProvisionError(reason)


def identity(s):
    return (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_nlink, s.st_uid,
            stat.S_IMODE(s.st_mode))


def ancestors(path):
    require(path.is_absolute(), "absolute_path_required")
    for p in reversed([path, *path.parents]):
        s = p.lstat()
        require(not stat.S_ISLNK(s.st_mode), "symlink_ancestor")
        if p != path:
            require(stat.S_ISDIR(s.st_mode), "ancestor_type")


def private_directory(path):
    """Validate the private parent: 0700, operator-owned, no symlink ancestor."""
    ancestors(path)
    s = path.lstat()
    require(stat.S_ISDIR(s.st_mode), "private_not_directory")
    require(s.st_uid == os.geteuid(), "private_owner")
    require(stat.S_IMODE(s.st_mode) == 0o700, "private_mode")
    return s


@contextmanager
def absolute_parent(path):
    """Descriptor for the canonical parent directory, without following links."""
    require(path.is_absolute() and str(path) == posixpath.normpath(str(path)),
            "absolute_path")
    fd = os.open("/", os.O_RDONLY | os.O_DIRECTORY)
    try:
        for component in path.parts[1:-1]:
            next_fd = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                              dir_fd=fd)
            os.close(fd)
            fd = next_fd
        yield fd, path.name
    finally:
        os.close(fd)


def entry(parent, name):
    """No-follow lookup of a directory entry; a broken symlink is still an entry."""
    try:
        return os.stat(name, dir_fd=parent, follow_symlinks=False)
    except FileNotFoundError:
        return None


def digest(fd):
    h = hashlib.sha256()
    os.lseek(fd, 0, os.SEEK_SET)
    for block in iter(lambda: os.read(fd, BLOCK_SIZE), b""):
        h.update(block)
    return h.hexdigest()


def require_private_regular(fd, reason):
    s = os.fstat(fd)
    require(stat.S_ISREG(s.st_mode), reason + "_not_regular")
    require(s.st_nlink == 1, reason + "_not_single_link")
    require(s.st_uid == os.geteuid(), reason + "_owner")
    require(stat.S_IMODE(s.st_mode) == 0o600, reason + "_mode")
    return s


class source_file(object):
    """Read-only handle on the local tool, refusing non-regular or changing files."""

    def __init__(self, path):
        self.path = path
        self.fd = None

    def __enter__(self):
        with absolute_parent(self.path) as (parent, name):
            try:
                self.fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK,
                                  dir_fd=parent)
            except OSError as error:
                if error.errno == errno.ELOOP:
                    raise ProvisionError("tool_symlink")
                if error.errno == errno.EISDIR:
                    raise ProvisionError("tool_not_regular")
                raise
        try:
            s = os.fstat(self.fd)
            require(stat.S_ISREG(s.st_mode), "tool_not_regular")
            require(s.st_nlink == 1, "tool_not_single_link")
            require(not stat.S_IMODE(s.st_mode) & 0o022, "tool_writable_by_others")
            self.sha256 = digest(self.fd)
            end = os.fstat(self.fd)
            require(identity(s) == identity(end), "tool_drift")
        except BaseException:
            os.close(self.fd)
            self.fd = None
            raise
        return self

    def __exit__(self, *exc_info):
        if self.fd is not None:
            os.close(self.fd)
            self.fd = None
        return False


def remove_exact(parent, name, device, inode):
    """Remove only the exact entry this run created, never a substitute."""
    s = entry(parent, name)
    if s is None or (s.st_dev, s.st_ino) != (device, inode):
        return False
    try:
        os.unlink(name, dir_fd=parent)
    except FileNotFoundError:
        return False
    os.fsync(parent)
    return True


def create_lock(private):
    """Create the shared lock exclusively; never touch an existing entry."""
    path = private / LOCK_NAME
    with absolute_parent(path) as (parent, name):
        require(entry(parent, name) is None, "lock_exists")
        fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                     0o600, dir_fd=parent)
        created = os.fstat(fd)
        try:
            require_private_regular(fd, "lock")
            os.fsync(fd)
            opened = os.fstat(fd)
            require(identity(opened) == identity(created), "lock_drift")
            current = entry(parent, name)
            require(current is not None and identity(current) == identity(created),
                    "lock_identity_drift")
            os.fsync(parent)
        except BaseException:
            os.close(fd)
            remove_exact(parent, name, created.st_dev, created.st_ino)
            raise
        os.close(fd)
        after = entry(parent, name)
        require(after is not None and identity(after) == identity(created),
                "lock_identity_drift")
    return {"path": str(path), "mode": 0o600, "nlink": 1}


def verify_published(parent, name, expected_sha256):
    fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
    try:
        s = require_private_regular(fd, "published")
        require(digest(fd) == expected_sha256, "published_digest_mismatch")
        return s
    finally:
        os.close(fd)


def publish_tool(source, private, name):
    """Exclusive staging plus an atomic no-overwrite link; verified before returning."""
    destination = private / name
    with absolute_parent(destination) as (parent, dest):
        require(entry(parent, dest) is None, "tool_destination_exists")
        staging = ".%s.staging-%s" % (dest, secrets.token_hex(8))
        staging_fd = os.open(staging, os.O_WRONLY | os.O_CREAT | os.O_EXCL
                             | os.O_NOFOLLOW, 0o600, dir_fd=parent)
        created = os.fstat(staging_fd)
        linked = False
        try:
            h = hashlib.sha256()
            os.lseek(source.fd, 0, os.SEEK_SET)
            with os.fdopen(staging_fd, "wb", closefd=False) as out:
                for block in iter(lambda: os.read(source.fd, BLOCK_SIZE), b""):
                    h.update(block)
                    out.write(block)
                out.flush()
                os.fsync(out.fileno())
            require(h.hexdigest() == source.sha256, "staged_digest_mismatch")
            staged = require_private_regular(staging_fd, "staged")
            require(identity(staged) == identity(os.fstat(staging_fd)), "staged_drift")
            try:
                os.link(staging, dest, src_dir_fd=parent, dst_dir_fd=parent,
                        follow_symlinks=False)
            except NotImplementedError:
                raise ProvisionError("atomic_link_unsupported")
            linked = True
            os.unlink(staging, dir_fd=parent)
            published = verify_published(parent, dest, source.sha256)
            os.fsync(parent)
            require(identity(published)
                    == identity(verify_published(parent, dest, source.sha256)),
                    "tool_identity_drift")
        except BaseException:
            os.close(staging_fd)
            if linked:
                remove_exact(parent, dest, created.st_dev, created.st_ino)
            try:
                os.unlink(staging, dir_fd=parent)
            except FileNotFoundError:
                pass
            raise
        os.close(staging_fd)
    return {"path": str(destination), "sha256": source.sha256, "mode": 0o600,
            "nlink": 1}


def requested_path(value, reason):
    """Absolute, canonical, link-free-input path argument; no normalisation."""
    require(value.startswith("/"), "absolute_path_required")
    require(value == posixpath.normpath(value), reason)
    return Path(value)


def plan(private, tool, name, expected_sha256, create, publish):
    """Validate every precondition without writing, and describe the apply run."""
    s = private_directory(private)
    lines = [
        "PLAN profile=private mode=%04o owner=%d device=%d path=%s"
        % (stat.S_IMODE(s.st_mode), s.st_uid, s.st_dev, private),
        "PLAN writes=0",
    ]
    with source_file(tool) as source:
        require(expected_sha256 is None or expected_sha256 == source.sha256,
                "tool_digest_mismatch")
        lines.append("PLAN tool=%s sha256=%s" % (tool, source.sha256))
    if create:
        path = private / LOCK_NAME
        with absolute_parent(path) as (parent, entry_name):
            present = entry(parent, entry_name)
        require(present is None, "lock_exists")
        lines.append("PLAN action=create-lock path=%s mode=0600" % path)
    if publish:
        destination = private / name
        with absolute_parent(destination) as (parent, dest_name):
            present = entry(parent, dest_name)
        require(present is None, "tool_destination_exists")
        lines.append("PLAN action=publish-tool path=%s mode=0600" % destination)
    lines.append("RESULT PLAN_ONLY_NO_WRITES")
    return lines


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Plan or apply provisioning of the shared publisher lock and the "
                    "pinned checkpoint tool. Dry-run unless --apply.")
    parser.add_argument("--tool", required=True,
                        help="local reviewed filesystem_checkpoint.py to publish")
    parser.add_argument("--private", required=True,
                        help="existing operator-owned 0700 private directory")
    parser.add_argument("--name", default=TOOL_NAME,
                        help="destination filename inside --private")
    parser.add_argument("--expected-tool-sha256",
                        help="pin the local tool digest; a mismatch aborts")
    parser.add_argument("--app-root", required=True,
                        help="application root that must not overlap --private")
    parser.add_argument("--create-lock", action="store_true",
                        help="create %s when applying" % LOCK_NAME)
    parser.add_argument("--publish-tool", action="store_true",
                        help="publish the tool when applying")
    parser.add_argument("--apply", action="store_true",
                        help="perform the planned writes (default: plan only)")
    args = parser.parse_args(argv)

    explicit = args.create_lock or args.publish_tool
    # A plan may describe both actions; an apply must name the actions it performs.
    create, publish = args.create_lock, args.publish_tool
    if not explicit and not args.apply:
        create = publish = True
    if args.apply and not explicit:
        print("PROVISION_REFUSED reason=explicit_action_required", file=sys.stderr)
        return 1
    try:
        require(re.fullmatch(NAME_PATTERN, args.name) and args.name != LOCK_NAME,
                "destination_name")
        expected = args.expected_tool_sha256
        require(expected is None or re.fullmatch(SHA_PATTERN, expected),
                "expected_digest_format")
        private = requested_path(args.private, "noncanonical_private")
        tool = requested_path(args.tool, "noncanonical_tool")
        root = requested_path(args.app_root, "noncanonical_app_root")
        require(str(private) != str(root)
                and not str(private).startswith(str(root) + "/")
                and not str(root).startswith(str(private) + "/"),
                "private_boundary")
        if not args.apply:
            for line in plan(private, tool, args.name, expected, create, publish):
                print(line)
            return 0
        private_directory(private)
        previous = os.umask(0o077)
        try:
            with source_file(tool) as source:
                require(expected is None or expected == source.sha256,
                        "tool_digest_mismatch")
                if create:
                    record = create_lock(private)
                    print("APPLY action=create-lock path=%s mode=%04o nlink=%d"
                          % (record["path"], record["mode"], record["nlink"]))
                if publish:
                    record = publish_tool(source, private, args.name)
                    print("APPLY action=publish-tool path=%s sha256=%s mode=%04o "
                          "nlink=%d" % (record["path"], record["sha256"],
                                        record["mode"], record["nlink"]))
        finally:
            os.umask(previous)
        print("RESULT PROVISIONED create_lock=%s publish_tool=%s"
              % ("done" if create else "skipped",
                 "done" if publish else "skipped"))
        return 0
    except ProvisionError as error:
        print("PROVISION_ABORT reason=%s" % error, file=sys.stderr)
        return 1
    except OSError as error:
        print("PROVISION_ABORT reason=io_error errno=%s" % (error.errno,),
              file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
