import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
import unittest
from unittest.mock import patch

import staging_attempt_guard as guard


def claim(home, run_id="7001", workflow_sha="c" * 40, release_sha="a" * 40):
    return {
        "version": 1,
        "repository": guard.REPOSITORY,
        "actor": guard.OWNER,
        "ref": guard.REF,
        "workflow_ref": guard.WORKFLOW_REF,
        "workflow_sha": workflow_sha,
        "source_sha": workflow_sha,
        "release_sha": release_sha,
        "ci_run_id": "43720516972",
        "artifact_id": "14164321503",
        "artifact_run_id": "43720516972",
        "archive_sha256": "b" * 64,
        "github_run_id": run_id,
        "github_run_attempt": "1",
        "transfer_id": f"{run_id}-1",
    }


class StagingAttemptGuardTests(unittest.TestCase):
    def run_in_home(self, home, function, *args, **kwargs):
        old_home = os.environ.get("HOME")
        os.environ["HOME"] = str(home)
        try:
            return function(*args, **kwargs)
        finally:
            if old_home is None:
                os.environ.pop("HOME", None)
            else:
                os.environ["HOME"] = old_home

    def test_first_claim_is_persistent_and_bound_to_attempt(self):
        with tempfile.TemporaryDirectory() as temp:
            home = Path(temp)
            parent = home / "dombi-ci-staging"
            parent.mkdir(mode=0o700)
            value = claim(home)
            self.run_in_home(home, guard.create_claim, parent, value)

            self.assertEqual(
                self.run_in_home(
                    home, guard.verify_claim, parent, "7001-1", "c" * 40, "a" * 40, "deploy",
                ),
                value,
            )
            path = guard.claim_path(parent, "a" * 40)
            self.assertEqual(path.stat().st_mode & 0o777, 0o500)
            self.assertEqual((path / "claim.json").stat().st_mode & 0o777, 0o400)
            with self.assertRaisesRegex(ValueError, "already consumed"):
                self.run_in_home(home, guard.create_claim, parent, claim(home, run_id="7002"))

    def test_rerun_duplicate_and_mismatched_rollback_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            home = Path(temp)
            parent = home / "dombi-ci-staging"
            value = claim(home)
            self.run_in_home(home, guard.create_claim, parent, value)
            for attempt in ("2", "0"):
                invalid = {**value, "github_run_attempt": attempt, "transfer_id": f'7001-{attempt}'}
                with self.assertRaises(ValueError):
                    guard.validate_claim(invalid)
            with self.assertRaisesRegex(ValueError, "different deployment attempt"):
                self.run_in_home(
                    home, guard.verify_claim, parent, "7002-1", "c" * 40, "a" * 40, "rollback",
                )
            with self.assertRaisesRegex(ValueError, "different deployment attempt"):
                self.run_in_home(
                    home, guard.verify_claim, parent, "7001-1", "d" * 40, "a" * 40, "rollback",
                )

    def test_concurrent_dispatches_have_exactly_one_atomic_winner(self):
        with tempfile.TemporaryDirectory() as temp:
            home = Path(temp)
            parent = home / "dombi-ci-staging"
            attempts = [claim(home, run_id=str(7100 + index)) for index in range(12)]

            def attempt_claim(value):
                return subprocess.run(
                    [
                        sys.executable, str(guard.__file__), "claim",
                        "--parent", str(parent), "--claim-json",
                        json.dumps(value, sort_keys=True, separators=(",", ":")),
                    ],
                    env={**os.environ, "HOME": str(home)},
                    capture_output=True,
                    text=True,
                    check=False,
                )

            with ThreadPoolExecutor(max_workers=len(attempts)) as executor:
                results = list(executor.map(attempt_claim, attempts))
            self.assertEqual(sum(result.returncode == 0 for result in results), 1)
            self.assertEqual(sum(result.returncode != 0 for result in results), len(attempts) - 1)
            self.assertTrue(all("STAGING_ATTEMPT_GUARD_FAIL" in result.stderr
                                for result in results if result.returncode != 0))

    def test_fsync_failure_leaves_guard_spent(self):
        with tempfile.TemporaryDirectory() as temp:
            home = Path(temp)
            parent = home / "dombi-ci-staging"
            parent.mkdir(mode=0o700)
            value = claim(home)
            with patch.object(guard.os, "fsync", side_effect=OSError("injected fsync failure")):
                with self.assertRaisesRegex(OSError, "fsync"):
                    self.run_in_home(home, guard.create_claim, parent, value)
            self.assertTrue(guard.claim_path(parent, value["release_sha"]).is_dir())
            with self.assertRaisesRegex(ValueError, "already consumed"):
                self.run_in_home(home, guard.create_claim, parent, value)

    def test_interrupted_claim_persists_and_roll_back_verification_does_not_consume_again(self):
        with tempfile.TemporaryDirectory() as temp:
            home = Path(temp)
            parent = home / "dombi-ci-staging"
            value = claim(home)
            self.run_in_home(home, guard.create_claim, parent, value)

            # Reload from the durable receipt as a new process would after interruption.
            script = Path(guard.__file__)
            result = subprocess.run(
                [
                    sys.executable, str(script), "verify",
                    "--parent", str(parent),
                    "--transfer-id", "7001-1",
                    "--workflow-sha", "c" * 40,
                    "--release-sha", "a" * 40,
                    "--mode", "rollback",
                ],
                env={**os.environ, "HOME": str(home)},
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("STAGING_ATTEMPT_GUARD_ROLLBACK_PASS", result.stdout)
            self.assertTrue((guard.claim_path(parent, "a" * 40) / "claim.json").is_file())
            with self.assertRaisesRegex(ValueError, "already consumed"):
                self.run_in_home(home, guard.create_claim, parent, claim(home, run_id="7002"))

    def test_unsafe_parent_and_tampered_receipt_fail_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            home = Path(temp)
            real_parent = home / "real-staging"
            real_parent.mkdir(mode=0o700)
            (home / "dombi-ci-staging").symlink_to(real_parent, target_is_directory=True)
            with self.assertRaises(ValueError):
                self.run_in_home(
                    home, guard.create_claim, home / "dombi-ci-staging", claim(home),
                )

        with tempfile.TemporaryDirectory() as temp:
            home = Path(temp)
            parent = home / "dombi-ci-staging"
            value = claim(home)
            self.run_in_home(home, guard.create_claim, parent, value)
            receipt = guard.claim_path(parent, value["release_sha"]) / "claim.json"
            receipt.chmod(0o600)
            receipt.write_text(json.dumps({**value, "github_run_id": "9999"}))
            receipt.chmod(0o400)
            with self.assertRaisesRegex(ValueError, "Transfer ID"):
                self.run_in_home(
                    home, guard.verify_claim, parent, "7001-1", "c" * 40, "a" * 40, "rollback",
                )


if __name__ == "__main__":
    unittest.main()
