"""Rollback-readiness contract for the gated production publisher.

Synthetic fixtures only: every policy is a temporary directory owned by the
current account, and `fs.PRODUCTION` is never provisioned, written or inspected.
The tests prove the rollback record exists before any code is mutated, names the
same checkpoint and release the publication was authorized against, states which
state must survive a recovery, and blocks further publication when it is absent
or tampered with.
"""

import importlib.util
import json
import os
from pathlib import Path
import sys
import unittest
from unittest import mock


# Reuse the reviewed production fixture and its already-loaded publisher module,
# so patching the publisher mutates the exact module the fixture exercises.
PRODUCTION = importlib.util.spec_from_file_location(
    "test_publisher_production", Path(__file__).with_name("test_publisher_production.py"))
production = importlib.util.module_from_spec(PRODUCTION)
sys.modules[PRODUCTION.name] = production
PRODUCTION.loader.exec_module(production)

publisher = production.publisher
fs = publisher.fs


class RollbackContractTests(production.ProductionPublisherFixture):
    """The rollback contract, asserted on the same reviewed synthetic fixture."""

    def rollback_path(self, approval):
        return self.directory / ("publication-" + fs.file_digest(approval)) / "rollback.json"

    def test_rollback_record_is_written_before_any_code_changes(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        seen = {}
        original = publisher.prepare_rollback

        def observe(policy, operation, *args, **kwargs):
            metadata = original(policy, operation, *args, **kwargs)
            seen["record"] = fs.load_json(operation / "rollback.json")
            seen["service"] = (self.root / "app/service.php").read_bytes()
            seen["cache"] = (self.root / "app/cache.php").read_bytes()
            return metadata

        with mock.patch.object(publisher, "prepare_rollback", side_effect=observe):
            self.publish(approval, signature, archive, checksum, candidate)
        self.assertEqual(seen["record"]["status"], "PREPARED_NOT_EXECUTED")
        self.assertTrue(seen["record"]["requires_reopening_decision"])
        self.assertEqual(seen["service"], self.files["app/service.php"])
        self.assertEqual(seen["cache"], self.files["app/cache.php"])

    def test_rollback_identity_matches_checkpoint_and_release(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate, digest, files = request
        result = self.publish(approval, signature, archive, checksum, candidate)
        record = fs.load_json(self.rollback_path(approval))
        self.assertEqual(record["checkpoint_id"], self.checkpoint_id)
        self.assertEqual(record["manifest_sha256"], self.manifest_sha)
        self.assertEqual(record["artifact_application_sha"], result["artifact_application_sha"])
        self.assertEqual(record["artifact_sha256"], digest)
        self.assertEqual(record["publication_plan_sha256"],
                         fs.load_json(approval)["publication_plan_sha256"])

    def test_rollback_declares_preserved_state_and_recovery_command(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        self.publish(approval, signature, archive, checksum, candidate)
        record = fs.load_json(self.rollback_path(approval))
        self.assertEqual(record["recovery"]["mode"], "filesystem_checkpoint_recover")
        self.assertEqual(record["recovery"]["restores"], "managed-code-only")
        for name in ("database", "storage", ".env", "public/storage"):
            self.assertIn(name, record["recovery"]["preserved"])
        self.assertEqual(
            record["recovery"]["confirmation"],
            f"RECOVER {self.policy.root} TO CHECKPOINT {self.checkpoint_id} {self.manifest_sha}")

    def test_completion_outcome_pins_the_rollback_record(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        self.publish(approval, signature, archive, checksum, candidate)
        operation = self.directory / ("publication-" + fs.file_digest(approval))
        outcome = fs.load_json(operation / "outcome.json")
        self.assertEqual(outcome["rollback_sha256"],
                         fs.file_digest(operation / "rollback.json", private=True))
        self.assertEqual(outcome["rollback_status"], "PREPARED_NOT_EXECUTED")

    def test_interrupted_publication_keeps_a_usable_rollback_record(self):
        request = self.signed_candidate(**{
            "app/service.php": b"synthetic candidate service\n",
            "app/new.php": b"synthetic added file\n",
        })
        approval, signature, archive, checksum, candidate = request[:5]
        replace, count = os.replace, 0

        def interrupt(*args, **kwargs):
            nonlocal count
            count += 1
            if count == 2:
                raise KeyboardInterrupt("synthetic rollback interruption")
            return replace(*args, **kwargs)

        with mock.patch.object(fs.os, "replace", side_effect=interrupt):
            with self.assertRaises(KeyboardInterrupt):
                self.publish(approval, signature, archive, checksum, candidate)
        record = fs.load_json(self.rollback_path(approval))
        self.assertEqual(record["status"], "PREPARED_NOT_EXECUTED")
        self.assertEqual(record["manifest_sha256"], self.manifest_sha)
        self.assertTrue(record["recovery"]["confirmation"].startswith("RECOVER "))

    def test_failure_containment_never_claims_rollback_execution(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        with mock.patch.object(publisher, "artifact_matches",
                               side_effect=fs.CheckpointError("synthetic_failure")):
            with self.assertRaisesRegex(fs.CheckpointError, "synthetic_failure"):
                self.publish(approval, signature, archive, checksum, candidate)
        operation = self.directory / ("publication-" + fs.file_digest(approval))
        self.assertFalse((operation / "outcome.json").exists())
        self.assertEqual(fs.load_json(operation / "rollback.json")["status"],
                         "PREPARED_NOT_EXECUTED")
        self.assertIn(b"FAILED_OR_INTERRUPTED_KEEP_HELD",
                      (operation / "journal.jsonl").read_bytes())

    def test_rollback_record_survives_a_later_successful_publication(self):
        first = self.signed_candidate(**{"app/service.php": b"synthetic first\n"})
        self.publish(*first[:5])
        first_record = fs.load_json(self.rollback_path(first[0]))

        # A second publication against the same checkpoint: the first operation
        # directory is prior lineage, and its rollback record must stay intact.
        archive, checksum, digest, files = self.build_artifact(
            self.candidate_contents(**{"app/service.php": b"synthetic second\n"}),
            label="second")
        approval = self.artifact_approval(digest, files)
        self.publish(approval, self.sign(approval), archive, checksum,
                     self.candidate(digest))

        self.assertEqual(fs.load_json(self.rollback_path(first[0])), first_record)
        self.assertNotEqual(fs.file_digest(self.rollback_path(approval), private=True),
                            fs.file_digest(self.rollback_path(first[0]), private=True))

    def test_lineage_refuses_a_publication_outcome_without_rollback_metadata(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        self.publish(approval, signature, archive, checksum, candidate)
        operation = self.directory / ("publication-" + fs.file_digest(approval))
        (operation / "rollback.json").unlink()
        with self.assertRaisesRegex(fs.CheckpointError, "rollback_metadata_missing"):
            publisher.prior_publications(self.directory)

    def test_lineage_refuses_a_tampered_rollback_record(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        self.publish(approval, signature, archive, checksum, candidate)
        path = self.rollback_path(approval)
        record = fs.load_json(path)
        record["recovery"]["preserved"] = ["database"]
        path.chmod(0o600)
        path.write_bytes(json.dumps(record, sort_keys=True).encode() + b"\n")
        with self.assertRaisesRegex(fs.CheckpointError, "rollback_recovery_contract"):
            publisher.prior_publications(self.directory)

    def test_lineage_refuses_a_rollback_record_claiming_execution(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        self.publish(approval, signature, archive, checksum, candidate)
        path = self.rollback_path(approval)
        record = fs.load_json(path)
        record["status"] = "EXECUTED"
        path.chmod(0o600)
        path.write_bytes(json.dumps(record, sort_keys=True).encode() + b"\n")
        with self.assertRaisesRegex(fs.CheckpointError, "rollback_metadata_status"):
            publisher.prior_publications(self.directory)

    def test_rollback_record_is_not_written_into_the_application_root(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        self.publish(approval, signature, archive, checksum, candidate)
        self.assertFalse(list(self.root.rglob("rollback.json")))
        record = fs.load_json(self.rollback_path(approval))
        self.assertTrue(record["recovery"]["confirmation"].startswith("RECOVER "))
        self.assertIn(str(approval.parent), str(self.rollback_path(approval)))

    def test_rollback_failure_aborts_before_any_mutation(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        with mock.patch.object(publisher, "prepare_rollback",
                               side_effect=fs.CheckpointError("synthetic_rollback_failure")):
            with self.assertRaisesRegex(fs.CheckpointError, "synthetic_rollback_failure"):
                self.publish(approval, signature, archive, checksum, candidate)
        self.assertEqual((self.root / "app/service.php").read_bytes(),
                         self.files["app/service.php"])
        self.assertFalse((self.root / "app/new.php").exists())

    def test_rollback_records_the_volatile_allowance_it_was_written_under(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        self.publish(approval, signature, archive, checksum, candidate)
        record = fs.load_json(self.rollback_path(approval))
        self.assertEqual(record["volatile_policy"], publisher.volatile_policy())
        self.assertEqual(record["publisher_sha256"], publisher.publisher_digest())
        self.assertEqual(record["tool_sha256"], fs.tool_digest())

    def test_fixture_realm_also_records_rollback_metadata(self):
        self.capture()
        archive, checksum, _, files = self.build_artifact(
            self.candidate_contents(**{"app/service.php": b"synthetic fixture candidate\n"}))
        manifest = fs.load_json(self.directory / "manifest.json")
        plan = publisher.artifact_plan(
            manifest, fs.inventory(self.policy, self.boundaries), files)
        approval = self.approval(publisher.OPERATION, **{
            "artifact_application_sha": production.APP_SHA,
            "artifact_sha256": checksum.read_text().split()[0],
            "artifact_entries_sha256": fs.object_digest(files),
            "publication_plan_sha256": publisher.plan_digest(plan),
            "removals": plan["removals"],
        })
        publisher.publish_artifact(self.policy, self.checkpoint_id, self.manifest_sha,
                                   approval, archive, checksum)
        record = fs.load_json(self.rollback_path(approval))
        self.assertEqual(record["status"], "PREPARED_NOT_EXECUTED")
        self.assertEqual(record["artifact_application_sha"], production.APP_SHA)
        self.assertEqual(record["artifact_sha256"], checksum.read_text().split()[0])

    def test_recorded_confirmation_drives_a_real_managed_code_recovery(self):
        """The confirmation string in the record is the one that actually recovers.

        This is the end-to-end proof that the metadata is executable, not a label:
        the publication is undone through `fs.recover()` using exactly the recorded
        confirmation, and protected state survives it.
        """
        request = self.signed_candidate(**{
            "app/service.php": b"synthetic candidate service\n",
            "app/new.php": b"synthetic added file\n",
        })
        approval, signature, archive, checksum, candidate = request[:5]
        record = self.publish(approval, signature, archive, checksum, candidate)
        self.assertEqual((self.root / "app/service.php").read_bytes(),
                         b"synthetic candidate service\n")
        self.assertIn("app/new.php", record["additions"])

        rollback = fs.load_json(self.rollback_path(approval))
        protected = fs.stable_protected(fs.inventory(self.policy, self.boundaries))

        manifest = fs.load_json(self.directory / "manifest.json")
        observed = fs.inventory(self.policy, self.boundaries)
        recovery_approval = self.approval("filesystem-code-recovery", **{
            "manifest_sha256": self.manifest_sha,
            "prior_operations": fs.prior_operations(self.directory),
            "removals": fs.removal_plan(manifest, observed),
            "deletion_evidence_reference": "synthetic-rollback-readiness",
        })
        fs.recover(self.policy, self.checkpoint_id, self.manifest_sha,
                   recovery_approval, rollback["recovery"]["confirmation"])

        self.assertEqual((self.root / "app/service.php").read_bytes(),
                         self.files["app/service.php"])
        self.assertFalse((self.root / "app/new.php").exists())
        self.assertEqual(protected,
                         fs.stable_protected(fs.inventory(self.policy, self.boundaries)))
        self.assertEqual((self.root / ".env").read_bytes(),
                         b"SYNTHETIC_NOT_A_CREDENTIAL=true\n")
        self.assertTrue((self.root / "public/storage").is_symlink())
        self.assertTrue((self.root / "storage/app/public/upload.txt").exists())
        self.assertTrue((self.root / "database/local.sqlite").exists())


if __name__ == "__main__":
    unittest.main()
