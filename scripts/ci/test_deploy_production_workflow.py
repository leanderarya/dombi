"""The production workflow stays inert until two independent controls agree.

Parsed structurally (not by string matching) so a formatting change cannot hide a
disabled-by-default regression, and so an accidental auto-deploy trigger fails.
"""

import importlib.util
from pathlib import Path
import sys
import unittest

import yaml


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
