"""Synthetic fixtures only; the fixed production policy is never accessed."""

import copy
import datetime as dt
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
SPEC = importlib.util.spec_from_file_location("code_publisher_volatile", SOURCE)
publisher = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = publisher
SPEC.loader.exec_module(publisher)

fs = publisher.fs


class VolatileRuntimeToleranceTests(unittest.TestCase):
    """Narrow tolerance for appended runtime logs during artifact publication."""

    def setUp(self):
        temporary = Path(tempfile.gettempdir()).resolve()
        preferred = temporary / "opencode"
        self.temporary = tempfile.TemporaryDirectory(
            prefix="dombi-volatile-synthetic-", dir=preferred if preferred.is_dir() else temporary,
        )
        self.addCleanup(self.temporary.cleanup)
        if not hasattr(os, "listxattr"):
            adapter = mock.patch.object(os, "listxattr", return_value=[], create=True)
            adapter.start()
            self.addCleanup(adapter.stop)
        acl = mock.patch.object(fs, "require_no_acl", lambda *_: None)
        acl.start()
        self.addCleanup(acl.stop)

        base = Path(self.temporary.name)
        self.root, self.private = base / "app", base / "private"
        self.root.mkdir(mode=0o755)
        self.private.mkdir(mode=0o700)
        self.policy = fs.Policy(self.root, self.private, pwd.getpwuid(os.getuid()).pw_name)
        for name in ("app", "public/build", "bootstrap/cache", "config", "vendor",
                     "storage/logs", "storage/app/public", "storage/framework/views",
                     "database"):
            (self.root / name).mkdir(parents=True, exist_ok=True)
        self.files = {
            "app/service.php": b"synthetic baseline service\n",
            "artisan": b"synthetic entrypoint\n",
            "composer.json": b'{"synthetic": true}\n',
            "composer.lock": b"synthetic lock\n",
            "bootstrap/app.php": b"synthetic bootstrap\n",
            "bootstrap/providers.php": b"synthetic providers\n",
            "public/build/manifest.json": b'{"synthetic": true}\n',
            "config/app.php": b"synthetic config\n",
            "vendor/autoload.php": b"synthetic vendor\n",
        }
        for name, content in self.files.items():
            (self.root / name).write_bytes(content)
        # The volatile log this runbook cares about, plus protected peers that
        # must keep failing closed.
        (self.root / "storage/logs/laravel.log").write_bytes(b"baseline log line\n")
        (self.root / "storage/logs/operational-2026-11-15.log").write_bytes(b"baseline op\n")
        (self.root / "storage/app/public/upload.txt").write_bytes(b"synthetic upload\n")
        (self.root / "storage/framework/views/abc.php").write_bytes(b"synthetic view\n")
        (self.root / "bootstrap/cache/config.php").write_bytes(b"synthetic cache\n")
        (self.root / ".env").write_bytes(b"SYNTHETIC_NOT_A_CREDENTIAL=true\n")
        (self.root / "database/local.sqlite").write_bytes(b"not a real database\n")
        (self.root / "public/storage").symlink_to("../storage/app/public")
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
        self.checkpoint_id = ("dombi-fs-" + fs.now().strftime("%Y%m%dT%H%M%SZ-")
                              + uuid.uuid4().hex)
        self.manifest_sha = None
        self.sequence = 0
        for path in sorted(self.root.rglob("*"), key=lambda p: len(p.parts), reverse=True):
            os.utime(path, ns=(1700000000123456789, 1700000000123456789), follow_symlinks=False)

    # ── helpers ────────────────────────────────────────────────────────
    @property
    def directory(self):
        return self.private / self.checkpoint_id

    def approval(self, kind, **overrides):
        self.sequence += 1
        current = fs.now()
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
            "observed_state_sha256": fs.object_digest(
                fs.inventory(self.policy, self.boundaries)),
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

    def build_artifact(self, application_sha="a" * 40):
        manifest = {"schema": 1, "sha": application_sha,
                    "files": {name: hashlib.sha256(data).hexdigest()
                              for name, data in self.files.items()}}
        payload = dict(self.files)
        payload["release.json"] = (json.dumps(manifest, sort_keys=True, indent=2) + "\n").encode()
        archive = self.private / "release.tar.gz"
        with archive.open("xb") as raw:
            import gzip
            with gzip.GzipFile(filename="", fileobj=raw, mode="wb", mtime=0) as compressed:
                with tarfile.open(fileobj=compressed, mode="w") as tar:
                    for name, data in sorted(payload.items()):
                        member = tarfile.TarInfo(name)
                        member.size, member.mode = len(data), 0o644
                        tar.addfile(member, io.BytesIO(data))
        archive.chmod(0o600)
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        checksum = self.private / "release.sha256"
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

    def publish(self, archive, checksum, approval):
        return publisher.publish_artifact(
            self.policy, self.checkpoint_id, self.manifest_sha, approval, archive, checksum)

    def append_log(self, name="storage/logs/laravel.log", text=b"appended during publication\n"):
        with (self.root / name).open("ab") as stream:
            stream.write(text)

    # ── policy shape ───────────────────────────────────────────────────
    def test_policy_allowlist_is_exact_and_narrow(self):
        policy = publisher.volatile_policy()
        self.assertEqual(set(policy), set(publisher.VOLATILE_POLICY_FIELDS))
        self.assertEqual(policy["allowed_prefixes"], ["storage/logs/"])
        self.assertEqual(policy["mode"], "append-only")
        self.assertEqual(policy["schema"], publisher.VOLATILE_POLICY_SCHEMA)

    def test_only_direct_children_of_the_allowed_directory_qualify(self):
        self.assertTrue(publisher.volatile_path("storage/logs/laravel.log"))
        self.assertTrue(publisher.volatile_path("storage/logs/operational-2026-11-15.log"))
        for name in ("storage/logs/nested/deep.log", "storage/app/public/upload.txt",
                     "storage/framework/views/abc.php", "database/local.sqlite",
                     ".env", "storage/logs", "app/service.php", "storage/app/private/x.log"):
            with self.subTest(name=name):
                self.assertFalse(publisher.volatile_path(name))

    def test_business_and_generated_directories_are_not_volatile(self):
        """storage/app and framework/{cache,sessions,views} must keep failing closed."""
        for name in ("storage/app/public/upload.txt",
                     "storage/app/private/backup.zip",
                     "storage/framework/views/abc.php",
                     "storage/framework/cache/data/x",
                     "storage/framework/sessions/abc"):
            with self.subTest(name=name):
                self.assertFalse(publisher.volatile_path(name))

    # ── the positive case ──────────────────────────────────────────────
    def test_appended_log_during_publication_does_not_abort(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact()
        approval = self.artifact_approval(digest, files)
        original = publisher.apply_publication_for_test = None  # documentation only
        calls = {"n": 0}
        real = publisher.artifact_matches

        def append_then_verify(*args, **kwargs):
            # Simulate the framework appending a log line after the mutation.
            self.append_log()
            return real(*args, **kwargs)

        with mock.patch.object(publisher, "artifact_matches", side_effect=append_then_verify):
            result = self.publish(archive, checksum, approval)
        self.assertEqual(result["status"], publisher.SUCCESS)
        self.assertIn(b"appended during publication", (self.root / "storage/logs/laravel.log").read_bytes())

    def test_appended_log_between_preflight_and_apply_is_tolerated(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact()
        approval = self.artifact_approval(digest, files)
        real = publisher.artifact_preflight

        def append_then_preflight(*args, **kwargs):
            self.append_log()
            return real(*args, **kwargs)

        with mock.patch.object(publisher, "artifact_preflight",
                               side_effect=append_then_preflight):
            result = self.publish(archive, checksum, approval)
        self.assertEqual(result["status"], publisher.SUCCESS)

    def test_unchanged_tree_still_publishes(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact()
        result = self.publish(archive, checksum, self.artifact_approval(digest, files))
        self.assertEqual(result["status"], publisher.SUCCESS)

    # ── negative cases: each must still abort ──────────────────────────
    #
    # These inject drift at the *drift gate* rather than before publish(), because
    # mutating earlier is caught by the approval's pinned inventory digest
    # (`unapproved_state`) and would never exercise the tolerance logic.

    def _drift_at_gate(self, mutate, reason="publication_drift"):
        """Mutate the tree immediately before require_no_drift re-inventories."""
        real = publisher.require_no_drift

        def gate(policy, boundaries, before, why):
            mutate()
            return real(policy, boundaries, before, why)

        with mock.patch.object(publisher, "require_no_drift", side_effect=gate):
            with self.assertRaisesRegex(fs.CheckpointError, reason):
                self.publish_ready()

    def publish_ready(self):
        """Capture + build artifact + return the call, so drift can be injected."""
        archive, checksum, digest, files = self.build_artifact()
        approval = self.artifact_approval(digest, files)
        return self.publish(archive, checksum, approval)

    def test_unauthorized_protected_change_aborts(self):
        self.capture()
        self._drift_at_gate(
            lambda: (self.root / "bootstrap/cache/config.php").write_bytes(b"rewritten\n"))

    def test_upload_change_still_aborts(self):
        self.capture()
        self._drift_at_gate(
            lambda: (self.root / "storage/app/public/upload.txt").write_bytes(b"new upload\n"))

    def test_symlink_substitution_on_allowed_path_aborts(self):
        self.capture()

        def swap():
            log = self.root / "storage/logs/laravel.log"
            log.unlink()
            log.symlink_to("../app/service.php")

        # A substituted symlink is rejected even earlier than the drift gate, by
        # link validation. Either refusal is acceptable; assert it stays closed.
        real = publisher.require_no_drift

        def gate(policy, boundaries, before, why):
            swap()
            return real(policy, boundaries, before, why)

        with mock.patch.object(publisher, "require_no_drift", side_effect=gate):
            with self.assertRaises(fs.CheckpointError):
                self.publish_ready()

    def test_new_file_in_volatile_directory_still_aborts(self):
        """Append-only means the same file; a brand-new log must not be excused."""
        self.capture()
        self._drift_at_gate(
            lambda: (self.root / "storage/logs/new-channel.log").write_bytes(b"new log\n"))

    def test_removed_volatile_log_still_aborts(self):
        self.capture()
        self._drift_at_gate(
            lambda: (self.root / "storage/logs/operational-2026-11-15.log").unlink())

    def test_mode_change_on_volatile_log_still_aborts(self):
        self.capture()
        # The fixture log is 0644 by umask; move to a genuinely different mode.
        self._drift_at_gate(
            lambda: os.chmod(self.root / "storage/logs/laravel.log", 0o600))

    def test_managed_code_drift_still_aborts(self):
        self.capture()
        self._drift_at_gate(
            lambda: (self.root / "app/service.php").write_bytes(b"concurrent writer\n"))

    def test_appended_log_at_the_gate_is_tolerated(self):
        """The positive control for _drift_at_gate: an append must NOT abort."""
        self.capture()
        archive, checksum, digest, files = self.build_artifact()
        approval = self.artifact_approval(digest, files)
        real = publisher.require_no_drift
        calls = {"n": 0}

        def gate(policy, boundaries, before, why):
            calls["n"] += 1
            if calls["n"] == 1:
                self.append_log()
            return real(policy, boundaries, before, why)

        with mock.patch.object(publisher, "require_no_drift", side_effect=gate):
            result = self.publish(archive, checksum, approval)
        self.assertEqual(result["status"], publisher.SUCCESS)

    # ── approval binding ───────────────────────────────────────────────
    def test_missing_volatile_policy_is_rejected(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact()
        approval = self.artifact_approval(digest, files)
        value = fs.load_json(approval)
        del value["volatile_policy"]
        path = self.private / "no-policy.json"
        fs.write_json(path, value)
        with self.assertRaisesRegex(fs.CheckpointError, "volatile_policy_mismatch"):
            self.publish(archive, checksum, path)

    def test_widened_volatile_policy_is_rejected(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact()
        widened = dict(publisher.volatile_policy(),
                       allowed_prefixes=["storage/logs/", "storage/app/"])
        approval = self.artifact_approval(digest, files, volatile_policy=widened)
        with self.assertRaisesRegex(fs.CheckpointError, "volatile_policy_mismatch"):
            self.publish(archive, checksum, approval)

    def test_narrowed_volatile_policy_is_rejected(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact()
        narrowed = dict(publisher.volatile_policy(), allowed_prefixes=[])
        approval = self.artifact_approval(digest, files, volatile_policy=narrowed)
        with self.assertRaisesRegex(fs.CheckpointError, "volatile_policy_mismatch"):
            self.publish(archive, checksum, approval)

    def test_alternate_mode_is_rejected(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact()
        other = dict(publisher.volatile_policy(), mode="content")
        approval = self.artifact_approval(digest, files, volatile_policy=other)
        with self.assertRaisesRegex(fs.CheckpointError, "volatile_policy_mismatch"):
            self.publish(archive, checksum, approval)

    # ── interruption ───────────────────────────────────────────────────
    def test_interruption_with_appended_log_still_never_reports_success(self):
        self.capture()
        # Force real replacements so an interruption is reachable, and append a
        # log line at the same moment.
        self.files["app/service.php"] = b"synthetic candidate service\n"
        self.files["config/app.php"] = b"synthetic candidate config\n"
        archive, checksum, digest, files = self.build_artifact()
        approval = self.artifact_approval(digest, files)
        replace, count = os.replace, 0

        def interrupt(*args, **kwargs):
            nonlocal count
            count += 1
            if count == 2:
                self.append_log(text=b"appended mid-interruption\n")
                raise KeyboardInterrupt("synthetic interruption")
            return replace(*args, **kwargs)

        with mock.patch.object(fs.os, "replace", side_effect=interrupt):
            with self.assertRaises(KeyboardInterrupt):
                self.publish(archive, checksum, approval)
        operation = self.directory / ("publication-" + fs.file_digest(approval))
        self.assertFalse((operation / "outcome.json").exists())
        self.assertIn(b"FAILED_OR_INTERRUPTED_KEEP_HELD",
                      (operation / "journal.jsonl").read_bytes())

    # ── normalization is structural-first ──────────────────────────────
    def _entry(self, payload, **overrides):
        """A real inventory entry for storage/logs/laravel.log holding `payload`.

        Real device/inode are required: the prefix check re-opens the file and the
        structural comparison would otherwise be meaningless.
        """
        # Write the exact baseline bytes, then read real metadata for them.
        (self.root / "storage/logs/laravel.log").write_bytes(payload)
        entry = dict({n: e for n, e in fs.inventory(self.policy, self.boundaries).items()
                      if n == "storage/logs/laravel.log"}["storage/logs/laravel.log"])
        assert entry["size"] == len(payload)
        assert entry["sha256"] == hashlib.sha256(payload).hexdigest()
        entry.update(overrides)
        return entry

    def test_normalize_is_structural_first(self):
        """A structural change is never normalised, even with a valid prefix."""
        self.append_log(text=b"baseline line\n")
        before = {n: e for n, e in fs.inventory(self.policy, self.boundaries).items()
                  if n == "storage/logs/laravel.log"}
        for label, change in (
            ("inode", {"inode": 99}), ("uid", {"uid": 7}), ("mode", {"mode": 0o600}),
            ("type", {"type": "symlink"}), ("class", {"class": "managed"}),
            ("device", {"device": 42}),
        ):
            with self.subTest(field=label):
                after = {"storage/logs/laravel.log": dict(before["storage/logs/laravel.log"],
                                                          **change)}
                self.assertNotEqual(
                    publisher.normalize_volatile(self.policy, before, after), before,
                    f"{label} change must not be normalized away")

    def test_normalize_copies_only_the_three_content_fields(self):
        payload = b"baseline line\n"
        self.append_log(text=payload)
        # Real inventory, so device/inode match the actual file.
        before = {n: e for n, e in fs.inventory(self.policy, self.boundaries).items()
                  if n == "storage/logs/laravel.log"}
        self.append_log(text=b"appended\n")
        observed = fs.inventory(self.policy, self.boundaries)
        after = {"storage/logs/laravel.log": observed["storage/logs/laravel.log"]}
        self.assertEqual(publisher.normalize_volatile(self.policy, before, after), before)

    def test_normalize_never_excuses_managed_entries(self):
        payload = b"baseline\n"
        entry = self._entry(payload)
        entry["class"] = "managed"
        before = {"storage/logs/laravel.log": entry}
        self.append_log(text=b"more\n")
        observed = fs.inventory(self.policy, self.boundaries)
        after = {"storage/logs/laravel.log": observed["storage/logs/laravel.log"]}
        # Left untouched, because a managed path must never be excused.
        self.assertEqual(publisher.normalize_volatile(self.policy, before, after), after)

    # ── append-only is enforced by CONTENT, not metadata ───────────────
    def test_same_size_overwrite_is_rejected(self):
        """Identical size and structure but different bytes must not be tolerated."""
        payload = b"AAAAAAAAAA"
        before = {"storage/logs/laravel.log": self._entry(payload)}
        # Rewrite the whole file with different bytes of the same length.
        (self.root / "storage/logs/laravel.log").write_bytes(b"BBBBBBBBBB")
        observed = fs.inventory(self.policy, self.boundaries)
        after = {"storage/logs/laravel.log": observed["storage/logs/laravel.log"]}
        self.assertEqual(after["storage/logs/laravel.log"]["size"], before[
            "storage/logs/laravel.log"]["size"], "fixture must keep the same size")
        self.assertEqual(publisher.normalize_volatile(self.policy, before, after), after,
                         "a same-size overwrite must not be normalised away")
        self.assertFalse(publisher.append_only_prefix_intact(
            self.policy, "storage/logs/laravel.log", before["storage/logs/laravel.log"]))

    def test_truncate_and_regrow_is_rejected(self):
        """Shrinking then growing back past the baseline length must still fail."""
        payload = b"baseline-content\n"
        before = {"storage/logs/laravel.log": self._entry(payload)}
        target = self.root / "storage/logs/laravel.log"
        target.write_bytes(b"")                              # truncate
        target.write_bytes(b"XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX\n")  # regrow longer
        self.assertGreater(target.stat().st_size,
                           before["storage/logs/laravel.log"]["size"])
        self.assertFalse(publisher.append_only_prefix_intact(
            self.policy, "storage/logs/laravel.log", before["storage/logs/laravel.log"]))

    def test_truncated_below_baseline_is_rejected(self):
        payload = b"baseline-content\n"
        before = {"storage/logs/laravel.log": self._entry(payload)}
        (self.root / "storage/logs/laravel.log").write_bytes(b"base")
        self.assertFalse(publisher.append_only_prefix_intact(
            self.policy, "storage/logs/laravel.log", before["storage/logs/laravel.log"]))

    def test_genuine_append_passes_prefix_check(self):
        payload = b"baseline-content\n"
        before = {"storage/logs/laravel.log": self._entry(payload)}
        self.append_log(text=b"another line\n")
        self.assertTrue(publisher.append_only_prefix_intact(
            self.policy, "storage/logs/laravel.log", before["storage/logs/laravel.log"]))

    def test_concurrent_modification_during_read_fails_closed(self):
        """A write observed between open and re-stat must abort, never be tolerated."""
        payload = b"baseline-content\n"
        entry = self._entry(payload)
        real_stat = publisher.fs.stat_identity
        calls = {"n": 0}

        def drifting(value):
            calls["n"] += 1
            if calls["n"] == 2:
                # Simulate a concurrent rewrite landing after the first fstat.
                return tuple([value[0], value[1], value[2], value[3], value[4],
                              value[5] + 1, value[6], value[7], value[8]])
            return real_stat(value)

        with mock.patch.object(publisher.fs, "stat_identity", side_effect=drifting):
            with self.assertRaisesRegex(fs.CheckpointError, "volatile_read_drift"):
                publisher.append_only_prefix_intact(
                    self.policy, "storage/logs/laravel.log", entry)

    def test_symlink_at_volatile_path_fails_closed(self):
        payload = b"baseline\n"
        entry = self._entry(payload)
        log = self.root / "storage/logs/laravel.log"
        log.unlink()
        log.symlink_to("../../app/service.php")
        with self.assertRaises(fs.CheckpointError):
            publisher.append_only_prefix_intact(self.policy, "storage/logs/laravel.log", entry)

    def test_missing_baseline_hash_fails_closed(self):
        payload = b"baseline\n"
        entry = self._entry(payload)
        del entry["sha256"]
        with self.assertRaisesRegex(fs.CheckpointError, "volatile_baseline_hash"):
            publisher.append_only_prefix_intact(self.policy, "storage/logs/laravel.log", entry)


if __name__ == "__main__":
    unittest.main()
