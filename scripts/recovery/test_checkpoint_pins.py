"""Pin ownership: the release candidate is deployment context, never baseline identity.

Synthetic fixtures only; `fs.PRODUCTION` is never provisioned, written or inspected.

The two identities must never be conflated:

* the *release candidate* (`CANDIDATE`) says which accepted artifact this tooling
  is reviewed against — deployment context;
* the *old-code baseline* is `historical_release_sha` (explicit JSON null) plus the
  captured inventory of the live tree — the thing a recovery actually restores.

A repin must therefore move the candidate only. If it also moved the old-code
baseline, a rollback would restore code that never ran in production.
"""

import importlib.util
from pathlib import Path
import re
import sys
import unittest


SOURCE = Path(__file__).with_name("filesystem_checkpoint.py").resolve()
SPEC = importlib.util.spec_from_file_location("filesystem_checkpoint_pins", SOURCE)
fs = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = fs
SPEC.loader.exec_module(fs)

CHECKPOINT = importlib.util.spec_from_file_location(
    "test_filesystem_checkpoint", Path(__file__).with_name("test_filesystem_checkpoint.py"))
checkpoint_tests = importlib.util.module_from_spec(CHECKPOINT)
sys.modules[CHECKPOINT.name] = checkpoint_tests
CHECKPOINT.loader.exec_module(checkpoint_tests)

ACCEPTED = {
    "artifact_id": "14305937487",
    "application_sha": "220a0190ec57c8ed64f5792dcaa10c7ca906f2b7",
    "archive_sha256": "f48b68fb0678df3c752fe3ce600709bda7f706ccda0570e447d5fcda834598fd",
}
SUPERSEDED = {
    "artifact_id": "14015610232",
    "application_sha": "4ebe5e1da608b0c7404e2667cb99742747db4796",
    "archive_sha256": "5b5a54453badc86134e890cb4f5448a80dce1fc1b391eec03ec41284988225d5",
}


class CandidatePinTests(unittest.TestCase):
    """Structural guarantees on the fixed release pin."""

    def test_candidate_is_exactly_the_accepted_release(self):
        self.assertEqual(fs.CANDIDATE, ACCEPTED)

    def test_candidate_is_not_the_superseded_release(self):
        self.assertNotEqual(fs.CANDIDATE, SUPERSEDED)
        for field in ("artifact_id", "application_sha", "archive_sha256"):
            with self.subTest(field=field):
                self.assertNotEqual(fs.CANDIDATE[field], SUPERSEDED[field])

    def test_candidate_has_exactly_the_three_contract_fields(self):
        self.assertEqual(set(fs.CANDIDATE), {"artifact_id", "application_sha", "archive_sha256"})
        self.assertTrue(fs.CANDIDATE["artifact_id"].strip())
        self.assertRegex(fs.CANDIDATE["application_sha"], r"\A[a-f0-9]{40}\Z")
        self.assertRegex(fs.CANDIDATE["archive_sha256"], r"\A[a-f0-9]{64}\Z")

    def test_candidate_matches_the_ci_release_selector(self):
        """One accepted release identity across CI selection and checkpoint tooling."""
        selector = (Path(__file__).parents[1] / "ci" / "select-release.cjs").read_text()
        self.assertIn(f"sha: '{ACCEPTED['application_sha']}'", selector)
        self.assertIn(f"artifactId: '{ACCEPTED['artifact_id']}'", selector)
        self.assertIn(f"archiveSha256: '{ACCEPTED['archive_sha256']}'", selector)


class OldCodeIdentityTests(checkpoint_tests.CheckpointFixture):
    """The baseline identity is never the release candidate."""

    def test_old_code_baseline_is_explicit_null_not_the_candidate(self):
        manifest = self.capture()
        self.assertIsNone(manifest["historical_release_sha"])
        self.assertEqual(manifest["candidate"], ACCEPTED)
        self.assertNotEqual(manifest["historical_release_sha"], manifest["candidate"])

    def test_capture_records_the_observed_tree_not_the_candidate_code(self):
        """The baseline is what is on disk; the candidate SHA is only context."""
        self.capture()
        baseline = (self.root / "app/service.php").read_bytes()
        self.assertEqual(baseline, b"synthetic baseline code\n")
        self.assertNotEqual(baseline, b"synthetic candidate code\n")
        manifest = fs.load_json(self.directory / "manifest.json")
        self.assertEqual(manifest["inventory"]["app/service.php"]["sha256"],
                         fs.hashlib.sha256(baseline).hexdigest())

    def test_manifest_rejects_a_non_null_historical_sha(self):
        manifest = self.capture()
        for value in ("220a0190ec57c8ed64f5792dcaa10c7ca906f2b7", "0" * 40, ""):
            with self.subTest(value=value):
                altered = dict(manifest, historical_release_sha=value)
                with self.assertRaisesRegex(fs.CheckpointError, "manifest_identity"):
                    fs.validate_manifest(self.policy, altered, self.checkpoint_id)

    def test_manifest_rejects_a_candidate_drift(self):
        manifest = self.capture()
        for field in ("artifact_id", "application_sha", "archive_sha256"):
            with self.subTest(field=field):
                drift = {**fs.CANDIDATE, field: SUPERSEDED[field]}
                altered = dict(manifest, candidate=drift)
                with self.assertRaisesRegex(fs.CheckpointError, "manifest_identity"):
                    fs.validate_manifest(self.policy, altered, self.checkpoint_id)

    def test_approval_must_carry_the_candidate_pin(self):
        approval = self.approval("filesystem-checkpoint-capture", candidate=SUPERSEDED)
        with self.assertRaisesRegex(fs.CheckpointError, "approval_tool_or_candidate"):
            fs.capture(self.policy, approval)

    def test_recovery_still_restores_the_observed_baseline_after_repin(self):
        """The repin must not change what a rollback restores."""
        self.capture()
        baseline = (self.root / "app/service.php").read_bytes()
        self.mutate()
        self.assertEqual((self.root / "app/service.php").read_bytes(), b"synthetic candidate code\n")
        self.recover()
        self.assertEqual((self.root / "app/service.php").read_bytes(), baseline)

    def test_tool_digest_is_still_the_module_identity(self):
        """The repin changes the tool file, so the digest must move, not silently stay."""
        self.assertEqual(fs.tool_digest(), fs.file_digest(SOURCE))
        self.assertRegex(fs.tool_digest(), r"\A[a-f0-9]{64}\Z")


if __name__ == "__main__":
    unittest.main()
