import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest


SPEC = importlib.util.spec_from_file_location(
    "staging_rollback", Path(__file__).with_name("staging_rollback.py"),
)
rollback = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(rollback)


class StagingRollbackArchiveTests(unittest.TestCase):
    def make_archive(self, directory, extra=()):
        archive = directory / "before-code.tar.gz"
        files = {
            "artisan": b"#!/usr/bin/env php\n",
            "composer.json": b"{}",
            "composer.lock": b"{}",
            "bootstrap/app.php": b"<?php\n",
            "bootstrap/providers.php": b"<?php\n",
            "vendor/autoload.php": b"<?php\n",
            "vendor/AGENTS.md": b"package metadata",
            "app/old.php": b"<?php return 'old';\n",
            "database/migrations/0001.php": b"<?php\n",
            "public/build/manifest.json": json.dumps({
                "app.js": {"file": "assets/app.123.js"},
            }).encode(),
            "public/build/assets/app.123.js": b"old asset",
        }
        entries = [
            ("app", tarfile.DIRTYPE, b""),
            ("bootstrap", tarfile.DIRTYPE, b""),
            ("config", tarfile.DIRTYPE, b""),
            ("database", tarfile.DIRTYPE, b""),
            ("database/migrations", tarfile.DIRTYPE, b""),
            ("public", tarfile.DIRTYPE, b""),
            ("public/build", tarfile.DIRTYPE, b""),
            ("public/build/assets", tarfile.DIRTYPE, b""),
            ("resources", tarfile.DIRTYPE, b""),
            ("resources/views", tarfile.DIRTYPE, b""),
            ("routes", tarfile.DIRTYPE, b""),
            ("vendor", tarfile.DIRTYPE, b""),
            ("vendor/package", tarfile.DIRTYPE, b""),
            ("vendor/package/CLAUDE.md", tarfile.SYMTYPE, b"", "../AGENTS.md"),
        ]
        entries.extend((name, tarfile.REGTYPE, data) for name, data in files.items())
        entries.extend(extra)
        with tarfile.open(archive, "w:gz") as tar:
            for entry in entries:
                name, kind, data = entry[:3]
                member = tarfile.TarInfo(name)
                member.type = kind
                member.mode = 0o755 if kind == tarfile.DIRTYPE else 0o644
                if kind == tarfile.REGTYPE:
                    member.size = len(data)
                    tar.addfile(member, io.BytesIO(data))
                elif kind == tarfile.SYMTYPE:
                    member.linkname = entry[3]
                    tar.addfile(member)
                else:
                    tar.addfile(member)
        checksum = directory / "before-code.sha256"
        checksum.write_text(
            hashlib.sha256(archive.read_bytes()).hexdigest() + "  before-code.tar.gz\n",
            encoding="ascii",
        )
        return archive, checksum

    def test_extracts_verified_archive_and_builds_asset_inventory(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            archive, checksum = self.make_archive(directory)
            output = directory / "fresh"
            rollback.extract(archive, checksum, output)
            release = json.loads((output / "release.json").read_text())
            self.assertEqual(release["files"]["public/build/assets/app.123.js"],
                             hashlib.sha256(b"old asset").hexdigest())
            self.assertEqual((output / "app/old.php").read_bytes(), b"<?php return 'old';\n")
            self.assertTrue((output / "vendor/package/CLAUDE.md").is_symlink())
            self.assertEqual((output / "vendor/package/CLAUDE.md").read_text(),
                             "package metadata")

    def test_rejects_modified_archive_and_nonfresh_destination(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            archive, checksum = self.make_archive(directory)
            archive.write_bytes(archive.read_bytes() + b"tamper")
            with self.assertRaisesRegex(ValueError, "checksum"):
                rollback.extract(archive, checksum, directory / "fresh")

            archive, checksum = self.make_archive(directory)
            existing = directory / "existing"
            existing.mkdir()
            (existing / "unexpected").write_text("not fresh")
            with self.assertRaisesRegex(ValueError, "fresh"):
                rollback.extract(archive, checksum, existing)

    def test_rejects_protected_paths_traversal_and_vendor_escape(self):
        unsafe = [
            ("../outside", tarfile.REGTYPE, b"bad"),
            (".env", tarfile.REGTYPE, b"secret"),
            ("storage/app/data", tarfile.REGTYPE, b"data"),
            (".git/HEAD", tarfile.REGTYPE, b"git"),
            ("vendor/link", tarfile.SYMTYPE, b"", "../../outside"),
        ]
        for entry in unsafe:
            name, kind, data = entry[:3]
            with self.subTest(name=name), tempfile.TemporaryDirectory() as temp:
                directory = Path(temp)
                archive, checksum = self.make_archive(directory, [entry])
                with self.assertRaises(ValueError):
                    rollback.extract(archive, checksum, directory / "fresh")

    def test_rejects_bad_manifest_reference(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            archive, checksum = self.make_archive(directory)
            entries = []
            with tarfile.open(archive, "r:gz") as tar:
                for member in tar.getmembers():
                    content = tar.extractfile(member).read() if member.isfile() else b""
                    if member.name == "public/build/manifest.json":
                        content = b'{"app.js":{"file":"../../outside.js"}}'
                    entries.append((member, content))
            with tarfile.open(archive, "w:gz") as tar:
                for member, content in entries:
                    if member.isfile():
                        member.size = len(content)
                        tar.addfile(member, io.BytesIO(content))
                    else:
                        tar.addfile(member)
            checksum.write_text(
                hashlib.sha256(archive.read_bytes()).hexdigest() + "  before-code.tar.gz\n",
                encoding="ascii",
            )
            with self.assertRaises(ValueError):
                rollback.extract(archive, checksum, directory / "fresh")


if __name__ == "__main__":
    unittest.main()
