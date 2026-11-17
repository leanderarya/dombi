"""Main push -> Quality Gate -> same-SHA artifact -> disabled production gate.

Structural tests over the two workflows. They prove the artifact a main merge
produces is named for exactly that merge commit, that the deploy job consumes
that same name and no other, and that all of it stays behind the disabled gate.
"""

import re
from pathlib import Path
import unittest

import yaml


ROOT = Path(__file__).parents[2]
TESTS = ROOT / ".github" / "workflows" / "tests.yml"
PROD = ROOT / ".github" / "workflows" / "deploy-production.yml"


def load(path):
    data = yaml.safe_load(path.read_text())
    return data, (data.get("on", data.get(True)) or {})


class ArtifactPathTests(unittest.TestCase):
    def setUp(self):
        self.tests, self.tests_triggers = load(TESTS)
        self.prod, self.prod_triggers = load(PROD)

    # ── the builder ─────────────────────────────────────────────────────
    def test_quality_gate_runs_on_main_push(self):
        self.assertIn("push", self.tests_triggers)
        self.assertEqual(self.tests_triggers["push"]["branches"], ["main"])

    def test_pack_and_upload_are_gated_to_main_push(self):
        steps = self.tests["jobs"]["quality"]["steps"]
        pack = [s for s in steps if "release.py pack" in str(s.get("run", ""))]
        upload = [s for s in steps if str(s.get("uses", "")).startswith("actions/upload-artifact")]
        self.assertEqual(len(pack), 1, "exactly one pack step")
        self.assertEqual(len(upload), 1, "exactly one upload step")
        gate = "github.event_name == 'push' && github.ref == 'refs/heads/main'"
        self.assertIn(gate, pack[0]["if"])
        self.assertIn(gate, upload[0]["if"])

    def test_artifact_is_named_for_the_exact_commit_sha(self):
        steps = self.tests["jobs"]["quality"]["steps"]
        upload = [s for s in steps if str(s.get("uses", "")).startswith("actions/upload-artifact")][0]
        self.assertEqual(upload["with"]["name"], "release-${{ github.sha }}")
        # No overwrite: an immutable artifact per commit is what the deploy binds to.
        self.assertIs(upload["with"]["overwrite"], False)

    def test_pack_uses_the_same_sha_it_is_uploaded_under(self):
        steps = self.tests["jobs"]["quality"]["steps"]
        pack = [s for s in steps if "release.py pack" in str(s.get("run", ""))][0]
        self.assertIn('--sha "$GITHUB_SHA"', pack["run"])

    # ── the consumer ────────────────────────────────────────────────────
    def test_deploy_downloads_the_merge_commit_artifact_only(self):
        steps = self.prod["jobs"]["deploy"]["steps"]
        download = [s for s in steps if str(s.get("uses", "")).startswith("actions/download-artifact")]
        self.assertEqual(len(download), 1)
        self.assertEqual(download[0]["with"]["name"], "release-${{ github.sha }}")

    def test_deploy_checks_out_the_same_sha_it_downloads(self):
        steps = self.prod["jobs"]["deploy"]["steps"]
        checkout = [s for s in steps if str(s.get("uses", "")).startswith("actions/checkout")][0]
        self.assertEqual(checkout["with"]["ref"], "${{ github.sha }}")

    def test_staging_receipt_never_appears_in_the_production_pipeline(self):
        """The staging receipt authorizes the accepted candidate, not a main merge."""
        for path in (PROD, TESTS):
            text = path.read_text()
            for marker in ("14310493554", "44044616407", "220a0190"):
                self.assertNotIn(marker, text, "%s in %s" % (marker, path.name))

    # ── the disabled gate ───────────────────────────────────────────────
    def test_production_gate_is_disabled_by_source_constant(self):
        transport = (ROOT / "scripts" / "ci" / "production_deploy_transport.py").read_text()
        self.assertIn("PRODUCTION_DEPLOY_ACTIVATED = False", transport)

    def test_deploy_job_cannot_run_without_the_gate_output(self):
        self.assertEqual(self.prod["jobs"]["deploy"]["needs"], "gate")
        self.assertIn("needs.gate.outputs.enabled == 'true'",
                      self.prod["jobs"]["deploy"]["if"])

    def test_gate_requires_both_a_constant_and_a_repository_variable(self):
        steps = self.prod["jobs"]["gate"]["steps"]
        body = " ".join(str(s.get("run", "")) for s in steps)
        self.assertIn("PRODUCTION_DEPLOY_ACTIVATED = True", body)
        # The repository variable reaches the gate through this env mapping.
        self.assertIn("REPOSITORY_ENABLED", body)
        self.assertIn("activated and repo", body)
        gate = [s for s in steps if s.get("id") == "activation"][0]
        self.assertEqual(gate["env"]["REPOSITORY_ENABLED"],
                         "${{ vars.PRODUCTION_DEPLOY_ENABLED }}")

    def test_main_push_alone_cannot_reach_a_host_step(self):
        """Every host-capable step is inside the gated deploy job."""
        gated = self.prod["jobs"]["deploy"]["steps"]
        hostish = [s for s in gated
                   if "production_ssh_transport" in str(s.get("run", ""))
                   or "ssh" in str(s.get("run", "")).lower()]
        self.assertTrue(hostish, "expected the transport steps in the gated job")
        for other in ("gate", "rollback"):
            for step in self.prod["jobs"][other]["steps"]:
                self.assertNotIn("production_ssh_transport", str(step.get("run", "")),
                                 "host step escaped the gate in job " + other)

    def test_rollback_is_manual_and_takes_an_operation_id(self):
        job = self.prod["jobs"]["rollback"]
        self.assertIn("workflow_dispatch", job["if"])
        inputs = self.prod_triggers["workflow_dispatch"]["inputs"]
        self.assertIn("operation_id", inputs)

    def test_no_automatic_retry_anywhere(self):
        text = PROD.read_text()
        self.assertNotIn("retry", text.lower())
        self.assertNotIn("continue-on-error", text)

    def test_schedule_and_pr_triggers_are_absent(self):
        for forbidden in ("schedule", "pull_request", "repository_dispatch"):
            self.assertNotIn(forbidden, self.prod_triggers)


if __name__ == "__main__":
    unittest.main()
