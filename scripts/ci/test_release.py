import contextlib
import gzip
import io
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest

import release


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / 'repo'
        self.repo.mkdir()
        for name in (*release.FILES, 'app/Example.php', 'public/index.php', 'storage/secret', '.env', 'public/build.zip'):
            path = self.repo / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(name)
        for args in (('init', '-q'), ('add', '.'), ('-c', 'user.name=CI', '-c', 'user.email=ci@example.invalid', 'commit', '-qm', 'fixture')):
            subprocess.run(['git', '-C', str(self.repo), *args], check=True, capture_output=True)
        self.sha = subprocess.check_output(['git', '-C', str(self.repo), 'rev-parse', 'HEAD'], text=True).strip()
        self.vendor = self.root / 'vendor'
        self.vendor.mkdir()
        (self.vendor / 'autoload.php').write_text('<?php')
        build = self.repo / 'public/build'
        build.mkdir()
        (build / 'manifest.json').write_text('{}')
        (build / 'app.js').write_text('built')
        self.output = self.root / 'release'
        with contextlib.redirect_stdout(io.StringIO()):
            release.pack(self.repo, self.vendor, self.sha, self.output)
        self.archive = self.output / 'release.tar.gz'
        self.checksum = (self.output / 'release.sha256').read_text().split()[0]

    def verify(self, **kwargs):
        return release.verify(self.archive, kwargs.pop('sha', self.sha), self.checksum, **kwargs)

    def rewrite(self, change):
        with tarfile.open(self.archive) as tar:
            members = [(m, tar.extractfile(m).read()) for m in tar.getmembers()]
        members = change(members)
        with tarfile.open(self.archive, 'w:gz') as tar:
            for member, data in members:
                member.size = len(data)
                tar.addfile(member, io.BytesIO(data) if member.isfile() else None)
        self.checksum = release.digest(self.archive.read_bytes())

    def test_roundtrip_and_protected_exclusions(self):
        output = self.root / 'extracted'
        manifest = self.verify(output=output)
        self.assertEqual((output / 'app/Example.php').read_text(), 'app/Example.php')
        for name in ('.env', 'storage/secret', 'public/build.zip'):
            self.assertNotIn(name, manifest['files'])

    def test_deterministic_no_overwrite(self):
        other = self.root / 'other'
        with contextlib.redirect_stdout(io.StringIO()):
            release.pack(self.repo, self.vendor, self.sha, other)
        self.assertEqual(self.archive.read_bytes(), (other / 'release.tar.gz').read_bytes())
        with self.assertRaises(FileExistsError):
            release.pack(self.repo, self.vendor, self.sha, self.output)

    def test_dirty_source_rejected(self):
        (self.repo / 'app/Example.php').write_text('dirty user work')
        with self.assertRaises(subprocess.CalledProcessError):
            release.pack(self.repo, self.vendor, self.sha, self.root / 'dirty')

    def test_checksum_corruption(self):
        self.archive.write_bytes(self.archive.read_bytes() + b'corrupt')
        with self.assertRaisesRegex(ValueError, 'checksum'):
            self.verify()

    def test_sha_mismatch(self):
        with self.assertRaisesRegex(ValueError, 'identity'):
            self.verify(sha='0' * 40)

    def test_content_corruption(self):
        self.rewrite(lambda members: [(m, b'bad' if m.name == 'artisan' else data) for m, data in members])
        with self.assertRaisesRegex(ValueError, 'checksum'):
            self.verify()

    def test_inventory_missing(self):
        self.rewrite(lambda members: [(m, data) for m, data in members if m.name != 'artisan'])
        with self.assertRaisesRegex(ValueError, 'inventory'):
            self.verify()

    def test_duplicate(self):
        self.rewrite(lambda members: members + [members[0]])
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            self.verify()

    def test_unsafe_members(self):
        for name, kind in (('../escape', tarfile.REGTYPE), ('.env', tarfile.REGTYPE),
                           ('bootstrap/cache/config.php', tarfile.REGTYPE),
                           ('vendor/package/.git/config', tarfile.REGTYPE),
                           ('storage/app/upload', tarfile.REGTYPE),
                           ('public/storage/link', tarfile.SYMTYPE),
                           ('vendor/link', tarfile.LNKTYPE)):
            with self.subTest(name=name):
                original = self.archive.read_bytes()
                member = tarfile.TarInfo(name)
                member.type, member.mode = kind, 0o644
                self.rewrite(lambda members: members + [(member, b'')])
                with self.assertRaisesRegex(ValueError, 'Unsafe'):
                    self.verify()
                self.archive.write_bytes(original)
                self.checksum = release.digest(original)

    def test_extract_requires_new_destination(self):
        with self.assertRaises(FileExistsError):
            self.verify(output=self.repo)

    def test_internal_vendor_file_link_materialized_but_escape_rejected(self):
        (self.vendor / 'linked.php').symlink_to(self.vendor / 'autoload.php')
        output = self.root / 'linked-release'
        with contextlib.redirect_stdout(io.StringIO()):
            release.pack(self.repo, self.vendor, self.sha, output)
        with tarfile.open(output / 'release.tar.gz') as tar:
            self.assertTrue(tar.getmember('vendor/linked.php').isfile())
        (self.vendor / 'escape.php').symlink_to(self.repo / '.env')
        with self.assertRaisesRegex(ValueError, 'symlink'):
            release.pack(self.repo, self.vendor, self.sha, self.root / 'escape-release')


if __name__ == '__main__':
    unittest.main()
