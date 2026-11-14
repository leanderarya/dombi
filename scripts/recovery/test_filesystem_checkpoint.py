"""Synthetic fixtures only; never invoke the fixed production policy."""

import copy
from contextlib import contextmanager
import datetime as dt
import errno
import importlib.util
import io
import json
import os
from pathlib import Path
import pwd
import stat
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest import mock
import uuid


SOURCE = Path(__file__).with_name("filesystem_checkpoint.py").resolve()
SPEC = importlib.util.spec_from_file_location("filesystem_checkpoint", SOURCE)
fs = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = fs
SPEC.loader.exec_module(fs)


class FilesystemCheckpointTests(unittest.TestCase):
    def setUp(self):
        temporary = Path(tempfile.gettempdir()).resolve()
        preferred = temporary / "opencode"
        self.temporary = tempfile.TemporaryDirectory(
            prefix="dombi-fs-synthetic-", dir=preferred if preferred.is_dir() else temporary,
        )
        self.addCleanup(self.temporary.cleanup)
        # macOS Python lacks listxattr/getxattr; only synthetic fixtures use these adapters.
        if not hasattr(os, "listxattr"):
            adapter = mock.patch.object(os, "listxattr", return_value=[], create=True)
            adapter.start()
            self.addCleanup(adapter.stop)
        if not hasattr(os, "getxattr"):
            absent = getattr(errno, "ENOATTR", None) or errno.ENODATA

            def no_attribute(path, name, follow_symlinks=True):
                raise OSError(absent, "no attribute")

            adapter = mock.patch.object(os, "getxattr", side_effect=no_attribute, create=True)
            adapter.start()
            self.addCleanup(adapter.stop)
        base = Path(self.temporary.name)
        self.root, self.private = base / "app", base / "private"
        self.root.mkdir(mode=0o755)
        self.private.mkdir(mode=0o700)
        self.policy = fs.Policy(self.root, self.private, pwd.getpwuid(os.getuid()).pw_name)
        for name in ("app", "public/build", "bootstrap/cache", "config", "vendor",
                     "storage/app/public", "storage/framework", "database"):
            (self.root / name).mkdir(parents=True, exist_ok=True)
        for name, content in {
            "app/service.php": b"synthetic baseline code\n",
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

    def approval(self, operation, **overrides):
        self.sequence += 1
        current = fs.now()
        damaged = None
        if operation == "filesystem-code-recovery":
            damaged = fs.damaged_links(self.directory, fs.load_json(self.directory / "manifest.json"))
        observed = fs.inventory(self.policy, self.boundaries, damaged=damaged)
        value = {
            "operation": operation, "checkpoint_id": self.checkpoint_id,
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
        if operation == "filesystem-code-recovery":
            value["manifest_sha256"] = self.manifest_sha
            value["prior_operations"] = fs.prior_operations(self.directory)
            manifest = fs.load_json(self.directory / "manifest.json")
            value["removals"] = fs.removal_plan(manifest, observed)
            value["deletion_evidence_reference"] = "synthetic-candidate-inventory-and-type-conflicts"
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

    def recover(self, approval=None):
        return fs.recover(
            self.policy, self.checkpoint_id, self.manifest_sha,
            approval or self.approval("filesystem-code-recovery"),
            f"RECOVER {self.root} TO CHECKPOINT {self.checkpoint_id} {self.manifest_sha}",
        )

    def mutate(self):
        (self.root / "app/service.php").write_bytes(b"synthetic candidate code\n")
        (self.root / "app/candidate-only.php").write_bytes(b"synthetic candidate-only file\n")
        (self.root / "public/build/asset.js").unlink()

    def snapshot(self, path):
        result = {}
        for p in [path, *sorted(path.rglob("*"))]:
            s = p.lstat()
            value = (s.st_mode, s.st_uid, s.st_gid, s.st_size, s.st_mtime_ns, s.st_ino)
            if p.is_symlink():
                value += (os.readlink(p),)
            elif p.is_file():
                value += (p.read_bytes(),)
            result[str(p.relative_to(path))] = value
        return result

    def repin(self, manifest):
        path = self.directory / "manifest.json"
        path.write_bytes(fs.encoded(manifest) + b"\n")
        self.manifest_sha = fs.file_digest(path, True)
        receipt = {
            "status": "CHECKPOINT_VERIFIED", "checkpoint_id": self.checkpoint_id,
            "manifest_sha256": self.manifest_sha,
            "archive_sha256": manifest["archives"][0]["sha256"],
        }
        (self.directory / "verification.json").write_bytes(fs.encoded(receipt) + b"\n")

    def archive_attack(self, attack):
        m = self.capture()
        path = self.directory / "code.tar.gz"
        with tarfile.open(path, "r:gz") as archive:
            members = []
            for member in archive:
                data = archive.extractfile(member).read() if member.isreg() else None
                members.append((copy.deepcopy(member), data))
        attack(members)
        with tarfile.open(path, "w:gz", format=tarfile.PAX_FORMAT) as archive:
            for member, data in members:
                archive.addfile(member, io.BytesIO(data) if data is not None else None)
        m["archives"][0]["size"] = path.stat().st_size
        m["archives"][0]["sha256"] = fs.file_digest(path, True)
        self.repin(m)
        before = self.snapshot(self.root)
        with self.assertRaises((fs.CheckpointError, tarfile.TarError, ValueError)):
            fs.inspect(self.policy, self.checkpoint_id, self.manifest_sha)
        self.assertEqual(before, self.snapshot(self.root))

    def test_round_trip_preserves_exact_managed_metadata_without_old_sha(self):
        m = self.capture()
        self.assertIsNone(m["historical_release_sha"])
        self.assertNotIn("public/build/RELEASE_SHA", m["inventory"])
        self.mutate()
        self.assertEqual(self.recover()["status"], "FILESYSTEM_CHECKPOINT_VERIFIED_KEEP_HELD")
        after = fs.inventory(self.policy, self.boundaries)
        self.assertEqual(fs.managed_metadata(m["inventory"]), fs.managed_metadata(after))
        self.assertEqual((self.root / "app/service.php").stat().st_mtime_ns, self.ns)
        self.assertEqual((self.root / "app").stat().st_mtime_ns, self.ns)
        self.assertEqual((self.root / "app/link.php").lstat().st_mtime_ns, self.ns)

    def test_persistent_state_uses_immediate_pre_recovery_state(self):
        self.capture()
        self.mutate()
        (self.root / ".env").write_bytes(b"synthetic authorized later configuration\n")
        (self.root / "storage/app/public/new-upload").write_bytes(b"synthetic newer upload\n")
        before = fs.stable_protected(fs.inventory(self.policy, self.boundaries))
        self.recover()
        self.assertEqual(before, fs.stable_protected(fs.inventory(self.policy, self.boundaries)))
        self.assertTrue((self.root / "storage/framework/down").exists())

    def test_database_contents_never_opened_hashed_archived_or_restored(self):
        original = fs.regular_file
        original_open = os.open
        forbidden = {"local.sqlite", "local.sqlite-wal", "nonstandard.data"}

        def guarded(path, *args, **kwargs):
            self.assertNotIn(Path(path).name, forbidden)
            return original(path, *args, **kwargs)

        def guarded_open(path, *args, **kwargs):
            self.assertNotIn(Path(path).name, forbidden)
            return original_open(path, *args, **kwargs)

        with mock.patch.object(fs, "regular_file", side_effect=guarded), \
                mock.patch.object(fs.os, "open", side_effect=guarded_open):
            m = self.capture()
            self.mutate()
            self.recover()
        for name in forbidden:
            entry = m["inventory"]["database/" + name]
            self.assertNotIn("sha256", entry)
            self.assertEqual(entry["content_integrity"], "not-verified")
        with tarfile.open(self.directory / "code.tar.gz") as archive:
            self.assertFalse(any("database/" in n for n in archive.getnames()))

    def test_metadata_only_does_not_claim_content_integrity(self):
        self.capture()
        path = self.root / "database/local.sqlite"
        before = fs.inventory(self.policy, self.boundaries)["database/local.sqlite"]
        original = path.read_bytes()
        path.write_bytes(b"X" * len(original))
        os.utime(path, ns=(self.ns, self.ns))
        after = fs.inventory(self.policy, self.boundaries)["database/local.sqlite"]
        self.assertEqual(before, after)
        self.assertEqual(after["content_integrity"], "not-verified")

    def test_read_only_inspection_and_verify_create_nothing(self):
        self.capture()
        before_root, before_private = self.snapshot(self.root), self.snapshot(self.private)
        fs.inspect(self.policy, self.checkpoint_id, self.manifest_sha)
        result = fs.inspect(self.policy, self.checkpoint_id, self.manifest_sha, verify=True)
        self.assertEqual(result["status"], "MANAGED_INVENTORY_MATCH_KEEP_HELD")
        self.assertEqual(before_root, self.snapshot(self.root))
        self.assertEqual(before_private, self.snapshot(self.private))

    def test_read_only_plan_supports_capture_approval(self):
        path = self.private / "synthetic-plan.json"
        fs.write_json(path, {"host_inventory_reference": "synthetic-host-inventory",
                             "boundaries": self.boundaries})
        before = self.snapshot(self.private)
        result = fs.inspect(self.policy, plan=path)
        self.assertEqual(result["observed_state_sha256"],
                         fs.object_digest(fs.inventory(self.policy, self.boundaries)))
        self.assertEqual(before, self.snapshot(self.private))

    def test_candidate_only_tree_removed_but_prefix_like_upload_preserved(self):
        self.capture()
        (self.root / "app/candidate").mkdir()
        (self.root / "app/candidate/new.php").write_bytes(b"synthetic candidate\n")
        (self.root / "storage/app/public/.recovery-file-user").write_bytes(b"synthetic user file\n")
        self.recover()
        self.assertFalse((self.root / "app/candidate").exists())
        self.assertTrue((self.root / "storage/app/public/.recovery-file-user").exists())

    def test_managed_file_directory_type_transitions(self):
        self.capture()
        file = self.root / "app/service.php"
        file.unlink()
        file.mkdir()
        (file / "candidate.php").write_bytes(b"synthetic type transition\n")
        self.recover()
        self.assertTrue(file.is_file())

    def test_shared_parent_mtime_change_is_expected(self):
        self.capture()
        (self.root / "public/new-file").write_bytes(b"synthetic new file\n")
        original = self.root.stat()
        self.recover()
        final = self.root.stat()
        self.assertEqual((original.st_dev, original.st_ino, original.st_uid, original.st_gid,
                          stat.S_IMODE(original.st_mode)),
                         (final.st_dev, final.st_ino, final.st_uid, final.st_gid,
                          stat.S_IMODE(final.st_mode)))

    def test_unknown_file_blocks_capture(self):
        (self.root / "unknown").write_bytes(b"synthetic unclassified\n")
        with self.assertRaises(fs.CheckpointError):
            fs.inventory(self.policy, self.boundaries)

    def test_explicit_untracked_managed_file_is_preserved(self):
        self.boundaries["managed_scopes"].append(".custom-code")
        (self.root / ".custom-code").write_bytes(b"synthetic local customization\n")
        self.capture()
        (self.root / ".custom-code").write_bytes(b"synthetic replacement\n")
        self.recover()
        self.assertEqual((self.root / ".custom-code").read_bytes(), b"synthetic local customization\n")

    def test_incorrect_pins(self):
        self.capture()
        before = self.snapshot(self.root)
        for checkpoint_id, sha in (
            (self.checkpoint_id, "0" * 64),
            ("../escape", self.manifest_sha),
            (self.checkpoint_id, "not-a-digest"),
        ):
            with self.subTest(checkpoint_id=checkpoint_id, sha=sha):
                with self.assertRaises(fs.CheckpointError):
                    fs.inspect(self.policy, checkpoint_id, sha)
        self.assertEqual(before, self.snapshot(self.root))

    def test_archive_tamper_rejected_without_repin(self):
        self.capture()
        with (self.directory / "code.tar.gz").open("ab") as stream:
            stream.write(b"synthetic tamper")
        with self.assertRaises(fs.CheckpointError):
            fs.inspect(self.policy, self.checkpoint_id, self.manifest_sha)

    def test_archive_traversal(self):
        self.archive_attack(lambda members: setattr(members[0][0], "name", "../escape"))

    def test_archive_absolute_path(self):
        self.archive_attack(lambda members: setattr(members[0][0], "name", "/synthetic-escape"))

    def test_archive_duplicate(self):
        self.archive_attack(lambda members: members.append(copy.deepcopy(members[0])))

    def test_archive_missing_member(self):
        self.archive_attack(lambda members: members.pop())

    def test_archive_hardlink(self):
        def attack(members):
            member = members[-1][0]
            member.type, member.linkname, member.size = tarfile.LNKTYPE, "artisan", 0
            members[-1] = (member, None)
        self.archive_attack(attack)

    def test_archive_protected_member(self):
        def attack(members):
            member = tarfile.TarInfo(".env")
            member.size = 0
            members.append((member, b""))
        self.archive_attack(attack)

    def test_archive_wrong_mtime_precision(self):
        self.archive_attack(lambda members: members[0][0].pax_headers.update(mtime="1700000000.123"))

    def test_archive_wrong_uid(self):
        self.archive_attack(lambda members: setattr(members[0][0], "uid", os.getuid() + 1))

    def test_archive_wrong_content(self):
        def attack(members):
            for i, (member, data) in enumerate(members):
                if member.isreg():
                    members[i] = (member, b"X" * len(data))
                    return
        self.archive_attack(attack)

    def test_archive_escaping_symlink(self):
        def attack(members):
            for member, _ in members:
                if member.issym():
                    member.linkname = "../../escape"
                    return
        self.archive_attack(attack)

    def test_manifest_protected_reclassification(self):
        m = self.capture()
        m["inventory"][".env"]["class"] = "managed"
        self.repin(m)
        with self.assertRaises(fs.CheckpointError):
            fs.inspect(self.policy, self.checkpoint_id, self.manifest_sha)

    def test_manifest_database_hash_rejected(self):
        m = self.capture()
        m["inventory"]["database/local.sqlite"]["sha256"] = "0" * 64
        self.repin(m)
        with self.assertRaises(fs.CheckpointError):
            fs.inspect(self.policy, self.checkpoint_id, self.manifest_sha)

    def test_duplicate_json_keys(self):
        path = self.private / "synthetic-duplicate.json"
        path.write_bytes(b'{"schema_version":1,"schema_version":2}')
        path.chmod(0o600)
        with self.assertRaises(fs.CheckpointError):
            fs.load_json(path)

    def test_symlink_ancestor_in_managed_tree_rejected(self):
        (self.root / "app/escape").symlink_to("../storage")
        with self.assertRaises(fs.CheckpointError):
            fs.inventory(self.policy, self.boundaries)

    def test_protected_link_requires_exact_approval(self):
        self.boundaries["protected_links"]["public/storage"] = "../storage/app/elsewhere"
        with self.assertRaises(fs.CheckpointError):
            fs.inventory(self.policy, self.boundaries)

    def test_symlinked_private_ancestor_rejected(self):
        alias = self.private.parent / "alias"
        alias.symlink_to(self.private, target_is_directory=True)
        bad_policy = fs.Policy(self.root, alias, self.policy.account)
        with self.assertRaises(fs.CheckpointError):
            fs.inventory(bad_policy, self.boundaries)

    def test_hardlinked_live_file_rejected(self):
        os.link(self.root / "app/service.php", self.root / "app/extra.php")
        with self.assertRaises(fs.CheckpointError):
            fs.inventory(self.policy, self.boundaries)

    def test_special_file_rejected(self):
        os.mkfifo(self.root / "app/synthetic-fifo")
        with self.assertRaises(fs.CheckpointError):
            fs.inventory(self.policy, self.boundaries)

    def test_unsupported_xattrs_rejected(self):
        with mock.patch.object(fs.os, "listxattr", return_value=["synthetic.unsupported"]):
            with self.assertRaises(fs.CheckpointError):
                fs.inventory(self.policy, self.boundaries)

    def test_missing_native_metadata_api_fails_closed(self):
        with mock.patch.object(fs.os, "listxattr"):
            delattr(fs.os, "listxattr")
            with self.assertRaisesRegex(fs.CheckpointError, "unsupported_metadata_platform"):
                fs.inventory(self.policy, self.boundaries)

    def test_approval_mismatches_fail_without_mutation(self):
        self.capture()
        cases = [
            {"tool_sha256": "0" * 64}, {"manifest_sha256": "0" * 64},
            {"independent_verifier": self.policy.account}, {"workers_drained": False},
            {"effective_identity": {"database": "wrong"}},
            {"observed_state_sha256": "0" * 64},
            {"expires_utc": (fs.now() - dt.timedelta(seconds=1)).isoformat()},
            {"issued_utc": (fs.now() + dt.timedelta(minutes=1)).isoformat()},
            {"identity_verified_utc": (fs.now() - dt.timedelta(minutes=16)).isoformat()},
        ]
        before = self.snapshot(self.root)
        for values in cases:
            with self.subTest(values=values):
                approval = self.approval("filesystem-code-recovery", **values)
                with self.assertRaises(fs.CheckpointError):
                    self.recover(approval)
                self.assertEqual(before, self.snapshot(self.root))

    def test_approval_file_permissions(self):
        approval = self.approval("filesystem-checkpoint-capture")
        approval.chmod(0o644)
        with self.assertRaises(fs.CheckpointError):
            fs.capture(self.policy, approval)
        self.assertFalse(self.directory.exists())

    def test_busy_publisher_lock(self):
        approval = self.approval("filesystem-checkpoint-capture")
        with fs.publisher_lock(self.policy):
            with self.assertRaises(BlockingIOError):
                fs.capture(self.policy, approval)
        self.assertFalse(self.directory.exists())

    def test_capture_drift_leaves_no_valid_checkpoint(self):
        approval = self.approval("filesystem-checkpoint-capture")
        original = fs.make_archive

        def drifting(*args):
            original(*args)
            (self.root / "app/service.php").write_bytes(b"synthetic concurrent writer\n")

        with mock.patch.object(fs, "make_archive", side_effect=drifting):
            with self.assertRaises(fs.CheckpointError):
                fs.capture(self.policy, approval)
        self.assertFalse((self.directory / "verification.json").exists())

    def test_recovery_drift_after_approval_rejected(self):
        self.capture()
        approval = self.approval("filesystem-code-recovery")
        (self.root / "app/service.php").write_bytes(b"synthetic unexpected writer\n")
        with self.assertRaises(fs.CheckpointError):
            self.recover(approval)
        self.assertEqual((self.root / "app/service.php").read_bytes(), b"synthetic unexpected writer\n")

    def test_audit_failure_prevents_code_mutation(self):
        self.capture()
        self.mutate()
        approval = self.approval("filesystem-code-recovery")
        before = self.snapshot(self.root)
        with mock.patch.object(fs, "write_json", side_effect=OSError("synthetic audit failure")):
            with self.assertRaises(OSError):
                self.recover(approval)
        self.assertEqual(before, self.snapshot(self.root))

    def test_interruption_retains_private_staging_and_requires_new_approval(self):
        self.capture()
        self.mutate()
        approval = self.approval("filesystem-code-recovery")
        replace = fs.os.replace
        count = 0

        def interrupt(*args, **kwargs):
            nonlocal count
            self.assertTrue(Path(args[0]).is_relative_to(self.private))
            count += 1
            if count == 2:
                raise KeyboardInterrupt("synthetic interruption")
            return replace(*args, **kwargs)

        with mock.patch.object(fs.os, "replace", side_effect=interrupt):
            with self.assertRaises(KeyboardInterrupt):
                self.recover(approval)
        self.assertFalse(any(".recovery" in p.name or "payload-" in p.name
                             for p in self.root.rglob("*")))
        with self.assertRaises((fs.CheckpointError, FileExistsError)):
            self.recover(approval)
        fresh = self.approval("filesystem-code-recovery")
        self.assertEqual(self.recover(fresh)["status"], "FILESYSTEM_CHECKPOINT_VERIFIED_KEEP_HELD")
        operations = list(self.directory.glob("recovery-*"))
        self.assertEqual(len(operations), 2)

    def test_prior_operations_must_be_acknowledged(self):
        self.capture()
        self.recover()
        approval = self.approval("filesystem-code-recovery", prior_operations={})
        before = self.snapshot(self.root)
        with self.assertRaises(fs.CheckpointError):
            self.recover(approval)
        self.assertEqual(before, self.snapshot(self.root))

    def test_same_approval_cannot_run_twice(self):
        self.capture()
        approval = self.approval("filesystem-code-recovery")
        self.recover(approval)
        with self.assertRaises((fs.CheckpointError, FileExistsError)):
            self.recover(approval)

    def test_default_cli_is_nonmutating_without_accessing_production(self):
        with mock.patch.object(fs, "check_policy", side_effect=AssertionError("policy access")):
            with mock.patch.object(sys, "argv", [str(SOURCE)]):
                self.assertEqual(fs.main(), 1)

    def test_no_production_root_override_in_cli(self):
        result = subprocess.run([sys.executable, "-B", str(SOURCE), "--help"],
                                capture_output=True, text=True, check=True)
        self.assertNotIn("--root", result.stdout)
        self.assertNotIn("--test", result.stdout)

    def test_wrong_approval_boundaries_rejected(self):
        self.capture()
        b = copy.deepcopy(self.boundaries)
        b["managed_scopes"].append("unapproved")
        approval = self.approval("filesystem-code-recovery", boundaries=b)
        before = self.snapshot(self.root)
        with self.assertRaises(fs.CheckpointError):
            self.recover(approval)
        self.assertEqual(before, self.snapshot(self.root))

    def test_full_disk_preflight_prevents_capture(self):
        approval = self.approval("filesystem-checkpoint-capture")
        with mock.patch.object(fs.shutil, "disk_usage", return_value=mock.Mock(free=0)):
            with self.assertRaisesRegex(fs.CheckpointError, "insufficient_space"):
                fs.capture(self.policy, approval)
        self.assertFalse(self.directory.exists())

    def test_cross_device_staging_rejected(self):
        original = Path.stat

        def different_device(path, *args, **kwargs):
            value = original(path, *args, **kwargs)
            if path == self.private:
                fields = list(value)
                fields[2] = value.st_dev + 1
                return os.stat_result(fields)
            return value

        with mock.patch.object(Path, "stat", different_device):
            with self.assertRaisesRegex(fs.CheckpointError, "root_identity_or_device"):
                fs.inventory(self.policy, self.boundaries)

    def test_generated_cache_change_during_recovery_fails_verification(self):
        self.capture()
        original = fs.apply_recovery

        def mutate_cache(*args):
            original(*args)
            (self.root / "bootstrap/cache/config.php").write_bytes(b"synthetic unexpected cache write\n")

        with mock.patch.object(fs, "apply_recovery", side_effect=mutate_cache):
            with self.assertRaisesRegex(fs.CheckpointError, "protected_state_changed"):
                self.recover()
        self.assertFalse(any(op.joinpath("outcome.json").exists()
                             for op in self.directory.glob("recovery-*")))
        self.assertTrue((self.root / "storage/framework/down").exists())

    def test_checkpoint_id_cannot_be_reused(self):
        self.capture()
        with self.assertRaises(FileExistsError):
            fs.capture(self.policy, self.approval("filesystem-checkpoint-capture"))

    def test_pre_mutation_target_drift_is_rejected(self):
        self.capture()
        original = fs.apply_recovery

        def drift(*args):
            (self.root / "app/service.php").write_bytes(b"synthetic late concurrent writer\n")
            return original(*args)

        with mock.patch.object(fs, "apply_recovery", side_effect=drift):
            with self.assertRaises(fs.CheckpointError):
                self.recover()
        self.assertEqual((self.root / "app/service.php").read_bytes(), b"synthetic late concurrent writer\n")

    def test_unknown_private_staging_is_never_cleaned(self):
        self.capture()
        unknown = self.directory / "recovery-unknown"
        unknown.mkdir(mode=0o700)
        (unknown / ".recovery-user-file").write_bytes(b"synthetic retained evidence\n")
        before = self.snapshot(unknown)
        with self.assertRaises(fs.CheckpointError):
            fs.inspect(self.policy, self.checkpoint_id, self.manifest_sha)
        self.assertEqual(before, self.snapshot(unknown))

    def test_checkpoint_symlink_rejected(self):
        self.capture()
        archive = self.directory / "code.tar.gz"
        renamed = self.directory / "original-code.tar.gz"
        archive.rename(renamed)
        archive.symlink_to(renamed.name)
        with self.assertRaises((fs.CheckpointError, OSError)):
            fs.inspect(self.policy, self.checkpoint_id, self.manifest_sha)

    def test_approval_symlink_rejected(self):
        approval = self.approval("filesystem-checkpoint-capture")
        alias = self.private / "synthetic-approval-link"
        alias.symlink_to(approval.name)
        with self.assertRaises((fs.CheckpointError, OSError)):
            fs.capture(self.policy, alias)

    def test_verify_rejects_managed_drift(self):
        self.capture()
        self.mutate()
        with self.assertRaises(fs.CheckpointError):
            fs.inspect(self.policy, self.checkpoint_id, self.manifest_sha, verify=True)

    def test_new_managed_file_requires_explicit_removal_approval(self):
        self.capture()
        (self.root / "app/unattributed-local.php").write_bytes(b"synthetic unapproved local file\n")
        approval = self.approval("filesystem-code-recovery", removals={})
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "unapproved_removals"):
            self.recover(approval)
        self.assertEqual(before, self.snapshot(self.root))

    def test_shared_parent_mode_drift_aborts_before_mutation(self):
        self.capture()
        (self.root / "public").chmod(0o750)
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "shared_parent_checkpoint_drift"):
            self.recover()
        self.assertEqual(before, self.snapshot(self.root))

    def test_prior_operation_extra_file_is_not_read_or_deleted(self):
        self.capture()
        self.recover()
        operation = next(self.directory.glob("recovery-*"))
        extra = operation / "unrelated.sqlite"
        extra.write_bytes(b"synthetic unrelated private data\n")
        original = fs.file_digest

        def guarded(path, *args, **kwargs):
            self.assertNotEqual(path, extra)
            return original(path, *args, **kwargs)

        with mock.patch.object(fs, "file_digest", side_effect=guarded):
            with self.assertRaisesRegex(fs.CheckpointError, "unknown_operation_entry"):
                fs.inspect(self.policy, self.checkpoint_id, self.manifest_sha)
        self.assertTrue(extra.exists())

    def test_focused_input_substitution_rejected(self):
        path = self.private / "synthetic-input.json"
        fs.write_json(path, {"original": True})
        replacement = self.private / "synthetic-replacement.json"
        fs.write_json(replacement, {"substituted": True})
        original = fs.json.loads

        def substitute(raw, **kwargs):
            value = original(raw, **kwargs)
            os.replace(replacement, path)
            return value

        with mock.patch.object(fs.json, "loads", side_effect=substitute):
            with self.assertRaisesRegex(fs.CheckpointError, "json_identity_drift"):
                fs.json_snapshot(path)

    def test_focused_manifest_pin_and_parse_share_one_open(self):
        self.capture()
        path = self.directory / "manifest.json"
        original = fs.regular_file
        opened = 0

        @contextmanager
        def counted(p, *args, **kwargs):
            nonlocal opened
            if p == path:
                opened += 1
            with original(p, *args, **kwargs) as value:
                yield value

        with mock.patch.object(fs, "regular_file", side_effect=counted):
            fs.load_checkpoint(self.policy, self.checkpoint_id, self.manifest_sha)
        self.assertEqual(opened, 1)

    def test_focused_approval_raw_bytes_bound_to_audit(self):
        self.capture()
        approval = self.approval("filesystem-code-recovery")
        value = fs.load_json(approval)
        raw = json.dumps(value, indent=3).encode() + b"\n\n"
        approval.write_bytes(raw)
        self.recover(approval)
        operation = self.directory / ("recovery-" + fs.hashlib.sha256(raw).hexdigest())
        self.assertEqual((operation / "authorization.json").read_bytes(), raw)
        fs.prior_operations(self.directory)

    def test_focused_target_substitution_before_replace(self):
        self.capture()
        target = self.root / "app/service.php"
        # Inject after staging preparation, between the early check and final check.
        original_target = fs.expected_target

        def mark_target(policy, name, expected):
            original_target(policy, name, expected)
            if name == "app/service.php":
                target.write_bytes(b"synthetic late writer\n")

        with mock.patch.object(fs, "expected_target", side_effect=mark_target):
            with self.assertRaises(fs.CheckpointError):
                self.recover()
        self.assertEqual(target.read_bytes(), b"synthetic late writer\n")

    def test_focused_target_substitution_before_unlink(self):
        self.capture()
        target = self.root / "app/candidate-only.php"
        target.write_bytes(b"synthetic candidate\n")
        original = fs.parent_fd
        replaced = False

        @contextmanager
        def substitute(policy, name, directories):
            nonlocal replaced
            with original(policy, name, directories) as value:
                if name == "app/candidate-only.php" and not replaced:
                    replacement = self.private / "synthetic-writer-file"
                    replacement.write_bytes(b"synthetic unrelated replacement\n")
                    os.replace(replacement, target)
                    replaced = True
                yield value

        with mock.patch.object(fs, "parent_fd", side_effect=substitute):
            with self.assertRaises(fs.CheckpointError):
                self.recover()
        self.assertEqual(target.read_bytes(), b"synthetic unrelated replacement\n")

    def test_focused_interruption_after_type_conflict_deletion(self):
        self.capture()
        target = self.root / "app/service.php"
        target.unlink()
        target.mkdir()
        original = fs.os.rmdir

        def interrupt(name, **kwargs):
            original(name, **kwargs)
            if name == "service.php":
                raise KeyboardInterrupt("synthetic post-delete interruption")

        approval = self.approval("filesystem-code-recovery")
        with mock.patch.object(fs.os, "rmdir", side_effect=interrupt):
            with self.assertRaises(KeyboardInterrupt):
                self.recover(approval)
        self.assertFalse(target.exists())
        with self.assertRaises(fs.CheckpointError):
            fs.inventory(self.policy, self.boundaries)
        fs.inspect(self.policy, self.checkpoint_id, self.manifest_sha)
        with self.assertRaises(fs.CheckpointError):
            self.recover(approval)
        self.recover(self.approval("filesystem-code-recovery"))
        self.assertTrue(target.is_file())

    def test_focused_unjournaled_dangling_link_rejected(self):
        self.capture()
        (self.root / "app/service.php").unlink()
        with self.assertRaises(fs.CheckpointError):
            fs.inspect(self.policy, self.checkpoint_id, self.manifest_sha)

    def test_focused_damaged_link_never_allows_escape(self):
        self.capture()
        target = self.root / "app/service.php"
        target.unlink()
        target.mkdir()
        original = fs.os.rmdir

        def interrupt(name, **kwargs):
            original(name, **kwargs)
            if name == "service.php":
                raise KeyboardInterrupt("synthetic interruption")

        with mock.patch.object(fs.os, "rmdir", side_effect=interrupt):
            with self.assertRaises(KeyboardInterrupt):
                self.recover()
        link = self.root / "app/link.php"
        link.unlink()
        link.symlink_to("../../escape")
        with self.assertRaises(fs.CheckpointError):
            fs.inspect(self.policy, self.checkpoint_id, self.manifest_sha)

    def test_focused_same_bytes_digest_mismatch_rejected(self):
        path = self.private / "synthetic-pinned-input.json"
        fs.write_json(path, {"synthetic": True})
        with self.assertRaisesRegex(fs.CheckpointError, "json_pin"):
            fs.json_snapshot(path, expected_digest="0" * 64)

    def interrupt_type_conflict(self):
        self.capture()
        target = self.root / "app/service.php"
        target.unlink()
        target.mkdir()
        original = fs.os.rmdir

        def interrupt(name, **kwargs):
            original(name, **kwargs)
            if name == "service.php":
                raise KeyboardInterrupt("synthetic conflicting-target deletion")

        with mock.patch.object(fs.os, "rmdir", side_effect=interrupt):
            with self.assertRaises(KeyboardInterrupt):
                self.recover()
        return target

    def test_lineage_two_interruptions_then_authorized_recovery(self):
        target = self.interrupt_type_conflict()
        approval = self.approval("filesystem-code-recovery")
        original = fs.os.replace
        before_inode = (self.root / "app/link.php").lstat().st_ino

        def interrupt(source, destination, **kwargs):
            original(source, destination, **kwargs)
            if destination == "link.php":
                raise KeyboardInterrupt("synthetic after publication before completion")

        with mock.patch.object(fs.os, "replace", side_effect=interrupt):
            with self.assertRaises(KeyboardInterrupt):
                self.recover(approval)
        self.assertFalse(target.exists())
        self.assertNotEqual(before_inode, (self.root / "app/link.php").lstat().st_ino)
        fs.inspect(self.policy, self.checkpoint_id, self.manifest_sha)
        with self.assertRaises(fs.CheckpointError):
            self.recover(approval)
        self.recover(self.approval("filesystem-code-recovery"))
        self.assertTrue(target.is_file())
        self.assertEqual(len(list(self.directory.glob("recovery-*"))), 3)

    def test_lineage_substituted_identical_symlink_rejected(self):
        self.interrupt_type_conflict()
        original = fs.os.replace

        def interrupt(source, destination, **kwargs):
            original(source, destination, **kwargs)
            if destination == "link.php":
                raise KeyboardInterrupt("synthetic published link")

        with mock.patch.object(fs.os, "replace", side_effect=interrupt):
            with self.assertRaises(KeyboardInterrupt):
                self.recover()
        link = self.root / "app/link.php"
        metadata = link.lstat()
        replacement = self.private / "synthetic-unapproved-link"
        replacement.symlink_to("service.php")
        os.utime(replacement, ns=(metadata.st_mtime_ns, metadata.st_mtime_ns),
                 follow_symlinks=False)
        os.replace(replacement, link)
        before = self.snapshot(self.root)
        with self.assertRaises(fs.CheckpointError):
            fs.inspect(self.policy, self.checkpoint_id, self.manifest_sha)
        self.assertEqual(before, self.snapshot(self.root))

    def test_lineage_interruption_before_intent_persistence(self):
        target = self.interrupt_type_conflict()
        original = fs.journal

        def interrupt(directory, event):
            if event.get("action") == "publish-symlink-intent":
                raise KeyboardInterrupt("synthetic before journal persistence")
            original(directory, event)

        with mock.patch.object(fs, "journal", side_effect=interrupt):
            with self.assertRaises(KeyboardInterrupt):
                self.recover()
        fs.inspect(self.policy, self.checkpoint_id, self.manifest_sha)
        self.recover(self.approval("filesystem-code-recovery"))
        self.assertTrue(target.is_file())

    def test_lineage_interruption_after_intent_before_publication(self):
        target = self.interrupt_type_conflict()
        original = fs.journal

        def interrupt(directory, event):
            original(directory, event)
            if event.get("action") == "publish-symlink-intent":
                raise KeyboardInterrupt("synthetic durable intent, no publication")

        with mock.patch.object(fs, "journal", side_effect=interrupt):
            with self.assertRaises(KeyboardInterrupt):
                self.recover()
        fs.inspect(self.policy, self.checkpoint_id, self.manifest_sha)
        self.recover(self.approval("filesystem-code-recovery"))
        self.assertTrue(target.is_file())

    def test_lineage_torn_journal_rejects_continuation(self):
        self.interrupt_type_conflict()
        original = fs.os.replace

        def interrupt(source, destination, **kwargs):
            original(source, destination, **kwargs)
            if destination == "link.php":
                raise KeyboardInterrupt("synthetic publication interruption")

        with mock.patch.object(fs.os, "replace", side_effect=interrupt):
            with self.assertRaises(KeyboardInterrupt):
                self.recover()
        operation = next(op for op in self.directory.glob("recovery-*")
                         if b"publish-symlink-intent" in (op / "journal.jsonl").read_bytes())
        with (operation / "journal.jsonl").open("ab") as stream:
            stream.write(b'{"action":')
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "incomplete_journal"):
            fs.inspect(self.policy, self.checkpoint_id, self.manifest_sha)
        self.assertEqual(before, self.snapshot(self.root))


    @staticmethod
    def absent_acl_error():
        return OSError(getattr(errno, "ENOATTR", None) or errno.ENODATA, "no acl")

    def test_acl_absent_allows_inventory(self):
        def missing(path, name, follow_symlinks=True):
            raise self.absent_acl_error()

        with mock.patch.object(fs.os, "getxattr", side_effect=missing):
            self.assertIn(".", fs.inventory(self.policy, self.boundaries))

    def test_acl_present_rejected(self):
        with mock.patch.object(fs.os, "getxattr", return_value=b"\x02\x00\x00\x00"):
            with self.assertRaisesRegex(fs.CheckpointError, "acl_present"):
                fs.inventory(self.policy, self.boundaries)

    def test_acl_inaccessible_rejected(self):
        for code in (errno.EPERM, errno.EACCES):
            with self.subTest(code=code):
                def denied(path, name, follow_symlinks=True):
                    raise OSError(code, "denied")

                with mock.patch.object(fs.os, "getxattr", side_effect=denied):
                    with self.assertRaisesRegex(fs.CheckpointError, "acl_inaccessible"):
                        fs.inventory(self.policy, self.boundaries)

    def test_acl_unsupported_rejected(self):
        def unsupported(path, name, follow_symlinks=True):
            raise OSError(errno.ENOTSUP, "unsupported")

        with mock.patch.object(fs.os, "getxattr", side_effect=unsupported):
            with self.assertRaisesRegex(fs.CheckpointError, "acl_unsupported"):
                fs.inventory(self.policy, self.boundaries)

    def test_linux_symlink_acl_unsupported_allows_inventory_no_follow(self):
        unsupported_codes = {errno.ENOTSUP, getattr(errno, "EOPNOTSUPP", errno.ENOTSUP)}
        for code in sorted(unsupported_codes):
            with self.subTest(code=code):
                calls = []

                def probe(path, name, follow_symlinks=True):
                    calls.append((str(path), name, follow_symlinks))
                    if name == fs.ACL_ACCESS and str(path).endswith("/link.php"):
                        raise OSError(code, "unsupported")
                    raise self.absent_acl_error()

                with mock.patch.object(fs.sys, "platform", "linux"), \
                        mock.patch.object(fs.os, "listxattr", return_value=[]), \
                        mock.patch.object(fs.os, "getxattr", side_effect=probe):
                    items = fs.inventory(self.policy, self.boundaries)

                self.assertEqual(items["app/link.php"]["type"], "symlink")
                link_calls = [call for call in calls if call[0].endswith("/link.php")]
                self.assertTrue(link_calls)
                self.assertTrue(all(path.startswith("/proc/self/fd/") and follow is False
                                    and name == fs.ACL_ACCESS
                                    for path, name, follow in link_calls))
                self.assertFalse(any(name == fs.ACL_DEFAULT for _, name, _ in link_calls))

    def test_acl_unsupported_rejected_for_non_symlinks_and_non_linux(self):
        cases = (("config", "linux"), ("app/service.php", "linux"), ("app/link.php", "darwin"))
        for target, platform in cases:
            with self.subTest(target=target, platform=platform):
                def probe(path, name, follow_symlinks=True):
                    if name == fs.ACL_ACCESS and str(path).endswith("/" + target.rsplit("/", 1)[-1]):
                        raise OSError(errno.ENOTSUP, "unsupported")
                    raise self.absent_acl_error()

                with mock.patch.object(fs.sys, "platform", platform), \
                        mock.patch.object(fs.os, "listxattr", return_value=[]), \
                        mock.patch.object(fs.os, "getxattr", side_effect=probe):
                    with self.assertRaisesRegex(fs.CheckpointError, "acl_unsupported"):
                        fs.inventory(self.policy, self.boundaries)

    def test_linux_symlink_present_inaccessible_and_unexpected_acl_errors_rejected(self):
        cases = (
            (b"\x02\x00\x00\x00", "acl_present"),
            (OSError(errno.EPERM, "denied"), "acl_inaccessible"),
            (OSError(errno.EACCES, "denied"), "acl_inaccessible"),
            (OSError(errno.EIO, "io failure"), "acl_check_failed"),
        )
        for result, reason in cases:
            with self.subTest(reason=reason, result=result):
                def probe(path, name, follow_symlinks=True):
                    if name == fs.ACL_ACCESS and str(path).endswith("/link.php"):
                        if isinstance(result, OSError):
                            raise OSError(result.errno, result.strerror)
                        return result
                    raise self.absent_acl_error()

                with mock.patch.object(fs.sys, "platform", "linux"), \
                        mock.patch.object(fs.os, "listxattr", return_value=[]), \
                        mock.patch.object(fs.os, "getxattr", side_effect=probe):
                    with self.assertRaisesRegex(fs.CheckpointError, reason):
                        fs.inventory(self.policy, self.boundaries)

    def test_listxattr_attributes_and_errors_still_reject_symlink(self):
        for failure in ("listed", "error"):
            with self.subTest(failure=failure):
                acl_calls = []

                def list_attributes(path, follow_symlinks=True):
                    if str(path).endswith("/link.php"):
                        if failure == "listed":
                            return ["user.synthetic"]
                        raise OSError(errno.EIO, "listxattr failed")
                    return []

                def probe(path, name, follow_symlinks=True):
                    acl_calls.append((str(path), name))
                    raise self.absent_acl_error()

                with mock.patch.object(fs.sys, "platform", "linux"), \
                        mock.patch.object(fs.os, "listxattr", side_effect=list_attributes), \
                        mock.patch.object(fs.os, "getxattr", side_effect=probe):
                    if failure == "listed":
                        with self.assertRaisesRegex(fs.CheckpointError, "unsupported_xattrs_or_acl"):
                            fs.inventory(self.policy, self.boundaries)
                    else:
                        with self.assertRaises(OSError) as raised:
                            fs.inventory(self.policy, self.boundaries)
                        self.assertEqual(raised.exception.errno, errno.EIO)

                self.assertFalse(any(path.endswith("/link.php") for path, _ in acl_calls))

    def test_acl_unexpected_error_rejected(self):
        def failed(path, name, follow_symlinks=True):
            raise OSError(errno.EIO, "io failure")

        with mock.patch.object(fs.os, "getxattr", side_effect=failed):
            with self.assertRaisesRegex(fs.CheckpointError, "acl_check_failed"):
                fs.inventory(self.policy, self.boundaries)

    def test_acl_default_directory_rejected(self):
        def probe(path, name, follow_symlinks=True):
            if name == fs.ACL_DEFAULT:
                return b"\x02\x00\x00\x00"
            raise self.absent_acl_error()

        with mock.patch.object(fs.os, "getxattr", side_effect=probe):
            with self.assertRaisesRegex(fs.CheckpointError, "acl_present"):
                fs.inventory(self.policy, self.boundaries)

    def test_acl_default_skipped_for_files_and_no_follow_everywhere(self):
        calls = []

        def probe(path, name, follow_symlinks=True):
            calls.append((str(path), name, follow_symlinks))
            raise self.absent_acl_error()

        with mock.patch.object(fs.os, "getxattr", side_effect=probe):
            fs.inventory(self.policy, self.boundaries)

        access = {path for path, name, _ in calls if name == fs.ACL_ACCESS}
        default = {path for path, name, _ in calls if name == fs.ACL_DEFAULT}
        self.assertTrue(any(path.endswith("service.php") for path in access))
        self.assertFalse(any(path.endswith("service.php") for path in default))
        self.assertTrue(calls)
        self.assertTrue(all(follow is False for _, _, follow in calls))

    def test_acl_symlink_probed_without_following(self):
        calls = []

        def probe(path, name, follow_symlinks=True):
            calls.append((str(path), name, follow_symlinks))
            if name == fs.ACL_ACCESS and str(path).endswith("link.php"):
                return b"\x02\x00\x00\x00"
            raise self.absent_acl_error()

        with mock.patch.object(fs.os, "getxattr", side_effect=probe):
            with self.assertRaisesRegex(fs.CheckpointError, "acl_present"):
                fs.inventory(self.policy, self.boundaries)
        self.assertTrue(any(path.endswith("link.php") and follow is False
                            for path, _, follow in calls))

    def test_acl_check_preserves_database_metadata_only(self):
        def missing(path, name, follow_symlinks=True):
            raise self.absent_acl_error()

        with mock.patch.object(fs.os, "getxattr", side_effect=missing):
            items = fs.inventory(self.policy, self.boundaries)
        entry = items["database/local.sqlite"]
        self.assertNotIn("sha256", entry)
        self.assertEqual(entry["content_integrity"], "not-verified")

    def test_missing_acl_api_fails_closed(self):
        with mock.patch.object(fs.os, "getxattr"):
            delattr(fs.os, "getxattr")
            with self.assertRaisesRegex(fs.CheckpointError, "unsupported_metadata_platform"):
                fs.inventory(self.policy, self.boundaries)


if __name__ == "__main__":
    unittest.main()
