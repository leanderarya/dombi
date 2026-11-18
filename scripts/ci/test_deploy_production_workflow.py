"""The production workflow stays inert until two independent controls agree.

Parsed structurally (not by string matching) so a formatting change cannot hide a
disabled-by-default regression, and so an accidental auto-deploy trigger fails.
"""

import hashlib
import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

import yaml
import production_ssh_transport as ssh_transport


WORKFLOW = Path(__file__).parents[2] / ".github" / "workflows" / "deploy-production.yml"
TRANSPORT = Path(__file__).with_name("production_deploy_transport.py")

SPEC = importlib.util.spec_from_file_location("production_deploy_transport_wf", TRANSPORT)
transport = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = transport
SPEC.loader.exec_module(transport)


def load():
    # `on:` parses as the boolean True in YAML 1.1; normalise it back.
    data = yaml.safe_load(WORKFLOW.read_text())
    return data, data.get("on", data.get(True))


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.data, self.triggers = load()

    def test_source_constant_is_false(self):
        self.assertIn("PRODUCTION_DEPLOY_ACTIVATED = False", TRANSPORT.read_text())
        self.assertFalse(transport.PRODUCTION_DEPLOY_ACTIVATED)

    def test_only_push_to_main_and_manual_dispatch_can_trigger(self):
        self.assertEqual(sorted(self.triggers), ["push", "workflow_dispatch"])
        self.assertEqual(self.triggers["push"]["branches"], ["main"])

    def test_no_schedule_or_pull_request_trigger(self):
        for forbidden in ("schedule", "pull_request", "repository_dispatch"):
            self.assertNotIn(forbidden, self.triggers)

    def test_concurrency_never_cancels_an_in_progress_publication(self):
        self.assertEqual(self.data["concurrency"]["cancel-in-progress"], False)
        self.assertEqual(self.data["concurrency"]["group"], "deploy-production")

    def test_deploy_job_requires_the_gate_output(self):
        job = self.data["jobs"]["deploy"]
        self.assertEqual(job["needs"], "gate")
        self.assertIn("enabled == 'true'", job["if"])

    def test_mutating_jobs_are_scoped_to_the_production_environment(self):
        """Only jobs that can touch production carry the protected environment."""
        self.assertEqual(self.data["jobs"]["deploy"]["environment"], "production")
        self.assertEqual(self.data["jobs"]["rollback"]["environment"], "production")

    def test_gate_job_is_not_bound_to_the_protected_environment(self):
        """The gate reads a constant and a variable and uses no secrets.

        Binding it to `production` would block every push to main on a human
        review just to evaluate a boolean, so it is deliberately unprotected
        while the jobs that can actually mutate stay protected.
        """
        gate = self.data["jobs"]["gate"]
        self.assertIsNone(gate.get("environment"))
        self.assertNotIn("secrets.", str(gate))

    def test_disabled_gate_can_complete_without_an_environment_approval(self):
        """With activation off, the gate must finish, not wait on a reviewer.

        The gate declares no environment and uses no secrets, so reading the two
        controls never consumes a production approval.
        """
        gate = self.data["jobs"]["gate"]
        self.assertIsNone(gate.get("environment"))
        body = " ".join(str(step.get("run", "")) for step in gate["steps"])
        # The decision is a pure constant/variable read.
        self.assertIn("PRODUCTION_DEPLOY_ACTIVATED = True", body)
        self.assertIn("GITHUB_OUTPUT", body)
        # And the result of a disabled gate is the literal string false.
        self.assertIn("'false'", body)

    def test_activation_leaves_the_deploy_job_skipped_not_failed(self):
        """`needs`+`if` means an inactive gate skips deploy; it never runs it."""
        deploy = self.data["jobs"]["deploy"]
        self.assertEqual(deploy["needs"], "gate")
        self.assertIn("enabled == 'true'", deploy["if"])

    def test_every_job_requires_the_canonical_repository(self):
        for name, job in self.data["jobs"].items():
            with self.subTest(job=name):
                self.assertIn("leanderarya/dombi", job.get("if", ""))

    def test_workflow_declares_no_write_permissions(self):
        self.assertEqual(self.data["permissions"],
                         {"contents": "read", "actions": "read"})

    def test_no_job_uses_a_deploy_step_before_the_gate(self):
        """No publish-capable step may exist in the gate job."""
        gate_steps = self.data["jobs"]["gate"]["steps"]
        for step in gate_steps:
            body = str(step.get("run", ""))
            for forbidden in ("single_owner_deploy.py deploy", "ssh ", "scp "):
                self.assertNotIn(forbidden, body)

    def test_publication_requires_both_transport_constants_false(self):
        """Both the planning and SSH transports must ship inert."""
        deploy_transport = (Path(__file__).with_name("production_deploy_transport.py")).read_text()
        ssh_transport = (Path(__file__).with_name("production_ssh_transport.py")).read_text()
        self.assertIn("PRODUCTION_DEPLOY_ACTIVATED = False", deploy_transport)
        self.assertIn("PRODUCTION_DEPLOY_ACTIVATED = False", ssh_transport)
        self.assertNotIn("PRODUCTION_DEPLOY_ACTIVATED = True", deploy_transport)
        self.assertNotIn("PRODUCTION_DEPLOY_ACTIVATED = True", ssh_transport)

    def test_publication_steps_go_through_the_gated_transport(self):
        steps = self.data["jobs"]["deploy"]["steps"]
        runs = " ".join(str(step.get("run", "")) for step in steps)
        self.assertIn("production_ssh_transport.py --phase upload", runs)
        self.assertIn("production_ssh_transport.py --phase deploy", runs)
        # The upload/deploy steps may only exist behind the gate output.
        self.assertIn("needs.gate.outputs.enabled == 'true'", self.data["jobs"]["deploy"]["if"])

    def test_download_then_stage_then_verify_the_exact_five(self):
        steps = self.data["jobs"]["deploy"]["steps"]
        download = next(i for i, s in enumerate(steps) if
                        s.get("uses", "").startswith("actions/download-artifact@"))
        verify = next(i for i, s in enumerate(steps) if s.get("id") == "artifact")
        upload = next(i for i, s in enumerate(steps) if
                      "production_ssh_transport.py --phase upload" in s.get("run", ""))
        self.assertLess(download, verify)
        self.assertLess(verify, upload)
        self.assertEqual(steps[download]["with"]["path"], "transfer")
        self.assertEqual(steps[upload]["run"],
                         "python3 -B scripts/ci/production_ssh_transport.py --phase upload")
        sources = {
            "release.py": "scripts/ci/release.py",
            "filesystem_checkpoint.py": "scripts/recovery/filesystem_checkpoint.py",
            "single_owner_deploy.py": "scripts/recovery/single_owner_deploy.py",
        }
        expected = {"release.tar.gz", "release.sha256", *sources}
        self.assertEqual(set(transport.REQUIRED_TOOLS), expected)
        self.assertEqual(set(ssh_transport.UPLOAD_FILES), expected)
        env = {"PATH": os.environ["PATH"], "PRODUCTION_DEPLOY_ENABLED": "true",
               "GITHUB_EVENT_NAME": "push", "GITHUB_REF": "refs/heads/main",
               "GITHUB_REPOSITORY": "leanderarya/dombi", "GITHUB_RUN_ATTEMPT": "1",
               "GITHUB_SHA": "a" * 40}
        # Invoke the real verifier with activation set only in the local child process.
        activate_fixture = """python3() {
          command python3 -B -c 'import sys
sys.path.insert(0, "scripts/ci")
import production_deploy_transport as transport
transport.PRODUCTION_DEPLOY_ACTIVATED = True
sys.exit(transport.main(sys.argv[1:]))' "${@:3}"
        }
        """
        for case in ("complete", "missing receipt", "missing tool", "destination symlink"):
            with self.subTest(case=case), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                transfer = root / "transfer"
                transfer.mkdir()
                archive = b"synthetic archive"
                (transfer / "release.tar.gz").write_bytes(archive)
                if case != "missing receipt":
                    (transfer / "release.sha256").write_text(
                        hashlib.sha256(archive).hexdigest() + "  release.tar.gz\n")
                for source in (*sources.values(), "scripts/ci/production_deploy_transport.py"):
                    if case == "missing tool" and source == sources["single_owner_deploy.py"]:
                        continue
                    (root / source).parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(WORKFLOW.parents[2] / source, root / source)
                with mock.patch.object(transport, "PRODUCTION_DEPLOY_ACTIVATED", True):
                    with self.assertRaisesRegex(transport.TransportError, "transfer_inventory"):
                        transport.plan(env, transfer)
                collision = transfer / "release.py"
                if case == "destination symlink":
                    collision.symlink_to(transfer / "not-created")
                result = subprocess.run(
                    ["bash", "-eo", "pipefail", "-c", activate_fixture + steps[verify]["run"]],
                    cwd=root, env=env, capture_output=True, text=True)
                if case == "complete":
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertEqual({p.name for p in ssh_transport.transfer_files(transfer)}, expected)
                    for name, source in sources.items():
                        self.assertEqual((transfer / name).read_bytes(),
                                         (WORKFLOW.parents[2] / source).read_bytes())
                else:
                    self.assertNotEqual(result.returncode, 0)
                    self.assertEqual(result.stdout, "")
                    if case == "destination symlink":
                        self.assertTrue(collision.is_symlink())
                        self.assertFalse(collision.exists())

    def test_rollback_is_manual_only_and_never_on_push(self):
        job = self.data["jobs"]["rollback"]
        self.assertIn("workflow_dispatch", job["if"])
        self.assertNotIn("push", job["if"])

    def test_secret_references_use_only_existing_production_names(self):
        text = WORKFLOW.read_text()
        import re
        names = set(re.findall(r"secrets\.([A-Z_]+)", text))
        allowed = {"GITHUB_TOKEN", "HOSTINGER_SSH_HOST", "HOSTINGER_SSH_PORT",
                   "HOSTINGER_SSH_USER", "HOSTINGER_SSH_PASSWORD",
                   "HOSTINGER_SSH_FINGERPRINT"}
        self.assertTrue(names <= allowed, names - allowed)

    def test_workflow_never_echoes_a_secret(self):
        text = WORKFLOW.read_text()
        for line in text.splitlines():
            if "secrets." in line and ("echo" in line or "printf" in line):
                self.fail("secret echoed: " + line.strip())

    def test_workflow_names_the_reviewed_composite_tool(self):
        text = WORKFLOW.read_text()
        self.assertNotIn("artisan down", text)
        self.assertNotIn("artisan migrate", text)


if __name__ == "__main__":
    unittest.main()
