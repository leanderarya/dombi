"""Main push -> Quality Gate -> same-SHA artifact -> disabled production gate.

Structural tests over the two workflows. They prove the artifact a main merge
produces is named for exactly that merge commit, that the deploy job consumes
that same name and no other, and that all of it stays behind the disabled gate.
"""

import copy
import json
from pathlib import Path
import subprocess
import unittest

import yaml


ROOT = Path(__file__).parents[2]
TESTS = ROOT / ".github" / "workflows" / "tests.yml"
PROD = ROOT / ".github" / "workflows" / "deploy-production.yml"

RESOLVER_FIXTURE = """
const fixture = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
const calls = [];
const outputs = {};
const github = {rest: {actions: {
  listWorkflowRuns: async (query) => {
    calls.push(['runs', query]);
    if (fixture.forbidden === 'runs') throw new Error('403: Actions read denied');
    return {data: fixture.runs};
  },
  listWorkflowRunArtifacts: async (query) => {
    calls.push(['artifacts', query]);
    if (fixture.forbidden === 'artifacts') throw new Error('403: Actions read denied');
    return {data: fixture.artifacts};
  },
}}};
const core = {setOutput: (name, value) => {outputs[name] = value;}};
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const resolve = new AsyncFunction('github', 'context', 'core', fixture.script);
const report = error => console.log(JSON.stringify({error, calls, outputs}));
resolve(github, fixture.context, core).then(() => report(null), error => report(error.message));
"""


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

    def test_download_uses_only_the_resolved_run_and_fails_before_transfer(self):
        steps = self.prod["jobs"]["deploy"]["steps"]
        resolve = next(i for i, s in enumerate(steps) if s.get("id") == "quality-run")
        download = next(i for i, s in enumerate(steps) if
                        s.get("uses") == "actions/download-artifact@v4")
        verify = next(i for i, s in enumerate(steps) if s.get("id") == "artifact")
        upload = next(i for i, s in enumerate(steps) if
                      "production_ssh_transport.py --phase upload" in s.get("run", ""))
        self.assertLess(resolve, download)
        self.assertLess(download, verify)
        self.assertLess(verify, upload)
        self.assertEqual(steps[download]["with"]["run-id"], "${{ steps.quality-run.outputs.run-id }}")
        self.assertEqual(self.prod["permissions"], {"contents": "read", "actions": "read"})
        for step in steps[resolve:]:
            self.assertNotIn("if", step)  # Default success() prevents transfer on failure.
            self.assertNotIn("continue-on-error", step)
        for index in (resolve, download):
            self.assertEqual(steps[index]["with"]["github-token"], "${{ secrets.GITHUB_TOKEN }}")

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


class QualityRunResolverTests(unittest.TestCase):
    def setUp(self):
        workflow, _ = load(PROD)
        step = next(s for s in workflow["jobs"]["deploy"]["steps"] if s.get("id") == "quality-run")
        self.assertEqual(step["uses"], "actions/github-script@v7")
        self.sha = "a" * 40
        self.name = "release-" + self.sha
        self.run = {"id": 101, "repository": {"full_name": "leanderarya/dombi"},
                    "head_repository": {"full_name": "leanderarya/dombi"},
                    "head_sha": self.sha, "head_branch": "main", "event": "push",
                    "path": ".github/workflows/tests.yml", "status": "completed",
                    "conclusion": "success"}
        self.artifact = {"id": 201, "name": self.name, "expired": False,
                         "workflow_run": {"id": 101, "head_sha": self.sha}}
        self.fixture = {"script": step["with"]["script"],
                        "context": {"repo": {"owner": "leanderarya", "repo": "dombi"},
                                    "sha": self.sha, "ref": "refs/heads/main",
                                    "eventName": "push", "runId": 999},
                        "runs": {"total_count": 1, "workflow_runs": [self.run]},
                        "artifacts": {"total_count": 1, "artifacts": [self.artifact]}}

    def exercise(self, fixture=None):
        result = subprocess.run(["node", "-e", RESOLVER_FIXTURE],
                                input=json.dumps(fixture or self.fixture),
                                capture_output=True, text=True, check=True, timeout=10)
        return json.loads(result.stdout)

    def test_resolves_exact_quality_run_instead_of_current_deploy_run(self):
        self.assertEqual(self.exercise(), {
            "error": None, "outputs": {"run-id": "101"},
            "calls": [
                ["runs", {"owner": "leanderarya", "repo": "dombi", "workflow_id": "tests.yml",
                          "branch": "main", "event": "push", "head_sha": self.sha, "per_page": 2}],
                ["artifacts", {"owner": "leanderarya", "repo": "dombi", "run_id": 101,
                               "name": self.name, "per_page": 2}],
            ]})

    def assert_refused(self, fixture, message, calls):
        result = self.exercise(fixture)
        self.assertIn(message, result["error"])
        self.assertEqual(result["outputs"], {})
        self.assertEqual([name for name, _ in result["calls"]], calls)

    def test_refuses_noncanonical_trigger_before_api_lookup(self):
        for key, value in (("repo", {"owner": "fork", "repo": "dombi"}),
                           ("ref", "refs/heads/develop"), ("eventName", "pull_request"),
                           ("sha", "aa")):
            with self.subTest(key=key):
                fixture = copy.deepcopy(self.fixture)
                fixture["context"][key] = value
                self.assert_refused(fixture, "canonical main", [])

    def test_refuses_missing_or_ambiguous_runs(self):
        for runs in ([], [self.run, dict(self.run, id=102)]):
            with self.subTest(count=len(runs)):
                fixture = dict(self.fixture, runs={"total_count": len(runs), "workflow_runs": runs})
                self.assert_refused(fixture, "exactly one Quality Gate run", ["runs"])

    def test_refuses_mismatched_or_unsuccessful_run_before_artifact_lookup(self):
        for key, value in (("id", 999), ("head_sha", "b" * 40), ("head_branch", "develop"),
                           ("event", "pull_request"), ("path", ".github/workflows/deploy.yml"),
                           ("repository", {"full_name": "fork/dombi"}),
                           ("head_repository", {"full_name": "fork/dombi"}),
                           ("status", "queued"), ("status", "in_progress"),
                           ("conclusion", "failure"), ("conclusion", None)):
            with self.subTest(key=key, value=value):
                fixture = dict(self.fixture, runs={
                    "total_count": 1, "workflow_runs": [dict(self.run, **{key: value})]})
                self.assert_refused(fixture, "mismatched or not successful", ["runs"])

    def test_refuses_missing_duplicate_expired_or_mismatched_artifacts(self):
        for artifacts, reason in (
            ([], "exactly one release artifact"),
            ([self.artifact, dict(self.artifact, id=202)], "exactly one release artifact"),
            ([dict(self.artifact, expired=True)], "expired or mismatched"),
            ([dict(self.artifact, name="release-other")], "expired or mismatched"),
            ([dict(self.artifact, workflow_run={"id": 999, "head_sha": self.sha})],
             "expired or mismatched"),
        ):
            with self.subTest(artifacts=artifacts):
                fixture = dict(self.fixture, artifacts={
                    "total_count": len(artifacts), "artifacts": artifacts})
                self.assert_refused(fixture, reason, ["runs", "artifacts"])

    def test_refuses_insufficient_actions_read_permission(self):
        for endpoint, calls in (("runs", ["runs"]), ("artifacts", ["runs", "artifacts"])):
            with self.subTest(endpoint=endpoint):
                self.assert_refused(dict(self.fixture, forbidden=endpoint), "403", calls)


if __name__ == "__main__":
    unittest.main()
