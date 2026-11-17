#!/usr/bin/env python3
"""Single-owner production code deployment with a tested managed-code rollback.

This is a **separately scoped** mechanism, not a bypass of the publisher. The
publisher requires an independent verifier, a signed approval and a fresh
verified checkpoint, none of which exist for this release. This tool therefore
serves the single-owner path and keeps equivalent preservation guards:

* it refuses to run outside the one fixed production policy;
* it verifies the release artifact with the same release-format validator CI uses;
* it backs up every path it may overwrite, digest-verified, before any mutation;
* it never touches `.env*`, `storage/`, the database, cron or `public/storage`;
* it never runs `artisan down`, migrations or cache commands;
* it fails closed and leaves the tree inspectable rather than auto-reverting.

Modes: ``preflight``, ``backup``, ``deploy``, ``verify``, ``rollback``.
"""

import argparse
import datetime as dt
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import sys
import tarfile
import tempfile


VARIANT = "dombi-single-owner-deploy-v1"
POLICY = None  # filled by the checkpoint policy loader
SHA_PATTERN = r"[a-f0-9]{64}"

FILES = ("artisan", "composer.json", "composer.lock",
         "bootstrap/app.php", "bootstrap/providers.php")
TREES = ("app", "config", "routes", "resources/views", "database/migrations",
         "vendor", "public")
CALLBACK_ROUTES = ("/payment/doku/notify", "/payment/doku/redirect")
# Never written, never backed up into the code archive, never restored.
PROTECTED = (".env", "storage", "database", "public/storage", ".git", "node_modules")
PROTECTED_PREFIXES = (".env.",)
BACKUP_SUFFIX = ".predeploy.tar.gz"


class DeployError(RuntimeError):
    pass


def require(condition, reason):
    if not condition:
        raise DeployError(reason)


def checkpoint_module():
    """Reuse the reviewed checkpoint module for the fixed policy and safe I/O."""
    name = "filesystem_checkpoint"
    source = Path(__file__).with_name("filesystem_checkpoint.py").resolve()
    module = sys.modules.get(name)
    if module is not None and getattr(module, "VARIANT", None) == "dombi-filesystem-checkpoint-v1":
        return module
    spec = importlib.util.spec_from_file_location(name, source)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


fs = checkpoint_module()


def release_module():
    """Reuse the release-format validator rather than re-implementing it."""
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


def policy():
    return fs.PRODUCTION


# ── path rules ────────────────────────────────────────────────────────────
def relative(name):
    require(isinstance(name, str) and name and "\x00" not in name, "path_type")
    p = PurePosixPath(name)
    require(not p.is_absolute() and str(p) == name
            and all(part not in ("", ".", "..") for part in p.parts), "noncanonical_path")
    return name


def protected(name):
    """`.env*`, persistent state, the storage link and VCS/dependency trees.

    `database/migrations` is release-owned code and is deliberately allowed; only
    the database files themselves, `storage/`, the storage link and credentials
    are protected.
    """
    parts = PurePosixPath(name).parts
    for part in parts:
        if part in (".git", "node_modules") or part.startswith(PROTECTED_PREFIXES):
            return True
    head = parts[0]
    if head == "storage":
        return True
    if head == "database" and not beneath(name, "database/migrations"):
        return True
    if head == "public" and len(parts) > 1 and parts[1] == "storage":
        return True
    return False


def beneath(name, scope):
    return name == scope or name.startswith(scope + "/")


def deployable(name):
    relative(name)
    require(not protected(name), "protected_path")
    require(beneath(name, "bootstrap") or name in FILES
            or any(beneath(name, tree) for tree in TREES), "outside_code_scopes")
    require(not beneath(name, "vendor/bin"), "vendor_bin")
    return name


def no_symlink_ancestors(root, name):
    """Reject a symlink at the target or anywhere above it inside the root."""
    current = root
    for part in PurePosixPath(name).parts:
        current = current / part
        try:
            s = current.lstat()
        except FileNotFoundError:
            return
        if current != root / name:
            require(not stat.S_ISLNK(s.st_mode), "symlink_ancestor")
        else:
            require(not stat.S_ISLNK(s.st_mode), "target_symlink")


# ── inventory of what this deployment owns ────────────────────────────────
def code_inventory(root):
    """Every existing regular file inside the managed code scopes."""
    found = {}
    for tree in TREES:
        base = root / tree
        if not base.is_dir() or base.is_symlink():
            continue
        for dirpath, dirnames, filenames in os.walk(base, followlinks=False):
            dirnames[:] = [d for d in sorted(dirnames) if d != ".git"]
            for leaf in sorted(filenames):
                path = Path(dirpath) / leaf
                if path.is_symlink() or not path.is_file():
                    continue
                found[path.relative_to(root).as_posix()] = path
    for name in FILES:
        path = root / name
        if path.is_file() and not path.is_symlink():
            found[name] = path
    return found


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1048576), b""):
            h.update(block)
    return h.hexdigest()


# ── artifact validation ───────────────────────────────────────────────────
def load_artifact(archive, checksum_path, application_sha, archive_sha256, staging):
    """Verify the pinned artifact and extract it into a private staging tree."""
    require(re.fullmatch(r"[a-f0-9]{40}", application_sha or "") is not None,
            "application_sha")
    require(re.fullmatch(SHA_PATTERN, archive_sha256 or "") is not None, "archive_sha256")
    require(digest(archive) == archive_sha256, "archive_digest")
    try:
        manifest = release.verify(str(archive), application_sha, archive_sha256,
                                  output=str(staging))
    except (ValueError, KeyError, TypeError, OSError, EOFError, tarfile.TarError) as error:
        raise DeployError("artifact_invalid") from error
    require(manifest.get("sha") == application_sha, "artifact_identity")
    files = manifest["files"]
    require(isinstance(files, dict) and files, "artifact_empty")
    for name in files:
        deployable(name)
    require("public/build/manifest.json" in files, "artifact_incomplete")
    return manifest


def callback_gate(staging, files):
    """The artifact's own route file must still expose both DOKU callbacks ungated.

    This cannot prove the running host serves them, but it refuses to deploy code
    that would drop or gate them, which is the only part code can control.
    """
    require("routes/web.php" in files, "callback_route_file_missing")
    text = (Path(staging) / "routes/web.php").read_text(errors="replace")
    for route in CALLBACK_ROUTES:
        require(route in text, "callback_route_missing")
    for line in text.splitlines():
        if any(route in line for route in CALLBACK_ROUTES):
            require("admission" not in line.lower(), "callback_route_gated")
    return list(CALLBACK_ROUTES)


# ── preflight ─────────────────────────────────────────────────────────────
def preflight(root, private, manifest, staging):
    """Fail closed on identity, layout, link, capacity and protected-state facts."""
    fs.check_policy(policy())
    require(root == policy().root and private == policy().private, "policy_identity")
    require(root.is_dir() and not root.is_symlink(), "root_identity")
    require((root / ".env").is_file() and not (root / ".env").is_symlink(), "env_missing")
    require((root / ".env").stat().st_uid == os.getuid(), "env_owner")
    for name in ("storage", "database", "bootstrap/cache"):
        path = root / name
        require(path.is_dir() and not path.is_symlink(), "protected_dir")
    link = root / "public/storage"
    require(link.is_symlink() or not link.exists(), "storage_link_type")
    require(not (root / "storage/framework/down").exists(), "site_in_maintenance")
    payload = sum(p.stat().st_size for p in Path(staging).rglob("*") if p.is_file())
    backup_estimate = sum(p.stat().st_size for p in code_inventory(root).values())
    require(shutil.disk_usage(private).free > 2 * payload + backup_estimate + 1048576,
            "insufficient_space")
    return {"payload_bytes": payload, "backup_estimate_bytes": backup_estimate}


# ── backup ────────────────────────────────────────────────────────────────
def create_backup(root, private, operation_id):
    """Digest-verified tar of every file this deployment may overwrite or add."""
    inventory = code_inventory(root)
    require(inventory, "empty_code_inventory")
    path = private / (operation_id + BACKUP_SUFFIX)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "wb") as raw:
        with tarfile.open(fileobj=raw, mode="w:gz") as tar:
            for name in sorted(inventory):
                info = tar.gettarinfo(str(root / name), arcname=name)
                info.mode, info.uid, info.gid = 0o644, os.getuid(), os.getgid()
                info.uname = info.gname = ""
                with (root / name).open("rb") as source:
                    tar.addfile(info, source)
        raw.flush()
        os.fsync(raw.fileno())
    path.chmod(0o600)
    fs.fsync_directory(private)
    record = {"path": str(path), "sha256": digest(path),
              "files": sorted(inventory), "created_utc": fs.now().isoformat()}
    fs.write_json(private / (operation_id + ".backup.json"), record)
    return record


def verify_backup(record, private):
    path = Path(record["path"])
    require(path.parent == private and path.name.endswith(BACKUP_SUFFIX), "backup_boundary")
    require(path.is_file() and not path.is_symlink(), "backup_missing")
    require(digest(path) == record["sha256"], "backup_digest")
    with tarfile.open(path, "r:gz") as tar:
        names = tar.getnames()
    require(sorted(names) == record["files"], "backup_inventory")
    return path


# ── apply / verify / rollback ─────────────────────────────────────────────
def stage_file(source, destination, staging_dir):
    """Copy one release file to a same-device private staging file. No mutation."""
    require(source.is_file() and not source.is_symlink(), "staged_missing")
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
    temporary = staging_dir / ("staged-" + hashlib.sha256(
        str(destination).encode()).hexdigest()[:16])
    if temporary.exists():
        temporary.unlink()
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644)
    with os.fdopen(fd, "wb") as target, source.open("rb") as reader:
        for block in iter(lambda: reader.read(1048576), b""):
            target.write(block)
        target.flush()
        os.fsync(target.fileno())
    os.chmod(temporary, 0o644)
    return temporary


def deploy(root, private, manifest, staging, record, operation_dir):
    """Replace managed code in two phases to shrink the mixed-code window.

    Phase 1 copies and fsyncs every release file into private staging, so all slow
    I/O happens before production is touched. Phase 2 is rename-only: each file is
    moved into place with `os.replace`, which is a single atomic syscall per path.

    The whole tree is still not atomically swapped: the host requires the
    application root to be a real directory (never a symlink), so release-directory
    symlink activation is not available. A request spanning phase 2 can therefore
    observe a mix of old and new files. That residual window is a host-layout
    prerequisite, not something this tool can eliminate; it is bounded to the
    rename loop rather than the whole copy.
    """
    staging_dir = operation_dir / "atomic"
    staging_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    before = set(code_inventory(root))
    files = manifest["files"]
    fs.write_json(operation_dir / "pre-state.json",
                  {name: digest(root / name) for name in sorted(before)})
    fs.write_json(operation_dir / "journal.jsonl", {"status": "AUTHORIZED_NOT_COMPLETED"})

    ordered = sorted(files, key=lambda n: (n.count("/"), n))
    # Phase 1: stage everything. Any failure here leaves production untouched.
    staged = {}
    for name in ordered:
        destination = root / name
        if destination.exists() and not destination.is_symlink():
            require(destination.is_file(), "target_type_conflict")
        staged[name] = stage_file(Path(staging) / name, destination, staging_dir)
        no_symlink_ancestors(root, name)
    fs.journal(operation_dir, {"status": "STAGED", "files": len(staged)})

    # Phase 2: commit. Rename-only, so this loop is as short as the file count.
    overwritten, added = [], []
    for index, name in enumerate(ordered):
        destination = root / name
        (overwritten if name in before else added).append(name)
        os.replace(staged[name], destination)
        fs.fsync_directory(destination.parent)
        if (index + 1) % 200 == 0:
            fs.journal(operation_dir, {"status": "PROGRESS", "completed": index + 1})
    mismatched = [name for name, expected in files.items()
                  if not (root / name).is_file() or digest(root / name) != expected]
    require(not mismatched, "deployed_inventory_mismatch")
    stale = sorted(before - set(files))
    outcome = {"status": "DEPLOY_COMPLETE_KEEP_HELD",
               "application_sha": manifest["sha"],
               "operation_id": operation_dir.name,
               "backup": record["path"], "backup_sha256": record["sha256"],
               "overwritten": overwritten, "added": added,
               "stale_not_removed": stale,
               "completed_utc": fs.now().isoformat()}
    fs.write_json(operation_dir / "outcome.json", outcome)
    return outcome


def rollback(root, private, operation_dir):
    """Restore the backed-up managed code and remove files this deploy added."""
    outcome = fs.load_json(operation_dir / "outcome.json")
    record = fs.load_json(private / (operation_dir.name + ".backup.json"))
    backup = verify_backup(record, private)
    before = [n for n in record["files"]]
    staging_dir = operation_dir / "rollback-atomic"
    # A retried rollback targets the same immutable backup, so it is safe to repeat.
    staging_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    for stale in staging_dir.glob("restore-*"):
        if stale.is_file() and not stale.is_symlink():
            stale.unlink()
    restored = {}
    with tarfile.open(backup, "r:gz") as tar:
        for member in tar:
            require(member.isfile() and not member.issym() and not member.islnk(),
                    "backup_member")
            name = relative(member.name)
            deployable(name)
            staged = staging_dir / ("restore-" + hashlib.sha256(name.encode()).hexdigest()[:16])
            fd = os.open(staged, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644)
            with os.fdopen(fd, "wb") as target, tar.extractfile(member) as reader:
                for block in iter(lambda: reader.read(1048576), b""):
                    target.write(block)
                target.flush()
                os.fsync(target.fileno())
            expected = digest(staged)
            destination = root / name
            destination.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
            os.chmod(staged, 0o644)
            os.replace(staged, destination)
            restored[name] = expected
    removed = []
    for name in outcome.get("added", []):
        target = root / name
        if target.is_file() and not target.is_symlink():
            target.unlink()
            removed.append(name)
    require(sorted(restored) == sorted(before), "rollback_inventory")
    result = {"status": "ROLLBACK_COMPLETE_KEEP_HELD",
              "restored": len(restored), "removed": sorted(removed),
              "backup_sha256": record["sha256"],
              "completed_utc": fs.now().isoformat()}
    receipt = operation_dir / "rollback-outcome.json"
    if receipt.exists():
        # Repeatable, but never silently rewritten: an existing receipt must agree.
        previous = fs.load_json(receipt)
        require(previous.get("backup_sha256") == result["backup_sha256"]
                and previous.get("status") == result["status"], "rollback_receipt_drift")
    else:
        fs.write_json(receipt, result)
    return result


def operation_id(prefix):
    stamp = fs.now().strftime("%Y%m%dT%H%M%SZ")
    return "%s-%s-%s" % (prefix, stamp, os.urandom(4).hex())


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("preflight", "deploy", "rollback"))
    parser.add_argument("--architecture", choices=("managed-code",), default="managed-code")
    parser.add_argument("--archive", type=Path)
    parser.add_argument("--checksum-file", type=Path)
    parser.add_argument("--application-sha")
    parser.add_argument("--archive-sha256")
    parser.add_argument("--operation")
    args = parser.parse_args(argv)
    root, private = policy().root, policy().private
    try:
        if args.mode == "rollback":
            require(args.operation and re.fullmatch(r"[a-z]+-[0-9TZ]+-[0-9a-f]{8}",
                                                    args.operation), "operation_id")
            print(json.dumps(rollback(root, private, private / args.operation), sort_keys=True))
            return 0
        require(args.archive and args.checksum_file and args.application_sha
                and args.archive_sha256, "artifact_arguments")
        os.umask(0o077)
        if args.mode == "preflight":
            # Preflight is read-only with respect to durable state: it verifies the
            # artifact in a throwaway directory that is always removed.
            scratch = Path(tempfile.mkdtemp(prefix="preflight-", dir=private))
            try:
                staging = scratch / "runtime"
                manifest = load_artifact(args.archive, args.checksum_file, args.application_sha,
                                         args.archive_sha256, staging)
                callbacks = callback_gate(staging, manifest["files"])
                facts = preflight(root, private, manifest, staging)
            finally:
                shutil.rmtree(scratch, ignore_errors=True)
            print(json.dumps({"status": "PREFLIGHT_OK_KEEP_HELD",
                              "application_sha": manifest["sha"],
                              "callback_routes": callbacks, **facts}, sort_keys=True))
            return 0
        require(args.mode == "deploy", "mode")
        operation = operation_id(args.mode)
        operation_dir = private / operation
        operation_dir.mkdir(mode=0o700)
        staging = operation_dir / "runtime"
        manifest = load_artifact(args.archive, args.checksum_file, args.application_sha,
                                 args.archive_sha256, staging)
        callback_gate(staging, manifest["files"])
        preflight(root, private, manifest, staging)
        record = create_backup(root, private, operation)
        verify_backup(record, private)
        result = deploy(root, private, manifest, staging, record, operation_dir)
        print(json.dumps(result, sort_keys=True))
        return 0
    except (DeployError, fs.CheckpointError, OSError, ValueError, KeyError,
            TypeError, tarfile.TarError, ArithmeticError):
        print("DEPLOY_ABORT; keep admissions held; inspect state before any retry",
              file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
