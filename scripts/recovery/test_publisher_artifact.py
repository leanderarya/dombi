"""Synthetic fixtures only; the fixed production policy is never accessed."""

import copy
import datetime as dt
import gzip
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import pwd
import sys
import tarfile
import tempfile
import unittest
from unittest import mock
import uuid


SOURCE = Path(__file__).with_name("code_publisher.py").resolve()
SPEC = importlib.util.spec_from_file_location("code_publisher_artifact", SOURCE)
publisher = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = publisher
SPEC.loader.exec_module(publisher)

fs = publisher.fs


class ArtifactPublisherTests(unittest.TestCase):
    def setUp(self):
        temporary = Path(tempfile.gettempdir()).resolve()
        preferred = temporary / "opencode"
        self.temporary = tempfile.TemporaryDirectory(
            prefix="dombi-artifact-synthetic-", dir=preferred if preferred.is_dir() else temporary,
        )
        self.addCleanup(self.temporary.cleanup)
        if not hasattr(os, "listxattr"):
            self.adapter = mock.patch.object(os, "listxattr", return_value=[], create=True)
            self.adapter.start()
            self.addCleanup(self.adapter.stop)
        self.acl = mock.patch.object(fs, "require_no_acl", lambda *_: None)
        self.acl.start()
        self.addCleanup(self.acl.stop)
        base = Path(self.temporary.name)
        self.root, self.private = base / "app", base / "private"
        self.root.mkdir(mode=0o755)
        self.private.mkdir(mode=0o700)
        self.policy = fs.Policy(self.root, self.private, pwd.getpwuid(os.getuid()).pw_name)
        for name in ("app", "public/build", "bootstrap/cache", "config", "vendor",
                     "storage/app/public", "storage/framework", "database"):
            (self.root / name).mkdir(parents=True, exist_ok=True)
        self.files = {
            "app/service.php": b"synthetic baseline service\n",
            "app/cache.php": b"synthetic baseline cache\n",
            "artisan": b"synthetic entrypoint, never executed\n",
            "composer.json": b'{"synthetic": true}\n',
            "composer.lock": b"synthetic lock\n",
            "bootstrap/app.php": b"synthetic bootstrap\n",
            "bootstrap/providers.php": b"synthetic providers\n",
            "public/build/manifest.json": b'{"synthetic": true}\n',
            "public/build/asset.js": b"synthetic baseline asset\n",
            "vendor/autoload.php": b"synthetic vendor, never executed\n",
            "config/app.php": b"synthetic configuration source\n",
        }
        for name, content in self.files.items():
            (self.root / name).write_bytes(content)
        for name, content in {
            ".env": b"SYNTHETIC_NOT_A_CREDENTIAL=true\n",
            "bootstrap/cache/config.php": b"synthetic generated cache\n",
            "storage/framework/down": b"synthetic containment marker\n",
            "storage/app/public/upload.txt": b"synthetic upload\n",
            "database/local.sqlite": b"not a real database\n",
        }.items():
            (self.root / name).write_bytes(content)
        (self.root / "public/storage").symlink_to("../storage/app/public")
        (self.root / "app/link.php").symlink_to("service.php")
        self.boundaries = {
            "managed_scopes": ["app", "artisan", "composer.json", "composer.lock",
                               "public", "bootstrap/app.php", "bootstrap/providers.php",
                               "config", "vendor"],
            "protected_paths": ["database"],
            "database_paths": [],
            "protected_links": {"public/storage": "../storage/app/public"},
        }
        self.policy.lock.write_bytes(b"")
        self.policy.lock.chmod(0o600)
        self.checkpoint_id = "dombi-fs-" + fs.now().strftime("%Y%m%dT%H%M%SZ-") + uuid.uuid4().hex
        self.manifest_sha = None
        self.sequence = 0
        for path in sorted(self.root.rglob("*"), key=lambda p: len(p.parts), reverse=True):
            os.utime(path, ns=(1700000000123456789, 1700000000123456789), follow_symlinks=False)

    # ── fixture helpers ────────────────────────────────────────────────
    @property
    def directory(self):
        return self.private / self.checkpoint_id

    def approval(self, kind, **overrides):
        self.sequence += 1
        current = fs.now()
        observed = fs.inventory(self.policy, self.boundaries)
        value = {
            "operation": kind, "checkpoint_id": self.checkpoint_id,
            "operator": self.policy.account,
            "independent_verifier": "synthetic-independent-reviewer",
            "tool_sha256": fs.tool_digest(), "candidate": fs.CANDIDATE,
            "host_inventory_reference": "synthetic-host-inventory",
            "root_identity": fs.identity(self.policy, "synthetic-host-inventory"),
            "issued_utc": current.isoformat(),
            "expires_utc": (current + dt.timedelta(minutes=10)).isoformat(),
            "identity_verified_utc": current.isoformat(),
            "evidence": {key: "synthetic-only-" + key for key in fs.EVIDENCE},
            "publisher_lock_path": str(self.policy.lock),
            "effective_identity": {
                "environment": "production", "url": "https://app.dombicenter.com",
                "database": "u399215191_dombi_pr_1023",
            },
            "observed_state_sha256": fs.object_digest(observed),
            "boundaries": copy.deepcopy(self.boundaries),
            **{key: True for key in fs.FLAGS},
        }
        if kind == publisher.OPERATION:
            value["manifest_sha256"] = self.manifest_sha
            value["publisher_sha256"] = publisher.publisher_digest()
            value["volatile_policy"] = publisher.volatile_policy()
            value["prior_operations"] = publisher.prior_operation_lineage(self.directory)
        value.update(overrides)
        path = self.private / ("synthetic-approval-" + str(self.sequence) + ".json")
        fs.write_json(path, value)
        return path

    def capture(self):
        result = fs.capture(self.policy, self.approval("filesystem-checkpoint-capture"))
        self.manifest_sha = result["manifest_sha256"]
        return fs.load_json(self.directory / "manifest.json")

    def build_artifact(self, contents, application_sha="a" * 40, label="artifact"):
        """Write a schema-1 release artifact + checksum receipt into the private dir."""
        manifest = {"schema": 1, "sha": application_sha,
                    "files": {name: hashlib.sha256(data).hexdigest()
                              for name, data in contents.items()}}
        payload = dict(contents)
        payload["release.json"] = (json.dumps(manifest, sort_keys=True, indent=2) + "\n").encode()
        archive = self.private / (label + ".tar.gz")
        with archive.open("xb") as raw:
            with gzip.GzipFile(filename="", fileobj=raw, mode="wb", mtime=0) as compressed:
                with tarfile.open(fileobj=compressed, mode="w") as tar:
                    for name, data in sorted(payload.items()):
                        member = tarfile.TarInfo(name)
                        member.size, member.mode = len(data), 0o644
                        tar.addfile(member, io.BytesIO(data))
        archive.chmod(0o600)
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        checksum = self.private / (label + ".sha256")
        checksum.write_bytes((digest + "  release.tar.gz\n").encode())
        checksum.chmod(0o600)
        return archive, checksum, digest, manifest["files"]

    def artifact_approval(self, archive_sha, files, **overrides):
        manifest = fs.load_json(self.directory / "manifest.json")
        observed = fs.inventory(self.policy, self.boundaries)
        plan = publisher.artifact_plan(manifest, observed, files)
        fields = {
            "artifact_application_sha": "a" * 40,
            "artifact_sha256": archive_sha,
            "artifact_entries_sha256": fs.object_digest(files),
            "publication_plan_sha256": publisher.plan_digest(plan),
            "removals": plan["removals"],
        }
        fields.update(overrides)
        return self.approval(publisher.OPERATION, **fields)

    def publish_artifact(self, archive, checksum, approval):
        return publisher.publish_artifact(
            self.policy, self.checkpoint_id, self.manifest_sha, approval, archive, checksum)

    def candidate(self, **changes):
        """Baseline artifact contents with per-path edits; None means delete."""
        contents = dict(self.files)
        for name, value in changes.items():
            if value is None:
                contents.pop(name, None)
            else:
                contents[name] = value
        return contents

    def snapshot(self, path):
        result = {}
        for item in [path, *sorted(path.rglob("*"))]:
            s = item.lstat()
            value = (s.st_mode, s.st_uid, s.st_gid, s.st_size, s.st_mtime_ns)
            if item.is_symlink():
                value += (os.readlink(item),)
            elif item.is_file():
                value += (item.read_bytes(),)
            result[str(item.relative_to(path))] = value
        return result

    def managed(self):
        return {n: e for n, e in fs.inventory(self.policy, self.boundaries).items()
                if e["class"] == "managed"}

    # ── normal publication ─────────────────────────────────────────────
    def test_publishes_additions_replacements_and_removals(self):
        manifest = self.capture()
        contents = self.candidate(**{
            "app/service.php": b"synthetic candidate service\n",
            "app/new.php": b"synthetic added file\n",
            "app/cache.php": None,
        })
        archive, checksum, digest, files = self.build_artifact(contents)
        result = self.publish_artifact(archive, checksum, self.artifact_approval(digest, files))
        self.assertEqual(result["status"], publisher.SUCCESS)
        self.assertEqual(result["additions"], ["app/new.php"])
        self.assertEqual(result["replacements"], ["app/service.php"])
        self.assertEqual(result["removals"], ["app/cache.php"])
        self.assertEqual((self.root / "app/service.php").read_bytes(),
                         b"synthetic candidate service\n")
        self.assertEqual((self.root / "app/new.php").read_bytes(), b"synthetic added file\n")
        self.assertFalse((self.root / "app/cache.php").exists())
        after = self.managed()
        self.assertEqual({n for n, e in after.items() if e["type"] == "file"}, set(files))
        for name, entry in after.items():
            if entry["type"] == "file":
                self.assertEqual(entry["sha256"], files[name])
                self.assertEqual(entry["mode"], 0o644)
        self.assertEqual(manifest["inventory"]["app/link.php"]["target"], "service.php")
        self.assertTrue((self.root / "app/link.php").is_symlink())
        self.assertTrue((self.root / "storage/framework/down").exists())
        self.assertTrue((self.root / ".env").exists())

    def test_unchanged_artifact_publishes_nothing(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact(self.candidate())
        result = self.publish_artifact(archive, checksum, self.artifact_approval(digest, files))
        self.assertEqual((result["additions"], result["replacements"], result["removals"]),
                         ([], [], []))
        self.assertEqual(
            self.managed()["app/service.php"]["sha256"], files["app/service.php"])

    def test_replacement_repairs_mode_and_metadata(self):
        self.capture()
        (self.root / "app/service.php").chmod(0o600)
        archive, checksum, digest, files = self.build_artifact(self.candidate())
        result = self.publish_artifact(archive, checksum, self.artifact_approval(digest, files))
        self.assertEqual(result["replacements"], ["app/service.php"])
        self.assertEqual(self.managed()["app/service.php"]["mode"], 0o644)

    def test_protected_state_survives_publication(self):
        self.capture()
        before = fs.stable_protected(fs.inventory(self.policy, self.boundaries))
        (self.root / ".env").write_bytes(b"SYNTHETIC_ROTATED=true\n")
        (self.root / "storage/app/public/new-upload").write_bytes(b"synthetic new upload\n")
        before = fs.stable_protected(fs.inventory(self.policy, self.boundaries))
        archive, checksum, digest, files = self.build_artifact(
            self.candidate(**{"app/service.php": b"synthetic candidate service\n"}))
        self.publish_artifact(archive, checksum, self.artifact_approval(digest, files))
        self.assertEqual(before,
                         fs.stable_protected(fs.inventory(self.policy, self.boundaries)))
        with tarfile.open(archive) as tar:
            names = tar.getnames()
        self.assertFalse(any(n.startswith(("storage/", "database/")) or n == ".env"
                             for n in names))

    # ── rejection cases ────────────────────────────────────────────────
    def test_artifact_identity_mismatch_is_rejected_without_mutation(self):
        self.capture()
        contents = self.candidate(**{"app/service.php": b"synthetic candidate service\n"})
        archive, checksum, digest, files = self.build_artifact(contents)
        approval = self.artifact_approval(digest, files, artifact_sha256="0" * 64)
        before = self.snapshot(self.root)
        with self.assertRaises(fs.CheckpointError):
            self.publish_artifact(archive, checksum, approval)
        self.assertEqual(before, self.snapshot(self.root))
        self.assertFalse(any(self.directory.glob("publication-*")))

    def test_checksum_receipt_must_match_approved_archive(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact(self.candidate())
        other, _, other_digest, _ = self.build_artifact(
            self.candidate(**{"app/other.php": b"synthetic other artifact\n"}),
            application_sha="b" * 40, label="other")
        before = self.snapshot(self.root)
        # Receipt matches the approval but not the archive bytes actually supplied.
        mismatched = self.private / "mismatched.sha256"
        mismatched.write_bytes((other_digest + "  release.tar.gz\n").encode())
        mismatched.chmod(0o600)
        with self.assertRaisesRegex(fs.CheckpointError, "artifact_pin"):
            self.publish_artifact(archive, mismatched,
                                  self.artifact_approval(other_digest, files))
        self.assertEqual(before, self.snapshot(self.root))

    def test_checksum_receipt_must_match_the_archive_pin(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact(self.candidate())
        _, _, other_digest, _ = self.build_artifact(
            self.candidate(**{"app/other.php": b"synthetic other artifact\n"}),
            application_sha="b" * 40, label="other")
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "artifact_checksum_receipt"):
            self.publish_artifact(archive, checksum,
                                  self.artifact_approval(other_digest, files))
        self.assertEqual(before, self.snapshot(self.root))

    def test_artifact_member_outside_managed_scope_is_rejected(self):
        self.capture()
        contents = self.candidate()
        contents["storage/sneaky.php"] = b"synthetic escape\n"
        archive, checksum, digest, files = self.build_artifact(contents)
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "artifact_path_outside_managed_scope"):
            self.publish_artifact(archive, checksum, self.artifact_approval(digest, files))
        self.assertEqual(before, self.snapshot(self.root))

    def test_artifact_member_inside_protected_scope_is_rejected(self):
        self.capture()
        contents = self.candidate()
        contents["database/migrations/sneaky.php"] = b"synthetic protected write\n"
        archive, checksum, digest, files = self.build_artifact(contents)
        before = self.snapshot(self.root)
        with self.assertRaises(fs.CheckpointError):
            self.publish_artifact(archive, checksum, self.artifact_approval(digest, files))
        self.assertEqual(before, self.snapshot(self.root))

    def test_artifact_inventory_digest_is_approved(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact(
            self.candidate(**{"app/service.php": b"synthetic candidate service\n"}))
        approval = self.artifact_approval(digest, files,
                                          artifact_entries_sha256="0" * 64)
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "approval_artifact_inventory"):
            self.publish_artifact(archive, checksum, approval)
        self.assertEqual(before, self.snapshot(self.root))

    def test_removals_must_be_explicitly_approved(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact(
            self.candidate(**{"app/cache.php": None,
                              "app/service.php": b"synthetic candidate service\n"}))
        approval = self.artifact_approval(digest, files, removals={})
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "approval_removals"):
            self.publish_artifact(archive, checksum, approval)
        self.assertEqual(before, self.snapshot(self.root))

    def test_unapproved_plan_digest_is_rejected(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact(
            self.candidate(**{"app/service.php": b"synthetic candidate service\n"}))
        approval = self.artifact_approval(digest, files, publication_plan_sha256="0" * 64)
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "approval_publication_plan"):
            self.publish_artifact(archive, checksum, approval)
        self.assertEqual(before, self.snapshot(self.root))

    def test_artifact_type_conflict_is_rejected(self):
        self.capture()
        contents = self.candidate()
        contents["app/link.php"] = b"regular file over a managed symlink\n"
        archive, checksum, digest, files = self.build_artifact(contents)
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "target_type_conflict"):
            self.publish_artifact(archive, checksum, self.artifact_approval(digest, files))
        self.assertEqual(before, self.snapshot(self.root))
        self.assertTrue((self.root / "app/link.php").is_symlink())

    def test_unbaselined_stale_file_cannot_be_removed(self):
        self.capture()
        (self.root / "app/unbaselined.php").write_bytes(b"synthetic stale file\n")
        contents = self.candidate()
        archive, checksum, digest, files = self.build_artifact(contents)
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "unbaselined_target_removal"):
            self.publish_artifact(archive, checksum, self.artifact_approval(digest, files))
        self.assertEqual(before, self.snapshot(self.root))
        self.assertTrue((self.root / "app/unbaselined.php").exists())

    def test_approval_must_be_fresh(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact(self.candidate())
        approval = self.artifact_approval(
            digest, files, expires_utc=(fs.now() - dt.timedelta(seconds=1)).isoformat())
        before = self.snapshot(self.root)
        with self.assertRaises(fs.CheckpointError):
            self.publish_artifact(archive, checksum, approval)
        self.assertEqual(before, self.snapshot(self.root))

    # ── interruption and recovery boundaries ──────────────────────────
    def test_interruption_journals_and_requires_fresh_approval(self):
        self.capture()
        contents = self.candidate(**{
            "app/service.php": b"synthetic candidate service\n",
            "app/new.php": b"synthetic added file\n",
        })
        archive, checksum, digest, files = self.build_artifact(contents)
        approval = self.artifact_approval(digest, files)
        replace, count = os.replace, 0

        def interrupt(*args, **kwargs):
            nonlocal count
            count += 1
            if count == 2:
                raise KeyboardInterrupt("synthetic publication interruption")
            return replace(*args, **kwargs)

        with mock.patch.object(fs.os, "replace", side_effect=interrupt):
            with self.assertRaises(KeyboardInterrupt):
                self.publish_artifact(archive, checksum, approval)
        operation = self.directory / ("publication-" + fs.file_digest(approval))
        self.assertFalse((operation / "outcome.json").exists())
        self.assertIn(b"FAILED_OR_INTERRUPTED_KEEP_HELD", (operation / "journal.jsonl").read_bytes())
        with self.assertRaises(fs.CheckpointError):
            self.publish_artifact(archive, checksum, approval)
        with self.assertRaisesRegex(fs.CheckpointError, "unapproved_prior_publications"):
            self.publish_artifact(archive, checksum, self.artifact_approval(
                digest, files, prior_operations={"publication": {}, "recovery": {}}))
        fresh = self.artifact_approval(digest, files)
        self.assertEqual(self.publish_artifact(archive, checksum, fresh)["status"],
                         publisher.SUCCESS)
        self.assertEqual(len(list(self.directory.glob("publication-*"))), 2)

    def test_unfinished_prior_recovery_blocks_publication(self):
        self.capture()
        operation = self.directory / ("recovery-" + "d" * 64)
        operation.mkdir(mode=0o700)
        (operation / "authorization.json").write_bytes(b"{}")
        (operation / "journal.jsonl").write_bytes(b"{}\n")
        archive, checksum, digest, files = self.build_artifact(self.candidate())
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "incomplete_prior_recovery"):
            self.publish_artifact(archive, checksum, self.artifact_approval(digest, files))
        self.assertEqual(before, self.snapshot(self.root))

    def test_busy_shared_lock_prevents_publication(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact(
            self.candidate(**{"app/service.php": b"synthetic candidate service\n"}))
        approval = self.artifact_approval(digest, files)
        before = self.snapshot(self.root)
        with fs.publisher_lock(self.policy):
            with self.assertRaises(BlockingIOError):
                self.publish_artifact(archive, checksum, approval)
        self.assertEqual(before, self.snapshot(self.root))
        self.assertFalse(any(self.directory.glob("publication-*")))

    def test_checksum_receipt_format_is_validated(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact(self.candidate())
        malformed = self.private / "malformed.sha256"
        malformed.write_bytes((digest + "  wrong-name.tar.gz\n").encode())
        malformed.chmod(0o600)
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "artifact_checksum_receipt"):
            self.publish_artifact(archive, malformed,
                                  self.artifact_approval(digest, files))
        self.assertEqual(before, self.snapshot(self.root))

    def test_checksum_receipt_must_be_private(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact(self.candidate())
        checksum.chmod(0o644)
        before = self.snapshot(self.root)
        with self.assertRaises(fs.CheckpointError):
            self.publish_artifact(archive, checksum,
                                  self.artifact_approval(digest, files))
        self.assertEqual(before, self.snapshot(self.root))

    def test_artifact_member_cannot_escape_through_a_symlinked_parent(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact(
            self.candidate(**{"app/added.php": b"synthetic added file\n"}))
        target = self.root / "app"
        target.rename(self.root / "app-real")
        target.symlink_to("app-real")
        before = self.snapshot(self.root)
        with self.assertRaises(fs.CheckpointError):
            self.publish_artifact(archive, checksum, self.artifact_approval(digest, files))
        self.assertEqual(before, self.snapshot(self.root))

    def test_artifact_must_live_inside_the_private_directory(self):
        self.capture()
        base = Path(self.temporary.name) / "outside"
        base.mkdir(mode=0o700)
        archive = base / "release.tar.gz"
        archive.write_bytes(b"not a release")
        archive.chmod(0o600)
        checksum = base / "release.sha256"
        checksum.write_bytes(b"0" * 64 + b"  release.tar.gz\n")
        checksum.chmod(0o600)
        with self.assertRaisesRegex(fs.CheckpointError, "artifact_boundary"):
            self.publish_artifact(archive, checksum,
                                  self.artifact_approval("0" * 64, {}))

    def test_production_identity_is_refused(self):
        with self.assertRaisesRegex(fs.CheckpointError, "production_execution_disabled"):
            publisher.publish_artifact(fs.PRODUCTION, self.checkpoint_id, self.manifest_sha,
                                       Path("/nonexistent"), Path("/nonexistent"),
                                       Path("/nonexistent"))
        with self.assertRaisesRegex(fs.CheckpointError, "production_execution_disabled"):
            publisher.publish_artifact_file(fs.PRODUCTION, "app/service.php", "0" * 64,
                                            Path("/nonexistent"), {}, None, {})

    def test_cli_still_refuses_publication(self):
        self.assertEqual(publisher.main([]), 1)


if __name__ == "__main__":
    unittest.main()
