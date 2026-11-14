"""Synthetic fixtures only; the fixed production policy is never accessed."""

import copy
import datetime as dt
import importlib.util
import os
from pathlib import Path
import pwd
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
import uuid


SOURCE = Path(__file__).with_name("code_publisher.py").resolve()
SPEC = importlib.util.spec_from_file_location("code_publisher", SOURCE)
publisher = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = publisher
SPEC.loader.exec_module(publisher)

fs = publisher.fs


class CodePublisherTests(unittest.TestCase):
    def setUp(self):
        temporary = Path(tempfile.gettempdir()).resolve()
        preferred = temporary / "opencode"
        self.temporary = tempfile.TemporaryDirectory(
            prefix="dombi-publisher-synthetic-", dir=preferred if preferred.is_dir() else temporary,
        )
        self.addCleanup(self.temporary.cleanup)
        # macOS exposes no listxattr/ACL metadata; only synthetic fixtures mock it.
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
        for name, content in {
            "app/service.php": b"synthetic current code\n",
            "app/cache.php": b"synthetic cached code\n",
            "artisan": b"synthetic entrypoint, never executed\n",
            "composer.lock": b"synthetic lock\n",
            "public/build/manifest.json": b'{"synthetic": true}\n',
            "public/build/asset.js": b"synthetic asset\n",
            "vendor/autoload.php": b"synthetic vendor, never executed\n",
            "config/app.php": b"synthetic configuration source\n",
            ".env": b"SYNTHETIC_NOT_A_CREDENTIAL=true\n",
            "bootstrap/cache/config.php": b"synthetic generated cache\n",
            "storage/framework/down": b"synthetic containment marker\n",
            "storage/app/public/upload.txt": b"synthetic upload\n",
            "database/local.sqlite": b"not a real database\n",
            "database/local.sqlite-wal": b"not a real database sidecar\n",
            "database/nonstandard.data": b"explicit metadata-only synthetic database\n",
        }.items():
            (self.root / name).write_bytes(content)
        (self.root / "public/storage").symlink_to("../storage/app/public")
        (self.root / "app/link.php").symlink_to("service.php")
        self.boundaries = {
            "managed_scopes": ["app", "artisan", "composer.lock", "public", "bootstrap", "config", "vendor"],
            "protected_paths": ["database"],
            "database_paths": ["database/nonstandard.data"],
            "protected_links": {"public/storage": "../storage/app/public"},
        }
        self.policy.lock.write_bytes(b"")
        self.policy.lock.chmod(0o600)
        self.checkpoint_id = "dombi-fs-" + fs.now().strftime("%Y%m%dT%H%M%SZ-") + uuid.uuid4().hex
        self.manifest_sha = None
        self.sequence = 0
        self.ns = 1700000000123456789
        for path in sorted(self.root.rglob("*"), key=lambda p: len(p.parts), reverse=True):
            os.utime(path, ns=(self.ns, self.ns), follow_symlinks=False)
        os.chmod(self.root / "app/service.php", 0o640)
        os.chmod(self.root / "artisan", 0o750)

    def approval(self, kind, **overrides):
        self.sequence += 1
        current = fs.now()
        observed = fs.inventory(self.policy, self.boundaries)
        value = {
            "operation": kind, "checkpoint_id": self.checkpoint_id,
            "operator": self.policy.account, "independent_verifier": "synthetic-independent-reviewer",
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
            value["prior_operations"] = publisher.prior_operation_lineage(self.directory)
        value.update(overrides)
        path = self.private / ("synthetic-approval-" + str(self.sequence) + ".json")
        fs.write_json(path, value)
        return path

    @property
    def directory(self):
        return self.private / self.checkpoint_id

    def capture(self):
        result = fs.capture(self.policy, self.approval("filesystem-checkpoint-capture"))
        self.manifest_sha = result["manifest_sha256"]
        return fs.load_json(self.directory / "manifest.json")

    def publish(self, approval=None):
        return publisher.publish(
            self.policy, self.checkpoint_id, self.manifest_sha,
            approval or self.approval(publisher.OPERATION),
        )

    def mutate(self):
        (self.root / "app/service.php").write_bytes(b"synthetic candidate code\n")
        (self.root / "app/cache.php").unlink()
        (self.root / "public/build/asset.js").write_bytes(b"synthetic candidate asset\n")
        (self.root / "artisan").chmod(0o700)
        os.utime(self.root / "vendor/autoload.php", ns=(self.ns + 5000, self.ns + 5000))

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

    def managed_digest(self):
        return fs.managed_metadata(fs.inventory(self.policy, self.boundaries))

    def test_normal_publication_restores_exact_managed_metadata(self):
        manifest = self.capture()
        self.mutate()
        result = self.publish()
        self.assertEqual(result["status"], publisher.SUCCESS)
        self.assertEqual(fs.managed_metadata(manifest["inventory"]), self.managed_digest())
        self.assertEqual((self.root / "app/cache.php").read_bytes(), b"synthetic cached code\n")
        self.assertEqual((self.root / "app/service.php").stat().st_mtime_ns, self.ns)
        self.assertEqual(stat.S_IMODE((self.root / "artisan").stat().st_mode), 0o750)
        self.assertEqual((self.root / "app").stat().st_mtime_ns, self.ns)
        operation = self.directory / ("publication-" + fs.file_digest(
            next(self.directory.glob("publication-*")) / "authorization.json"))
        self.assertEqual(fs.load_json(operation / "outcome.json")["status"], publisher.SUCCESS)

    def test_publication_creates_no_files_in_application_root(self):
        self.capture()
        before = set(self.snapshot(self.root))
        self.mutate()
        self.publish()
        self.assertEqual(before, set(self.snapshot(self.root)))
        self.assertFalse(any("payload-" in p.name or "publication-" in p.name
                             for p in self.root.rglob("*")))

    def test_protected_state_and_database_metadata_are_untouched(self):
        manifest = self.capture()
        self.mutate()
        (self.root / ".env").write_bytes(b"synthetic later credential rotation\n")
        (self.root / "storage/app/public/new-upload").write_bytes(b"synthetic newer upload\n")
        before_protected = fs.stable_protected(fs.inventory(self.policy, self.boundaries))
        self.publish()
        self.assertEqual(before_protected,
                         fs.stable_protected(fs.inventory(self.policy, self.boundaries)))
        self.assertTrue((self.root / "storage/framework/down").exists())
        for name in ("local.sqlite", "local.sqlite-wal", "nonstandard.data"):
            entry = manifest["inventory"]["database/" + name]
            self.assertNotIn("sha256", entry)
            self.assertEqual(entry["content_integrity"], "not-verified")
        import tarfile
        with tarfile.open(self.directory / "code.tar.gz") as archive:
            self.assertFalse(any(name.startswith(("database/", ".env", "storage/"))
                                 for name in archive.getnames()))

    def test_gate_rejections_fail_without_mutation(self):
        self.capture()
        self.mutate()
        before = self.snapshot(self.root)
        cases = [
            {"publisher_sha256": "0" * 64},
            {"manifest_sha256": "0" * 64},
            {"independent_verifier": self.policy.account},
            {"workers_drained": False},
            {"effective_identity": {"database": "wrong"}},
            {"observed_state_sha256": "0" * 64},
            {"expires_utc": (fs.now() - dt.timedelta(seconds=1)).isoformat()},
            {"issued_utc": (fs.now() + dt.timedelta(minutes=1)).isoformat()},
            {"identity_verified_utc": (fs.now() - dt.timedelta(minutes=16)).isoformat()},
            {"operation": "filesystem-code-recovery"},
            {"prior_operations": {}},
            {"boundaries": dict(self.boundaries, managed_scopes=["app"])},
        ]
        for values in cases:
            with self.subTest(values=sorted(values)):
                approval = self.approval(publisher.OPERATION, **values)
                with self.assertRaises(fs.CheckpointError):
                    self.publish(approval)
                self.assertEqual(before, self.snapshot(self.root))
                self.assertFalse(self.directory.joinpath("publication-" + fs.file_digest(
                    approval)).exists())

    def test_missing_and_tampered_approval_are_rejected(self):
        self.capture()
        approval = self.approval(publisher.OPERATION)
        approval.chmod(0o644)
        before = self.snapshot(self.root)
        with self.assertRaises(fs.CheckpointError):
            self.publish(approval)
        self.assertEqual(before, self.snapshot(self.root))

    def test_stale_or_extra_target_inventory_blocks_publication(self):
        self.capture()
        self.mutate()
        (self.root / "app/unattributed-local.php").write_bytes(b"synthetic unlisted code\n")
        approval = self.approval(publisher.OPERATION)
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "unexpected_target_inventory"):
            self.publish(approval)
        self.assertEqual(before, self.snapshot(self.root))
        self.assertTrue((self.root / "app/unattributed-local.php").exists())

    def test_missing_managed_file_is_republished_but_no_directory_is_created(self):
        manifest = self.capture()
        (self.root / "app/service.php").write_bytes(b"synthetic candidate code\n")
        (self.root / "app/cache.php").unlink()
        self.assertEqual(self.publish()["published"],
                         ["app/cache.php", "app/service.php"])
        self.assertEqual(fs.managed_metadata(manifest["inventory"]), self.managed_digest())
        (self.root / "vendor/autoload.php").unlink()
        (self.root / "vendor").rmdir()
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "missing_target_entry"):
            self.publish()
        self.assertEqual(before, self.snapshot(self.root))
        self.assertFalse((self.root / "vendor").exists())

    def test_missing_managed_symlink_with_drifted_file_causes_zero_mutations(self):
        self.capture()
        (self.root / "app/service.php").write_bytes(b"synthetic drifted code\n")
        (self.root / "public/build/asset.js").write_bytes(b"synthetic drifted asset\n")
        (self.root / "artisan").chmod(0o700)
        (self.root / "app/link.php").unlink()
        before = self.snapshot(self.root)
        approval = self.approval(publisher.OPERATION)
        with self.assertRaisesRegex(fs.CheckpointError, "missing_target_entry"):
            self.publish(approval)
        self.assertEqual(before, self.snapshot(self.root))
        self.assertFalse((self.root / "app/link.php").exists())
        self.assertFalse(any(self.directory.glob("publication-*")))

    def test_managed_symlink_target_drift_is_rejected_before_mutation(self):
        self.capture()
        (self.root / "app/service.php").write_bytes(b"synthetic drifted code\n")
        link, metadata = self.root / "app/link.php", (self.root / "app/link.php").lstat()
        link.unlink()
        link.symlink_to("cache.php")
        os.utime(link, ns=(metadata.st_mtime_ns, metadata.st_mtime_ns), follow_symlinks=False)
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "symlink_target_changed"):
            self.publish()
        self.assertEqual(before, self.snapshot(self.root))
        self.assertEqual(os.readlink(link), "cache.php")
        self.assertFalse(any(self.directory.glob("publication-*")))

    def test_direct_mutation_helpers_refuse_production_targets_before_writing(self):
        self.capture()
        (self.root / "app/service.php").write_bytes(b"synthetic drifted code\n")
        manifest = fs.load_json(self.directory / "manifest.json")
        before = self.snapshot(self.root)
        operation = self.private / ("publication-" + "e" * 64)
        operation.mkdir(mode=0o700)
        for policy in (fs.PRODUCTION,
                       fs.Policy(self.root, fs.PRODUCTION.private, fs.PRODUCTION.account),
                       fs.Policy(fs.PRODUCTION.root, self.policy.private, self.policy.account),
                       fs.Policy(self.root, self.policy.private, fs.PRODUCTION.account)):
            with self.subTest(policy=policy):
                with self.assertRaisesRegex(fs.CheckpointError,
                                            "production_execution_disabled"):
                    publisher.publish_file(policy, "app/service.php", {}, before,
                                           {}, operation, {})
                with self.assertRaisesRegex(fs.CheckpointError,
                                            "production_execution_disabled"):
                    publisher.apply_publication(policy, manifest, before, {}, operation, [])
        self.assertEqual(before, self.snapshot(self.root))
        self.assertEqual(list(operation.iterdir()), [])

    def test_managed_type_and_symlink_target_changes_block_publication(self):
        self.capture()
        target = self.root / "app/cache.php"
        target.unlink()
        target.mkdir()
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "target_type_conflict"):
            self.publish()
        self.assertEqual(before, self.snapshot(self.root))

    def test_symlink_ancestor_and_substituted_paths_are_rejected(self):
        self.capture()
        self.mutate()
        (self.root / "vendor/escape").symlink_to("../../storage")
        (self.root / "escape.php").write_bytes(b"synthetic unclassified escape\n")
        before = self.snapshot(self.root)
        with self.assertRaises(fs.CheckpointError):
            self.publish()
        self.assertEqual(before, self.snapshot(self.root))

    def test_busy_publisher_lock_prevents_publication(self):
        self.capture()
        self.mutate()
        approval = self.approval(publisher.OPERATION)
        before = self.snapshot(self.root)
        with fs.publisher_lock(self.policy):
            with self.assertRaises(BlockingIOError):
                self.publish(approval)
        self.assertEqual(before, self.snapshot(self.root))
        self.assertFalse(any(self.directory.glob("publication-*")))

    def test_production_paths_cannot_be_substituted_into_a_fixture_run(self):
        production = fs.PRODUCTION
        for policy in (
            production,
            fs.Policy(production.root, self.policy.private, production.account),
            fs.Policy(self.root, production.private, self.policy.account),
            fs.Policy(production.root / "app", self.policy.private, self.policy.account),
            fs.Policy(self.root, production.private / "nested", self.policy.account),
            fs.Policy(self.root, self.policy.private, production.account),
        ):
            with self.subTest(policy=policy):
                with self.assertRaisesRegex(fs.CheckpointError,
                                            "production_execution_disabled"):
                    publisher.require_fixture_policy(policy)
        publisher.require_fixture_policy(self.policy)

    def test_interruption_journals_and_never_reports_success(self):
        self.capture()
        self.mutate()
        approval = self.approval(publisher.OPERATION)
        replace, count = os.replace, 0

        def interrupt(*args, **kwargs):
            nonlocal count
            count += 1
            if count == 2:
                raise KeyboardInterrupt("synthetic publication interruption")
            return replace(*args, **kwargs)

        with mock.patch.object(fs.os, "replace", side_effect=interrupt):
            with self.assertRaises(KeyboardInterrupt):
                self.publish(approval)
        operation = self.directory / ("publication-" + fs.file_digest(approval))
        self.assertFalse((operation / "outcome.json").exists())
        self.assertIn(b"FAILED_OR_INTERRUPTED_KEEP_HELD", (operation / "journal.jsonl").read_bytes())
        self.assertIn(b"published", (operation / "journal.jsonl").read_bytes())
        self.assertNotEqual(fs.managed_metadata(
            fs.load_json(self.directory / "manifest.json")["inventory"]), self.managed_digest())
        with self.assertRaises(fs.CheckpointError):
            self.publish(approval)
        with self.assertRaisesRegex(fs.CheckpointError, "unapproved_prior_publications"):
            self.publish(self.approval(publisher.OPERATION, prior_operations={"publication": {}, "recovery": {}}))
        self.assertEqual(self.publish()["status"], publisher.SUCCESS)
        self.assertEqual(len(list(self.directory.glob("publication-*"))), 2)

    def test_interruption_before_first_mutation_leaves_tree_untouched(self):
        self.capture()
        self.mutate()
        approval = self.approval(publisher.OPERATION)
        before = self.snapshot(self.root)

        def interrupt(*_args, **_kwargs):
            raise KeyboardInterrupt("synthetic pre-publication interruption")

        with mock.patch.object(fs.os, "replace", side_effect=interrupt):
            with self.assertRaises(KeyboardInterrupt):
                self.publish(approval)
        self.assertEqual(before, self.snapshot(self.root))
        self.assertFalse((self.directory / ("publication-" + fs.file_digest(approval))
                          / "outcome.json").exists())
        self.assertEqual(self.publish()["status"], publisher.SUCCESS)

    def test_unfinished_prior_recovery_blocks_publication(self):
        self.capture()
        self.mutate()
        operation = self.directory / ("recovery-" + "d" * 64)
        operation.mkdir(mode=0o700)
        (operation / "authorization.json").write_bytes(b"{}")
        (operation / "journal.jsonl").write_bytes(b"{}\n")
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "incomplete_prior_recovery"):
            self.publish()
        self.assertEqual(before, self.snapshot(self.root))
        self.assertFalse(any(self.directory.glob("publication-*")))

    def test_completed_prior_recovery_only_binds_the_recovery_lineage(self):
        self.capture()
        self.mutate()
        approval = self.approval(publisher.OPERATION)
        recovery = self.directory / ("recovery-" + "d" * 64)
        recovery.mkdir(mode=0o700)
        (recovery / "authorization.json").write_bytes(b"{}")
        (recovery / "journal.jsonl").write_bytes(b"{}\n")
        (recovery / "outcome.json").write_bytes(b"{}")
        before = self.snapshot(self.root)
        with self.assertRaises(fs.CheckpointError):
            self.publish(approval)
        self.assertEqual(before, self.snapshot(self.root))
        self.assertTrue((recovery / "outcome.json").exists())

    def test_managed_symlink_metadata_drift_is_rejected(self):
        self.capture()
        self.mutate()
        link = self.root / "app/link.php"
        self.assertEqual(link.lstat().st_mtime_ns, self.ns)
        os.utime(link, ns=(self.ns + 1, self.ns + 1), follow_symlinks=False)
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "managed_symlink_drift"):
            self.publish()
        self.assertEqual(before, self.snapshot(self.root))

    def test_pre_mutation_target_substitution_is_rejected(self):
        self.capture()
        self.mutate()
        before = self.snapshot(self.root)
        original = fs.expected_target

        def substitute(policy, name, expected):
            original(policy, name, expected)
            if name == "artisan":
                (self.root / "artisan").write_bytes(b"synthetic late writer\n")

        with mock.patch.object(fs, "expected_target", side_effect=substitute):
            with self.assertRaises(fs.CheckpointError):
                self.publish()
        self.assertFalse(any(op.joinpath("outcome.json").exists()
                             for op in self.directory.glob("publication-*")))

    def test_audit_failure_prevents_mutation(self):
        self.capture()
        self.mutate()
        approval = self.approval(publisher.OPERATION)
        before = self.snapshot(self.root)
        with mock.patch.object(fs, "write_bytes", side_effect=OSError("synthetic audit failure")):
            with self.assertRaises(OSError):
                self.publish(approval)
        self.assertEqual(before, self.snapshot(self.root))

    def test_approval_cannot_be_reused(self):
        self.capture()
        self.mutate()
        approval = self.approval(publisher.OPERATION)
        self.publish(approval)
        before = self.snapshot(self.root)
        with self.assertRaises(fs.CheckpointError):
            self.publish(approval)
        self.assertEqual(before, self.snapshot(self.root))
        self.assertEqual(len(list(self.directory.glob("publication-*"))), 1)

    def test_unexpected_publication_inventory_blocks_lineage(self):
        self.capture()
        self.mutate()
        self.publish()
        unknown = self.directory / ("publication-" + "0" * 64)
        unknown.mkdir(mode=0o700)
        (unknown / "journal.jsonl").write_bytes(b"{}\n")
        (unknown / "unexpected.sqlite").write_bytes(b"synthetic unexplained state\n")
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "unknown_publication_entry"):
            self.publish()
        self.assertEqual(before, self.snapshot(self.root))
        self.assertTrue((unknown / "unexpected.sqlite").exists())

    def test_production_identity_is_refused_without_touching_disk(self):
        with mock.patch.object(fs, "check_policy", side_effect=AssertionError("policy access")):
            with self.assertRaisesRegex(fs.CheckpointError, "production_execution_disabled"):
                publisher.require_fixture_policy(fs.PRODUCTION)
        with self.assertRaisesRegex(fs.CheckpointError, "production_execution_disabled"):
            publisher.require_fixture_policy(fs.Policy(
                Path("/nonexistent-app"), fs.PRODUCTION.private, fs.PRODUCTION.account))

    def test_cli_cannot_execute_publication(self):
        result = subprocess.run(
            [sys.executable, "-B", str(SOURCE), "publish", "--checkpoint", self.checkpoint_id,
             "--manifest-sha256", "0" * 64, "--approval", "/nonexistent-approval.json"],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr.strip(), publisher.DISABLED)
        help_text = subprocess.run([sys.executable, "-B", str(SOURCE), "--help"],
                                   capture_output=True, text=True, check=True).stdout
        for flag in ("--root", "--test", "--execute", "--confirm", "--force"):
            self.assertNotIn(flag, help_text)

    def test_publisher_reuses_checkpoint_contract_instead_of_copying_it(self):
        self.assertIs(publisher.fs.CheckpointError, fs.CheckpointError)
        source = SOURCE.read_text(encoding="utf-8")
        for duplicated in ("def inventory(", "def authorize(", "def publisher_lock(",
                           "def validate_manifest(", "def validate_archive(",
                           "def parent_fd(", "def target_at(", "def expected_target("):
            self.assertNotIn(duplicated, source)


if __name__ == "__main__":
    unittest.main()
