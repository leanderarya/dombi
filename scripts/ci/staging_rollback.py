#!/usr/bin/env python3
"""Validate and safely extract a staging before-code archive into a fresh directory."""

import argparse
import hashlib
import json
import posixpath
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import tarfile


ROOT_FILES = {
    "artisan", "composer.json", "composer.lock", "bootstrap/app.php",
    "bootstrap/providers.php",
}
TREE_PREFIXES = (
    "app/", "config/", "routes/", "resources/views/",
    "database/migrations/", "vendor/", "public/",
)
DENIED_PARTS = {".git", "storage"}


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_member(member):
    name = member.name
    if member.isdir() and name.endswith("/"):
        name = name[:-1]
    path = PurePosixPath(name)
    if (not name or path.is_absolute() or str(path) != name or
            any(part in {"", ".", ".."} for part in name.split("/")) or
            any(part.startswith(".env") or part in DENIED_PARTS for part in path.parts) or
            name in {"public/storage", "public/hot", "public/build.zip"} or
            name.startswith(("public/storage/", "public/hot/"))):
        raise ValueError("Unsafe archive path")
    if name in ROOT_FILES or name.startswith(TREE_PREFIXES):
        return name
    if member.isdir() and any(prefix.startswith(name + "/") for prefix in TREE_PREFIXES):
        return name
    if member.isdir() and name in {"bootstrap", "database", "public", "resources"}:
        return name
    raise ValueError("Archive path is outside the staging rollback allowlist: " + name)


def safe_symlink(member, name):
    target = PurePosixPath(member.linkname)
    resolved = posixpath.normpath(posixpath.join(posixpath.dirname(name), member.linkname))
    if (not name.startswith("vendor/") or target.is_absolute() or not member.linkname or
            not resolved.startswith("vendor/") or resolved == "vendor"):
        raise ValueError("Unsafe archive symlink")
    return resolved


def _manifest_files(destination, members):
    files = {
        name: sha256_file(destination / name)
        for name, member in members.items()
        if member.isfile() and name.startswith("public/build/")
    }
    manifest_path = destination / "public/build/manifest.json"
    if "public/build/manifest.json" not in files or not files:
        raise ValueError("Rollback archive has no built asset manifest")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict) or not manifest:
        raise ValueError("Invalid built asset manifest")
    for entry in manifest.values():
        if not isinstance(entry, dict):
            raise ValueError("Invalid built asset manifest entry")
        referenced = []
        for field in ("file",):
            if field in entry:
                referenced.append(entry[field])
        for field in ("css", "assets"):
            if field in entry:
                values = entry[field]
                if not isinstance(values, list):
                    raise ValueError("Invalid built asset manifest references")
                referenced.extend(values)
        for reference in referenced:
            path = PurePosixPath(reference) if isinstance(reference, str) else PurePosixPath("/")
            if (path.is_absolute() or str(path) != reference or
                    any(part in {"", ".", ".."} for part in reference.split("/")) or
                    "public/build/" + reference not in files):
                raise ValueError("Built asset manifest references a missing or unsafe file")
    return files


def extract(archive_path, checksum_path, output_path):
    archive_path = Path(archive_path)
    checksum_path = Path(checksum_path)
    output = Path(output_path)
    if archive_path.is_symlink() or checksum_path.is_symlink():
        raise ValueError("Rollback inputs must not be symlinks")
    receipt = checksum_path.read_text(encoding="ascii")
    match = re.fullmatch(r"([a-f0-9]{64})  before-code\.tar\.gz\n?", receipt)
    if not match or archive_path.name != "before-code.tar.gz":
        raise ValueError("Invalid before-code checksum receipt")
    archive_digest = sha256_file(archive_path)
    if archive_digest != match.group(1):
        raise ValueError("Before-code archive checksum mismatch")
    if output.is_symlink():
        raise ValueError("Rollback extraction destination must be fresh")
    if output.exists():
        if (not output.is_dir() or any(output.iterdir()) or
                stat.S_IMODE(output.stat().st_mode) != 0o700):
            raise ValueError("Rollback extraction destination must be fresh")
    else:
        output.mkdir(mode=0o700, parents=False)

    try:
        with tarfile.open(archive_path, mode="r:gz") as archive:
            members = {}
            links = {}
            for member in archive.getmembers():
                name = normalize_member(member)
                if name in members:
                    raise ValueError("Duplicate rollback archive path")
                if not (member.isfile() or member.isdir() or member.issym()):
                    raise ValueError("Unsupported rollback archive member type")
                if member.mode & 0o7000:
                    raise ValueError("Special permission bits are not allowed")
                if (member.isdir() and member.mode & 0o500 != 0o500) or (
                    member.isfile() and member.mode & 0o400 != 0o400
                ):
                    raise ValueError("Archive member is not owner-readable")
                if member.issym():
                    links[name] = safe_symlink(member, name)
                members[name] = member

            for name in members:
                parts = PurePosixPath(name).parts
                if any("/".join(parts[:i]) in links for i in range(1, len(parts))):
                    raise ValueError("Archive member is nested under a symlink")
            required = {
                "artisan", "composer.json", "composer.lock", "bootstrap/app.php",
                "bootstrap/providers.php", "vendor/autoload.php",
                "public/build/manifest.json",
            }
            if not required.issubset(members) or any(not members[name].isfile() for name in required):
                raise ValueError("Rollback archive is incomplete")
            for directory in (
                "app", "config", "routes", "resources/views",
                "database/migrations", "vendor", "public/build",
            ):
                if not any(
                    name == directory and member.isdir() or name.startswith(directory + "/")
                    for name, member in members.items()
                ):
                    raise ValueError("Rollback archive is missing a managed code directory")

            directories = {name for name, member in members.items() if member.isdir()}
            for name in members:
                for parent in PurePosixPath(name).parents:
                    if str(parent) != ".":
                        directories.add(str(parent))
            for name in sorted(directories, key=lambda item: (item.count("/"), item)):
                path = output / name
                path.mkdir(mode=0o755, parents=True, exist_ok=True)

            for name, member in members.items():
                if not member.isfile():
                    continue
                path = output / name
                source = archive.extractfile(member)
                if source is None:
                    raise ValueError("Unreadable rollback archive member")
                with source, path.open("xb") as target:
                    shutil.copyfileobj(source, target)
                path.chmod(member.mode & 0o777)

            for name, member in members.items():
                if member.issym():
                    (output / name).symlink_to(member.linkname)
            for name, target in links.items():
                resolved = (output / target).resolve(strict=True)
                if not resolved.is_relative_to((output / "vendor").resolve()) or not resolved.is_file():
                    raise ValueError("Rollback symlink escapes vendor or has no file target")

            for name, member in members.items():
                if member.isdir():
                    (output / name).chmod(member.mode & 0o777)
            files = _manifest_files(output, members)
            (output / "release.json").write_text(
                json.dumps({"files": files}, sort_keys=True) + "\n", encoding="utf-8",
            )
    except Exception:
        shutil.rmtree(output, ignore_errors=True)
        raise
    print(f"STAGING_ROLLBACK_ARCHIVE_PASS: {len(files)} built asset files")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", required=True)
    parser.add_argument("--checksum-file", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    extract(args.archive, args.checksum_file, args.output)


if __name__ == "__main__":
    main()
