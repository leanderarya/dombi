"""Production deploy transport: disabled by default and bound to one artifact.

These tests never touch a host. They prove that no combination of environment
variables or a repository setting can arm production, that the artifact must
match the merge commit, and that the pre-activation surface mutates nothing.
"""

import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock


SOURCE = Path(__file__).with_name("production_deploy_transport.py").resolve()
SPEC = importlib.util.spec_from_file_location("production_deploy_transport", SOURCE)
transport = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = transport
SPEC.loader.exec_module(transport)

SHA = "b" * 40
ARCHIVE = b"synthetic release archive bytes\n"
ARCHIVE_SHA = hashlib.sha256(ARCHIVE).hexdigest()


def base_env(**overrides):
    env = {
        "GITHUB_EVENT_NAME": "push",
        "GITHUB_REF": "refs/heads/main",
        "GITHUB_REPOSITORY": "leanderarya/dombi",
        "GITHUB_RUN_ATTEMPT": "1",
        "GITHUB_SHA": SHA,
        "PRODUCTION_DEPLOY_ENABLED": "true",
    }
    env.update(overrides)
    return env


class TransportFixture(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="dombi-prod-transport-")
        self.addCleanup(self.temporary.cleanup)
        self.transfer = Path(self.temporary.name) / "transfer"
        self.transfer.mkdir()
        (self.transfer / "release.tar.gz").write_bytes(ARCHIVE)
        (self.transfer / "release.sha256").write_bytes(
            ("%s  release.tar.gz\n" % ARCHIVE_SHA).encode())
        for name in ("release.py", "filesystem_checkpoint.py", "single_owner_deploy.py"):
            (self.transfer / name).write_bytes(b"# synthetic tool\n")
        self.activated = mock.patch.object(transport, "PRODUCTION_DEPLOY_ACTIVATED", True)
        self.disabled = mock.patch.object(transport, "PRODUCTION_DEPLOY_ACTIVATED", False)

    def plan(self, env=None, transfer=None):
        return transport.plan(env or base_env(), transfer or self.transfer)

    # ── disabled by default ──────────────────────────────────────────────
    def test_shipped_source_is_not_activated(self):
        """The committed constant must be False; activation is its own review."""
        text = SOURCE.read_text()
        self.assertIn("PRODUCTION_DEPLOY_ACTIVATED = False", text)
        self.assertNotIn("PRODUCTION_DEPLOY_ACTIVATED = True", text)

    def test_source_constant_alone_does_not_arm_the_pipeline(self):
        with self.disabled:
            with self.assertRaisesRegex(transport.TransportError,
                                        "production_deploy_not_activated"):
                self.plan()

    def test_repository_variable_alone_does_not_arm_the_pipeline(self):
        with self.disabled:
            for value in ("true", "TRUE", "1", "yes", ""):
                with self.subTest(value=value):
                    with self.assertRaisesRegex(transport.TransportError,
                                                "production_deploy_not_activated"):
                        self.plan(base_env(PRODUCTION_DEPLOY_ENABLED=value))

    def test_both_controls_are_required(self):
        with self.activated:
            for value in ("", "false", "TRUE", "1"):
                with self.subTest(value=value):
                    with self.assertRaisesRegex(transport.TransportError,
                                                "repository_variable_disabled"):
                        self.plan(base_env(PRODUCTION_DEPLOY_ENABLED=value))
            self.assertEqual(self.plan()["sha"], SHA)

    def test_environment_variable_alone_cannot_mimic_activation(self):
        """There is no env var that substitutes for the source constant."""
        with self.disabled:
            env = base_env(PRODUCTION_DEPLOY_ACTIVATED="true", DOMBI_DEPLOY_ENABLED="true")
            with self.assertRaisesRegex(transport.TransportError,
                                        "production_deploy_not_activated"):
                self.plan(env)

    # ── trigger conditions ───────────────────────────────────────────────
    def test_refuses_a_non_push_trigger(self):
        with self.activated:
            for event in ("pull_request", "workflow_dispatch", "schedule", ""):
                with self.subTest(event=event):
                    with self.assertRaisesRegex(transport.TransportError,
                                                "trigger_not_push"):
                        self.plan(base_env(GITHUB_EVENT_NAME=event))

    def test_refuses_a_ref_that_is_not_main(self):
        with self.activated:
            for ref in ("refs/heads/develop", "refs/tags/v1.0", "main", ""):
                with self.subTest(ref=ref):
                    with self.assertRaisesRegex(transport.TransportError, "ref_not_main"):
                        self.plan(base_env(GITHUB_REF=ref))

    def test_refuses_a_foreign_repository(self):
        with self.activated:
            with self.assertRaisesRegex(transport.TransportError, "repository"):
                self.plan(base_env(GITHUB_REPOSITORY="someone/else"))

    def test_refuses_a_rerun_attempt(self):
        with self.activated:
            for attempt in ("2", "3", "", "1.0"):
                with self.subTest(attempt=attempt):
                    with self.assertRaisesRegex(transport.TransportError,
                                                "not_first_attempt"):
                        self.plan(base_env(GITHUB_RUN_ATTEMPT=attempt))

    def test_refuses_an_identified_non_commit_sha(self):
        with self.activated:
            for sha in ("", "abc", "../../etc", "A" * 40):
                with self.subTest(sha=sha):
                    with self.assertRaises(transport.TransportError):
                        self.plan(base_env(GITHUB_SHA=sha))

    # ── artifact binding ────────────────────────────────────────────────
    def test_plan_binds_the_merge_commit_and_its_tag(self):
        with self.activated:
            result = self.plan()
        self.assertEqual(result["sha"], SHA)
        self.assertEqual(result["tag"], "release-" + SHA[:16])
        self.assertEqual(result["archive_sha256"], ARCHIVE_SHA)
        self.assertFalse(result["bootstrap_release"])

    def test_plan_flags_the_bootstrap_release(self):
        with self.activated:
            result = self.plan(base_env(GITHUB_SHA=transport.BOOTSTRAP_RELEASE_SHA))
        self.assertTrue(result["bootstrap_release"])

    def test_refuses_a_tampered_archive(self):
        (self.transfer / "release.tar.gz").write_bytes(b"substituted bytes")
        with self.activated:
            with self.assertRaisesRegex(transport.TransportError, "archive_digest"):
                self.plan()

    def test_refuses_a_malformed_or_mismatched_receipt(self):
        with self.activated:
            for receipt in (b"", b"onlyone\n", b"z" * 64 + b"  release.tar.gz\n",
                            b"%s  other.tar.gz\n" % ARCHIVE_SHA.encode()):
                with self.subTest(receipt=receipt):
                    (self.transfer / "release.sha256").write_bytes(receipt)
                    with self.assertRaises(transport.TransportError):
                        self.plan()
                    (self.transfer / "release.sha256").write_bytes(
                        ("%s  release.tar.gz\n" % ARCHIVE_SHA).encode())

    def test_refuses_a_missing_artifact(self):
        (self.transfer / "release.tar.gz").unlink()
        with self.activated:
            with self.assertRaisesRegex(transport.TransportError, "transfer_inventory"):
                self.plan()

    def test_refuses_an_extra_or_unexpected_transfer_file(self):
        (self.transfer / "extra.sh").write_bytes(b"#!/bin/sh\n")
        with self.activated:
            with self.assertRaisesRegex(transport.TransportError, "transfer_inventory"):
                self.plan()

    def test_refuses_a_symlinked_transfer_entry(self):
        (self.transfer / "release.py").unlink()
        (self.transfer / "release.py").symlink_to("/etc/passwd")
        with self.activated:
            with self.assertRaisesRegex(transport.TransportError, "transfer_entry"):
                self.plan()

    # ── pre-activation surface mutates nothing ──────────────────────────
    def test_disabled_cli_exits_nonzero_and_prints_no_plan(self):
        argv = ["--phase", "deploy", "--transfer", str(self.transfer)]
        out, err = io.StringIO(), io.StringIO()
        with self.disabled, mock.patch.dict(os.environ, base_env(), clear=False), \
                mock.patch("sys.stdout", new=out), mock.patch("sys.stderr", new=err):
            code = transport.main(argv)
        self.assertEqual(code, 1)
        self.assertEqual(out.getvalue(), "")
        self.assertIn("PRODUCTION_DEPLOY_ABORT", err.getvalue())

    def test_activation_alone_still_refuses_with_the_setting_off(self):
        argv = ["--phase", "deploy", "--transfer", str(self.transfer)]
        out, err = io.StringIO(), io.StringIO()
        env = base_env(PRODUCTION_DEPLOY_ENABLED="false")
        with self.activated, mock.patch.dict(os.environ, env, clear=False), \
                mock.patch("sys.stdout", new=out), mock.patch("sys.stderr", new=err):
            code = transport.main(argv)
        self.assertEqual(code, 1)
        self.assertEqual(out.getvalue(), "")

    def test_remote_script_never_interpolates_a_secret(self):
        with self.activated:
            facts = self.plan()
        for phase in transport.PHASES:
            script = transport.remote_script(
                phase, facts, {"OPERATION_ID": "deploy-20260101T000000Z-deadbeef"})
            self.assertNotIn("HOSTINGER", script)
            self.assertNotIn("PASSWORD", script)
            self.assertNotIn("TOKEN", script)

    def test_remote_deploy_script_uses_the_reviewed_composite_tool(self):
        with self.activated:
            facts = self.plan()
        script = transport.remote_script("deploy", facts, {})
        self.assertIn("single_owner_deploy.py deploy", script)
        self.assertIn(facts["sha"], script)
        self.assertIn(facts["archive_sha256"], script)
        # No global maintenance mode and no migration anywhere in the script.
        for forbidden in ("artisan down", "artisan up", "migrate", "db:wipe"):
            self.assertNotIn(forbidden, script)

    def test_status_phase_is_read_only(self):
        with self.activated:
            facts = self.plan()
        script = transport.remote_script("status", facts, {})
        self.assertNotIn("single_owner_deploy.py", script)
        self.assertNotIn("mkdir", script)

    def test_unknown_phase_is_refused(self):
        with self.activated:
            facts = self.plan()
        with self.assertRaisesRegex(transport.TransportError, "phase"):
            transport.describe("nonsense", facts, {})


if __name__ == "__main__":
    unittest.main()
