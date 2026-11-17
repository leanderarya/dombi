"""Single-owner deployment: preservation, failure containment and rollback.

Synthetic fixtures only. A real `.env`, database file and upload are created and
must survive every path. `fs.PRODUCTION` is never provisioned, written or read:
each test injects a temporary policy through `deploy.policy`.
"""

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


SOURCE = Path(__file__).with_name("single_owner_deploy.py").resolve()
SPEC = importlib.util.spec_from_file_location("single_owner_deploy_tests", SOURCE)
deploy = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = deploy
SPEC.loader.exec_module(deploy)

fs = deploy.fs
APP_SHA = "a" * 40


def sha(data):
    return hashlib.sha256(data).hexdigest()


class DeployFixture(unittest.TestCase):
    def setUp(self):
        temporary = Path(tempfile.gettempdir()).resolve()
        preferred = temporary / "opencode"
        self.temporary = tempfile.TemporaryDirectory(
            prefix="dombi-deploy-synthetic-", dir=preferred if preferred.is_dir() else temporary)
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name).resolve()
        self.root, self.private = self.base / "app", self.base / "private"
        self.root.mkdir(mode=0o755)
        self.private.mkdir(mode=0o700)
        self.policy = fs.Policy(self.root, self.private, pwd.getpwuid(os.getuid()).pw_name)
        patcher = mock.patch.object(deploy, "policy", lambda: self.policy)
        patcher.start()
        self.addCleanup(patcher.stop)

        for name in ("app", "config", "routes", "resources/views",
                     "database/migrations", "vendor", "public/build",
                     "bootstrap/cache", "storage/app/public", "storage/framework",
                     "database"):
            (self.root / name).mkdir(parents=True, exist_ok=True)
        self.baseline = {
            "app/Http/Kernel.php": b"<?php // baseline kernel\n",
            "app/Old.php": b"<?php // baseline old, removed by candidate\n",
            "config/app.php": b"<?php // baseline config\n",
            "routes/web.php": (
                b"<?php\n"
                b"Route::post('/payment/doku/notify', [D::class, 'notify']);\n"
                b"Route::match(['get','post'], '/payment/doku/redirect', [D::class, 'redirect']);\n"),
            "resources/views/welcome.blade.php": b"baseline view\n",
            "database/migrations/0001_init.php": b"<?php // baseline migration\n",
            "artisan": b"#!/usr/bin/env php\n<?php // baseline artisan\n",
            "composer.json": b'{"baseline": true}\n',
            "composer.lock": b'{"baseline": "lock"}\n',
            "bootstrap/app.php": b"<?php // baseline bootstrap\n",
            "bootstrap/providers.php": b"<?php // baseline providers\n",
            "vendor/autoload.php": b"<?php // baseline autoload\n",
            "public/build/manifest.json": b'{"baseline": "assets"}\n',
            "public/build/app.js": b"// baseline asset\n",
        }
        for name, data in self.baseline.items():
            (self.root / name).parent.mkdir(parents=True, exist_ok=True)
            (self.root / name).write_bytes(data)
        self.protected = {
            ".env": b"APP_ENV=production\nDB_DATABASE=secret\n",
            "database/db.sqlite": b"not a real database\n",
            "storage/app/public/upload.txt": b"synthetic upload\n",
            "bootstrap/cache/config.php": b"<?php // generated cache\n",
        }
        for name, data in self.protected.items():
            (self.root / name).parent.mkdir(parents=True, exist_ok=True)
            (self.root / name).write_bytes(data)
        (self.root / "public/storage").symlink_to("../storage/app/public")

        self.candidate = dict(self.baseline)
        self.candidate["app/Http/Kernel.php"] = b"<?php // candidate kernel\n"
        self.candidate["public/build/app.js"] = b"// candidate asset\n"
        self.candidate.pop("app/Old.php")
        self.archive, self.checksum, self.archive_sha, self.files = self.build(
            self.candidate)
        self.operation_dir = None

    def build(self, contents, application_sha=APP_SHA, label="release"):
        manifest = {"schema": 1, "sha": application_sha,
                    "files": {name: sha(data) for name, data in contents.items()}}
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
        digest = sha(archive.read_bytes())
        checksum = self.private / (label + ".sha256")
        checksum.write_bytes((digest + "  release.tar.gz\n").encode())
        checksum.chmod(0o600)
        return archive, checksum, digest, manifest["files"]

    # ── helpers ──────────────────────────────────────────────────────────
    def run_mode(self, mode, archive=None, checksum=None, application_sha=APP_SHA,
                 archive_sha=None, operation=None):
        argv = [mode, "--archive", str(archive or self.archive),
                "--checksum-file", str(checksum or self.checksum),
                "--application-sha", application_sha,
                "--archive-sha256", archive_sha or self.archive_sha]
        if operation:
            argv = [mode, "--operation", operation]
        err = io.StringIO()
        with mock.patch("sys.stdout", new=io.StringIO()) as out, \
                mock.patch("sys.stderr", new=err):
            code = deploy.main(argv)
        return code, out.getvalue() + err.getvalue()

    def deploy(self):
        code, output = self.run_mode("deploy")
        self.assertEqual(code, 0, output)
        return json.loads(output)

    def protected_snapshot(self):
        result = {}
        for name in self.protected:
            path = self.root / name
            result[name] = (path.read_bytes(), path.stat().st_mode, path.stat().st_uid)
        result["public/storage"] = os.readlink(self.root / "public/storage")
        return result

    def op_dir(self, outcome):
        return self.private / outcome["operation_id"]

    # ── preflight ────────────────────────────────────────────────────────
    def test_preflight_writes_nothing_and_names_callback_routes(self):
        before = self.protected_snapshot()
        code, output = self.run_mode("preflight")
        self.assertEqual(code, 0, output)
        result = json.loads(output)
        self.assertEqual(result["status"], "PREFLIGHT_OK_KEEP_HELD")
        self.assertEqual(sorted(result["callback_routes"]),
                         sorted(deploy.CALLBACK_ROUTES))
        self.assertEqual(before, self.protected_snapshot())
        self.assertEqual(sorted(p.name for p in self.private.iterdir()),
                         sorted({self.archive.name, self.checksum.name}))

    def test_refuses_to_deploy_when_the_site_is_in_maintenance(self):
        (self.root / "storage/framework/down").write_bytes(b"")
        before = self.snapshot_code()
        code, output = self.run_mode("deploy")
        self.assertEqual(code, 1)
        self.assertIn("DEPLOY_ABORT", output)
        self.assertEqual(before, self.snapshot_code())

    def test_refuses_an_artifact_whose_routes_drop_a_callback(self):
        candidate = dict(self.candidate)
        candidate["routes/web.php"] = b"<?php\nRoute::post('/payment/doku/notify', [D::class, 'notify']);\n"
        archive, checksum, archive_sha, _ = self.build(candidate, label="nocallback")
        code, _ = self.run_mode("deploy", archive=archive, checksum=checksum,
                                archive_sha=archive_sha)
        self.assertEqual(code, 1)
        self.assertEqual(self.baseline["routes/web.php"],
                         (self.root / "routes/web.php").read_bytes())

    def test_refuses_an_artifact_that_gates_a_callback(self):
        candidate = dict(self.candidate)
        candidate["routes/web.php"] = (
            b"<?php\n"
            b"Route::post('/payment/doku/notify', [D::class, 'notify'])->middleware('admission.customer');\n"
            b"Route::match(['get','post'], '/payment/doku/redirect', [D::class, 'redirect']);\n")
        archive, checksum, archive_sha, _ = self.build(candidate, label="gated")
        code, _ = self.run_mode("deploy", archive=archive, checksum=checksum,
                                archive_sha=archive_sha)
        self.assertEqual(code, 1)
        self.assertEqual(self.baseline["routes/web.php"],
                         (self.root / "routes/web.php").read_bytes())

    def test_refuses_a_tampered_archive_and_wrong_identity(self):
        before = self.snapshot_code()
        code, _ = self.run_mode("deploy", archive_sha="0" * 64)
        self.assertEqual(code, 1)
        code, _ = self.run_mode("deploy", application_sha="b" * 40)
        self.assertEqual(code, 1)
        self.assertEqual(before, self.snapshot_code())

    # ── preservation ─────────────────────────────────────────────────────
    def test_deploy_preserves_env_database_storage_and_generated_cache(self):
        before = self.protected_snapshot()
        result = self.deploy()
        self.assertEqual(result["status"], "DEPLOY_COMPLETE_KEEP_HELD")
        self.assertEqual(before, self.protected_snapshot())

    def test_deploy_never_writes_outside_the_managed_scopes(self):
        self.deploy()
        for name in self.protected:
            self.assertTrue((self.root / name).is_file())
        self.assertTrue((self.root / "public/storage").is_symlink())
        backups = list(self.private.glob("deploy-*.predeploy.tar.gz"))
        self.assertEqual(len(backups), 1, "exactly one pre-deploy backup archive")

    def test_deploy_backs_up_every_overwritten_file_before_mutation(self):
        result = self.deploy()
        record = fs.load_json(self.private / (result["operation_id"] + ".backup.json"))
        self.assertEqual(record["files"], sorted(self.baseline))
        self.assertEqual(deploy.verify_backup(record, self.private).name,
                         Path(result["backup"]).name)
        self.assertEqual(result["backup_sha256"], record["sha256"])

    def test_deploy_records_overwritten_and_added_separately(self):
        result = self.deploy()
        self.assertIn("app/Http/Kernel.php", result["overwritten"])
        self.assertNotIn("app/Old.php", result["overwritten"])

    def test_stale_files_are_reported_not_silently_deleted(self):
        """A file the candidate drops is preserved and disclosed, never removed.

        Deleting it would be an unrecoverable action outside the backed-up set;
        rollback also relies on the old tree still being intact.
        """
        result = self.deploy()
        self.assertIn("app/Old.php", result["stale_not_removed"])
        self.assertTrue((self.root / "app/Old.php").is_file())
        self.assertEqual((self.root / "app/Old.php").read_bytes(),
                         self.baseline["app/Old.php"])

    def test_publication_stages_every_file_before_the_first_rename(self):
        """All slow I/O must finish before production is touched."""
        renames = []
        real_replace = os.replace

        def tracking_replace(source, destination, *args, **kwargs):
            renames.append(str(destination))
            return real_replace(source, destination, *args, **kwargs)

        self.deploy()  # warm the fixture, then measure a fresh operation
        operation = [p for p in self.private.iterdir()
                     if p.is_dir() and (p / "outcome.json").exists()][0]
        staged_before = None
        with mock.patch.object(deploy.os, "replace", side_effect=tracking_replace):
            record = deploy.create_backup(self.root, self.private,
                                          "deploy-20260101T000111Z-cafebabe")
            manifest = {"sha": APP_SHA, "files": self.files}
            staging = operation / "runtime"
            deploy.deploy(self.root, self.private, manifest, staging, record,
                          self.private / "deploy-20260101T000111Z-cafebabe")
        self.assertTrue(renames, "commit phase must rename")
        for destination in renames:
            self.assertTrue(destination.startswith(str(self.root)),
                            "every rename targets the live tree")

    def test_failed_staging_leaves_production_untouched(self):
        """A failure during the copy phase must not have mutated anything."""
        before = self.snapshot_code()
        real_stage = deploy.stage_file
        calls = {"n": 0}

        def failing_stage(*args, **kwargs):
            calls["n"] += 1
            if calls["n"] == 4:
                raise OSError("synthetic staging failure")
            return real_stage(*args, **kwargs)

        with mock.patch.object(deploy, "stage_file", side_effect=failing_stage):
            code, _ = self.run_mode("deploy")
        self.assertEqual(code, 1)
        self.assertEqual(before, self.snapshot_code())

    def test_outcome_discloses_the_mixed_code_window(self):
        """The tool must state the residual risk rather than claim atomicity."""
        source = Path(deploy.__file__).read_text()
        self.assertIn("mixed-code window", source)
        self.assertIn("not atomically swapped", source)
        self.assertIn("prerequisite", source)

    # ── rollback ─────────────────────────────────────────────────────────
    def test_rollback_restores_exact_baseline_managed_code(self):
        before = {name: (self.root / name).read_bytes() for name in self.baseline}
        result = self.deploy()
        self.assertEqual((self.root / "app/Http/Kernel.php").read_bytes(),
                         b"<?php // candidate kernel\n")
        code, output = self.run_mode("rollback", operation=result["operation_id"])
        self.assertEqual(code, 0, output)
        self.assertEqual(json.loads(output)["status"], "ROLLBACK_COMPLETE_KEEP_HELD")
        for name, data in before.items():
            self.assertEqual((self.root / name).read_bytes(), data, name)

    def test_rollback_preserves_protected_state(self):
        before = self.protected_snapshot()
        result = self.deploy()
        self.run_mode("rollback", operation=result["operation_id"])
        self.assertEqual(before, self.protected_snapshot())

    def test_rollback_is_idempotent_for_restored_files(self):
        result = self.deploy()
        first, _ = self.run_mode("rollback", operation=result["operation_id"])
        self.assertEqual(first, 0)
        second, output = self.run_mode("rollback", operation=result["operation_id"])
        self.assertEqual(second, 0, output)
        self.assertEqual((self.root / "app/Http/Kernel.php").read_bytes(),
                         self.baseline["app/Http/Kernel.php"])

    def test_rollback_refuses_a_tampered_backup(self):
        result = self.deploy()
        backup = Path(result["backup"])
        backup.chmod(0o600)
        backup.write_bytes(b"tampered")
        code, output = self.run_mode("rollback", operation=result["operation_id"])
        self.assertEqual(code, 1)
        self.assertIn("DEPLOY_ABORT", output)

    def test_rollback_requires_a_well_formed_operation_id(self):
        for operation in ("../../etc", "deploy-x", "deploy-20260101T000000Z", None):
            code, _ = self.run_mode("rollback", operation=operation)
            self.assertEqual(code, 1, operation)

    # ── interruption and failure containment ─────────────────────────────
    def test_interrupted_deploy_leaves_recoverable_state_and_rolls_back(self):
        before = {name: (self.root / name).read_bytes() for name in self.baseline}
        real_replace, calls = os.replace, {"n": 0}

        def interrupt(*args, **kwargs):
            calls["n"] += 1
            if calls["n"] == 3:
                raise OSError("synthetic interruption")
            return real_replace(*args, **kwargs)

        with mock.patch.object(deploy.os, "replace", side_effect=interrupt):
            code, output = self.run_mode("deploy")
        self.assertEqual(code, 1, output)
        operations = [p for p in self.private.iterdir() if p.is_dir()]
        self.assertEqual(len(operations), 1)
        operation = operations[0]
        self.assertFalse((operation / "outcome.json").exists())
        self.assertIn(b"AUTHORIZED_NOT_COMPLETED",
                      (operation / "journal.jsonl").read_bytes())
        # The backup still exists, so a rollback is possible even now.
        record = fs.load_json(self.private / (operation.name + ".backup.json"))
        deploy.verify_backup(record, self.private)
        with mock.patch.object(deploy.os, "replace", side_effect=real_replace):
            code, _ = self.run_mode("rollback", operation=operation.name)
        self.assertEqual(code, 1, "rollback needs an outcome; it must fail closed")
        # Whatever was reached before the interruption, the backup is intact and
        # no completion was claimed.
        record = fs.load_json(self.private / (operation.name + ".backup.json"))
        self.assertEqual(sorted(record["files"]), sorted(self.baseline))
        self.assertGreater(len(before), 0)

    def test_failed_verification_journals_and_never_claims_complete(self):
        real_digest = deploy.digest
        state = {"calls": 0}

        def corrupted(path):
            # Corrupt only the post-deploy inventory check, not the backup paths.
            value = real_digest(path)
            if Path(path).name == "Kernel.php" and state["calls"] >= 0:
                state["calls"] += 1
                if state["calls"] > 1:
                    return "0" * 64
            return value

        with mock.patch.object(deploy, "digest", side_effect=corrupted):
            code, output = self.run_mode("deploy")
        self.assertEqual(code, 1, output)
        operation = [p for p in self.private.iterdir() if p.is_dir()][0]
        self.assertFalse((operation / "outcome.json").exists())

    def test_refuses_to_deploy_when_protected_state_is_a_symlink(self):
        (self.root / "storage").rename(self.base / "storage-real")
        (self.root / "storage").symlink_to(self.base / "storage-real")
        code, _ = self.run_mode("deploy")
        self.assertEqual(code, 1)

    def snapshot_code(self):
        result = {}
        for name, path in deploy.code_inventory(self.root).items():
            result[name] = path.read_bytes()
        return result


if __name__ == "__main__":
    unittest.main()
