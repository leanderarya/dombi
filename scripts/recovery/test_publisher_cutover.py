"""Fail-closed cutover readiness gates for the gated production publisher.

Synthetic fixtures only: every policy is a temporary directory owned by the
current account, and `fs.PRODUCTION` is never provisioned, written or inspected.
These tests prove the production door refuses to open without a complete,
non-destructive callback/worker attestation, that the attestation is bound into
the rollback record, and that the publisher never upgrades a declaration into a
claim of verified host behaviour.
"""

import importlib.util
from pathlib import Path
import sys
import unittest
from unittest import mock


PRODUCTION = importlib.util.spec_from_file_location(
    "test_publisher_production", Path(__file__).with_name("test_publisher_production.py"))
production = importlib.util.module_from_spec(PRODUCTION)
sys.modules[PRODUCTION.name] = production
PRODUCTION.loader.exec_module(production)

publisher = production.publisher
fs = publisher.fs


class CutoverGateTests(production.ProductionPublisherFixture):
    """The cutover gate, asserted on the same reviewed synthetic fixture."""

    def request(self, cutover, **changes):
        """Capture once, then build a signed production request for this tree state."""
        if self.manifest_sha is None:
            self.capture()
        self.sequence += 1
        label = "artifact-" + str(self.sequence)
        archive, checksum, digest, files = self.build_artifact(
            self.candidate_contents(**{"app/service.php": b"synthetic candidate\n"}),
            label=label)
        approval = self.artifact_approval(digest, files, cutover=cutover)
        signature = self.sign(approval, label="signature-" + str(self.sequence))
        return approval, signature, archive, checksum, self.candidate(digest)

    def assert_refused(self, code, cutover):
        approval, signature, archive, checksum, candidate = self.request(cutover)
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, code):
            self.publish(approval, signature, archive, checksum, candidate)
        self.assertEqual(before, self.snapshot(self.root))
        self.assertFalse(any(self.directory.glob("publication-*")))

    # ── missing and malformed evidence ────────────────────────────────
    def test_refuses_a_publication_with_no_cutover_attestation(self):
        approval, signature, archive, checksum, candidate = self.request(None)
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "cutover_evidence_missing"):
            self.publish(approval, signature, archive, checksum, candidate)
        self.assertEqual(before, self.snapshot(self.root))

    def test_refuses_an_attestation_with_extra_or_missing_keys(self):
        self.assert_refused("cutover_evidence_contract",
                            dict(self.cutover(), unexpected="synthetic"))
        self.assert_refused("cutover_evidence_contract",
                            {k: v for k, v in self.cutover().items() if k != "procedure"})

    def test_refuses_a_valid_attestation_under_a_stale_approval(self):
        """A complete attestation never rescues an expired approval."""
        approval, signature, archive, checksum, candidate = self.request(self.cutover())
        value = fs.load_json(approval)
        past = publisher.fs.now() - publisher.dt.timedelta(minutes=30)
        value["issued_utc"] = past.isoformat()
        value["expires_utc"] = (past + publisher.dt.timedelta(minutes=10)).isoformat()
        value["identity_verified_utc"] = past.isoformat()
        stale = self.private / "synthetic-stale-approval.json"
        fs.write_json(stale, value)
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "approval_expired"):
            self.publish(stale, self.sign(stale), archive, checksum, candidate)
        self.assertEqual(before, self.snapshot(self.root))

    def test_refuses_an_overclaimed_attestation(self):
        """Declarations are honest or refused; an unverifiable 'verified' claim is not."""
        self.assert_refused("cutover_evidence_overclaim",
                            self.cutover(evidence_class="verified"))
        self.assert_refused("cutover_evidence_overclaim",
                            self.cutover(verified_by_publisher=True))

    # ── callback continuity ───────────────────────────────────────────
    def test_refuses_a_callback_gate_coupled_to_admission(self):
        self.assert_refused("cutover_callback_gate", self.cutover(callback_continuity={
            "gate": "admission-enforced"}))

    def test_refuses_callbacks_that_are_not_registered_without_admission(self):
        self.assert_refused("cutover_callback_routes", self.cutover(callback_continuity={
            "routes": "registered-with-admission-middleware"}))

    def test_refuses_a_wide_admission_scope(self):
        self.assert_refused("cutover_callback_admission_scope", self.cutover(
            callback_continuity={"admission_scope": "all-routes"}))

    def test_refuses_an_unevidenced_callback_declaration(self):
        self.assert_refused("cutover_callback_verification", self.cutover(
            callback_continuity={"verification": "   "}))

    # ── worker adoption ───────────────────────────────────────────────
    def test_refuses_global_maintenance_mode(self):
        self.assert_refused("cutover_worker_maintenance", self.cutover(
            worker_adoption={"global_maintenance_mode": True}))

    def test_refuses_worker_steps_without_the_required_phases(self):
        self.assert_refused("cutover_worker_steps", self.cutover(worker_adoption={
            "steps": ["drain: stop checkout", "verify: look at it"]}))

    def test_refuses_worker_steps_in_the_wrong_order(self):
        self.assert_refused("cutover_worker_order", self.cutover(worker_adoption={
            "steps": ["adopt: restart workers", "drain: stop checkout",
                      "verify: confirm liveness"]}))

    def test_refuses_an_empty_worker_command_list(self):
        self.assert_refused("cutover_worker_commands", self.cutover(
            worker_adoption={"commands": []}))

    def test_refuses_destructive_or_global_maintenance_commands(self):
        for command in ("php artisan down", "php artisan migrate --force",
                        "php artisan migrate:fresh", "php artisan db:wipe"):
            with self.subTest(command=command):
                self.assert_refused("cutover_forbidden_command",
                                    self.cutover(worker_adoption={"commands": [command]}))

    def test_refuses_an_unevidenced_worker_declaration(self):
        self.assert_refused("cutover_worker_verification", self.cutover(
            worker_adoption={"verification": ""}))

    # ── procedure pin ─────────────────────────────────────────────────
    def test_refuses_a_missing_or_malformed_procedure_pin(self):
        self.assert_refused("cutover_procedure_reference", self.cutover(
            procedure={"reference": "  "}))
        self.assert_refused("cutover_procedure_digest", self.cutover(
            procedure={"sha256": "not-a-digest"}))

    def test_refuses_a_procedure_pin_whose_document_is_absent(self):
        self.assert_refused("cutover_procedure_missing", self.cutover(
            procedure={"reference": "absent-procedure.md"}))

    def test_refuses_a_procedure_pin_whose_bytes_changed(self):
        """A pin is only meaningful if the reviewed bytes still match."""
        approval, signature, archive, checksum, candidate = self.request(self.cutover())
        procedure = self.private / "synthetic-cutover-procedure.md"
        procedure.chmod(0o600)
        procedure.write_bytes(b"Edited after review.\n")
        with self.assertRaisesRegex(fs.CheckpointError, "cutover_procedure_drift"):
            self.publish(approval, signature, archive, checksum, candidate)

    def test_refuses_a_procedure_pin_outside_the_private_directory(self):
        self.assert_refused("cutover_procedure_boundary", self.cutover(
            procedure={"reference": "../escaped-procedure.md"}))

    # ── accepted attestation is bound, not trusted ────────────────────
    def test_accepted_attestation_is_bound_into_the_rollback_record(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        result = self.publish(approval, signature, archive, checksum, candidate)
        self.assertEqual(result["status"], publisher.SUCCESS)
        operation = self.directory / ("publication-" + fs.file_digest(approval))
        record = fs.load_json(operation / "rollback.json")
        self.assertEqual(record["realm"], publisher.PRODUCTION_REALM)
        self.assertEqual(record["cutover_attestation"], self.cutover())
        self.assertEqual(record["cutover_evidence_sha256"],
                         fs.object_digest(self.cutover()))
        self.assertEqual(record["cutover_attestation"]["evidence_class"],
                         "declared-not-verified")
        self.assertIs(record["cutover_attestation"]["verified_by_publisher"], False)

    def test_tampered_bound_attestation_blocks_further_publication(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        self.publish(approval, signature, archive, checksum, candidate)
        path = self.directory / ("publication-" + fs.file_digest(approval)) / "rollback.json"
        record = fs.load_json(path)
        record["cutover_attestation"]["worker_adoption"]["global_maintenance_mode"] = True
        path.chmod(0o600)
        path.write_bytes(publisher.fs.encoded(record) + b"\n")
        with self.assertRaisesRegex(fs.CheckpointError, "cutover_evidence_digest"):
            publisher.prior_publications(self.directory)

    def test_attestation_that_no_longer_validates_blocks_lineage(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        self.publish(approval, signature, archive, checksum, candidate)
        path = self.directory / ("publication-" + fs.file_digest(approval)) / "rollback.json"
        record = fs.load_json(path)
        record["cutover_attestation"]["evidence_class"] = "verified"
        record["cutover_evidence_sha256"] = fs.object_digest(record["cutover_attestation"])
        path.chmod(0o600)
        path.write_bytes(publisher.fs.encoded(record) + b"\n")
        with self.assertRaisesRegex(fs.CheckpointError, "cutover_evidence_overclaim"):
            publisher.prior_publications(self.directory)

    def test_fixture_realm_needs_no_cutover_attestation(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact(
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
            "cutover": None,
        })
        publisher.publish_artifact(self.policy, self.checkpoint_id, self.manifest_sha,
                                   approval, archive, checksum)
        record = fs.load_json(self.directory / ("publication-" + fs.file_digest(approval))
                              / "rollback.json")
        self.assertEqual(record["realm"], publisher.FIXTURE_REALM)
        self.assertIsNone(record["cutover_attestation"])
        self.assertIsNone(record["cutover_evidence_sha256"])

    # ── candidate and preservation preconditions ──────────────────────
    def test_refuses_a_candidate_pin_that_disagrees_with_the_approval(self):
        approval, signature, archive, checksum, candidate = self.request(self.cutover())
        wrong = self.candidate(checksum.read_text().split()[0], application_sha="c" * 40)
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "approval_candidate_application"):
            self.publish(approval, signature, archive, checksum, wrong)
        self.assertEqual(before, self.snapshot(self.root))

    def test_refuses_a_missing_protected_path_before_opening(self):
        """A vanished database/.env path is data loss, not a tolerated drift."""
        self.capture()
        (self.root / "database/local.sqlite").unlink()
        approval, signature, archive, checksum, candidate = self.request(self.cutover())
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "production_protected_state_missing"):
            self.publish(approval, signature, archive, checksum, candidate)
        self.assertEqual(before, self.snapshot(self.root))

    def test_refuses_a_checkpoint_archive_that_no_longer_matches(self):
        approval, signature, archive, checksum, candidate = self.request(self.cutover())
        (self.directory / "code.tar.gz").write_bytes(b"synthetic substituted archive")
        with self.assertRaises(fs.CheckpointError):
            self.publish(approval, signature, archive, checksum, candidate)

    # ── interrupted publication ───────────────────────────────────────
    def test_interrupted_cutover_publication_keeps_attestation_and_never_completes(self):
        import os
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
                raise KeyboardInterrupt("synthetic cutover interruption")
            return replace(*args, **kwargs)

        with mock.patch.object(fs.os, "replace", side_effect=interrupt):
            with self.assertRaises(KeyboardInterrupt):
                self.publish(approval, signature, archive, checksum, candidate)
        operation = self.directory / ("publication-" + fs.file_digest(approval))
        self.assertFalse((operation / "outcome.json").exists())
        record = fs.load_json(operation / "rollback.json")
        self.assertEqual(record["cutover_attestation"], self.cutover())
        self.assertIn(b"FAILED_OR_INTERRUPTED_KEEP_HELD",
                      (operation / "journal.jsonl").read_bytes())


class CallbackIndependenceTests(unittest.TestCase):
    """Static guard: DOKU callbacks must never depend on checkout admission."""

    def setUp(self):
        self.routes = (Path(__file__).parents[2] / "routes" / "web.php").read_text()

    def test_doku_callback_routes_are_registered_without_admission_middleware(self):
        for path in ("/payment/doku/notify", "/payment/doku/redirect"):
            with self.subTest(path=path):
                self.assertIn(path, self.routes)
        for line in self.routes.splitlines():
            if "/payment/doku/" in line:
                self.assertNotIn("admission", line.lower(),
                                 f"callback route must stay ungated: {line.strip()}")

    def test_admission_middleware_is_attached_per_route_only(self):
        bootstrap = (Path(__file__).parents[2] / "bootstrap" / "app.php").read_text()
        self.assertIn("'admission.customer' => CheckCustomerAdmission::class", bootstrap)
        self.assertNotIn("->withMiddleware(\n        CheckCustomerAdmission::class", bootstrap)
        self.assertNotIn("append(CheckCustomerAdmission::class)", bootstrap)

    def test_cutover_procedure_document_exists_and_forbids_global_down(self):
        document = (Path(__file__).parents[2] / "docs" / "CUTOVER_CALLBACK_WORKER.md").read_text()
        self.assertIn("php artisan queue:restart", document)
        self.assertIn("must\n  remain registered without the admission middleware", document)
        self.assertIn("**No global maintenance mode.** `php artisan down` is forbidden.",
                      document)
        self.assertIn("RECOVER <root> TO CHECKPOINT", document)


if __name__ == "__main__":
    unittest.main()