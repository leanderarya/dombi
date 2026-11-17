"""Synthetic fixtures only; the fixed production policy and host are never touched.

Every policy here is a temporary directory owned by the current account. No lock,
key, approval, checkpoint or artifact is created outside the test's temporary
directory, and `fs.PRODUCTION` is never provisioned, written or inspected.
"""

import copy
import datetime as dt
import gzip
import hashlib
import hmac
import importlib.util
import io
import json
import os
from pathlib import Path
import pwd
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest import mock
import uuid


SOURCE = Path(__file__).with_name("code_publisher.py").resolve()
SPEC = importlib.util.spec_from_file_location("code_publisher_production", SOURCE)
publisher = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = publisher
SPEC.loader.exec_module(publisher)

fs = publisher.fs
APP_SHA = "a" * 40


class ProductionPublisherFixture(unittest.TestCase):
    """The reviewed synthetic production fixture, shared by related test modules."""

    def setUp(self):
        temporary = Path(tempfile.gettempdir()).resolve()
        preferred = temporary / "opencode"
        self.temporary = tempfile.TemporaryDirectory(
            prefix="dombi-production-synthetic-", dir=preferred if preferred.is_dir() else temporary,
        )
        self.addCleanup(self.temporary.cleanup)
        if not hasattr(os, "listxattr"):
            self.adapter = mock.patch.object(os, "listxattr", return_value=[], create=True)
            self.adapter.start()
            self.addCleanup(self.adapter.stop)
        self.acl = mock.patch.object(fs, "require_no_acl", lambda *_: None)
        self.acl.start()
        self.addCleanup(self.acl.stop)
        self.base = Path(self.temporary.name).resolve()
        self.root, self.private = self.base / "app", self.base / "private"
        self.keys = self.base / "keys"
        self.root.mkdir(mode=0o755)
        self.private.mkdir(mode=0o700)
        self.keys.mkdir(mode=0o700)
        self.policy = fs.Policy(self.root, self.private, pwd.getpwuid(os.getuid()).pw_name)
        for name in ("app", "public/build", "bootstrap/cache", "config", "vendor",
                     "storage/app/public", "storage/framework", "database"):
            (self.root / name).mkdir(parents=True, exist_ok=True)
        self.files = {
            "app/service.php": b"synthetic baseline service\n",
            "app/cache.php": b"synthetic baseline cache\n",
            "artisan": b"synthetic entrypoint, never executed\n",
            "composer.json": b'{"synthetic": true}\n',
            "composer.lock": b"synthetic lock\n",
            "bootstrap/app.php": b"synthetic bootstrap\n",
            "bootstrap/providers.php": b"synthetic providers\n",
            "public/build/manifest.json": b'{"synthetic": true}\n',
            "public/build/asset.js": b"synthetic baseline asset\n",
            "vendor/autoload.php": b"synthetic vendor, never executed\n",
            "config/app.php": b"synthetic configuration source\n",
        }
        for name, content in self.files.items():
            (self.root / name).write_bytes(content)
        for name, content in {
            ".env": b"SYNTHETIC_NOT_A_CREDENTIAL=true\n",
            "bootstrap/cache/config.php": b"synthetic generated cache\n",
            "storage/framework/down": b"synthetic containment marker\n",
            "storage/app/public/upload.txt": b"synthetic upload\n",
            "database/local.sqlite": b"not a real database\n",
        }.items():
            (self.root / name).write_bytes(content)
        (self.root / "public/storage").symlink_to("../storage/app/public")
        (self.root / "app/link.php").symlink_to("service.php")
        self.boundaries = {
            "managed_scopes": ["app", "artisan", "composer.json", "composer.lock",
                               "public", "bootstrap/app.php", "bootstrap/providers.php",
                               "config", "vendor"],
            "protected_paths": ["database"],
            "database_paths": [],
            "protected_links": {"public/storage": "../storage/app/public"},
        }
        self.policy.lock.write_bytes(b"")
        self.policy.lock.chmod(0o600)
        self.checkpoint_id = "dombi-fs-" + fs.now().strftime("%Y%m%dT%H%M%SZ-") + uuid.uuid4().hex
        self.manifest_sha = None
        self.sequence = 0
        for path in sorted(self.root.rglob("*"), key=lambda p: len(p.parts), reverse=True):
            os.utime(path, ns=(1700000000123456789, 1700000000123456789), follow_symlinks=False)
        self.key = self.provision_key("approval.key")

    # ── fixture helpers ────────────────────────────────────────────────
    @property
    def directory(self):
        return self.private / self.checkpoint_id

    def provision_key(self, name, material=None):
        material = material or os.urandom(48)
        path = self.keys / name
        path.write_bytes(material)
        path.chmod(0o600)
        return path

    def key_identity(self, path=None):
        return hashlib.sha256((path or self.key).read_bytes()).hexdigest()

    def cutover(self, **changes):
        """A synthetic cutover attestation; every value is a declaration, not proof."""
        procedure = self.private / "synthetic-cutover-procedure.md"
        if not procedure.exists():
            procedure.write_bytes(b"Synthetic callback/worker cutover procedure.\n")
            procedure.chmod(0o600)
        value = {
            "contract": publisher.CUTOVER_CONTRACT,
            "evidence_class": publisher.CUTOVER_EVIDENCE_CLASS,
            "verified_by_publisher": False,
            "callback_continuity": {
                "gate": publisher.CUTOVER_CALLBACK_GATE,
                "routes": publisher.CUTOVER_CALLBACK_ROUTES,
                "admission_scope": publisher.CUTOVER_ADMISSION_SCOPE,
                "verification": "synthetic: webhook route list holds no admission middleware",
            },
            "worker_adoption": {
                "global_maintenance_mode": False,
                "steps": [
                    "drain: stop accepting new checkout traffic via admission hold",
                    "adopt: publish code and restart queue workers with the new release",
                    "verify: confirm callback delivery and worker liveness before reopening",
                ],
                "commands": ["php artisan queue:restart"],
                "verification": "synthetic: queue:restart acknowledged by every worker",
            },
            "procedure": {
                "reference": "synthetic-cutover-procedure.md",
                "sha256": fs.file_digest(procedure, private=True),
            },
        }
        for name, change in changes.items():
            if isinstance(change, dict) and isinstance(value.get(name), dict):
                nested = dict(value[name])
                nested.update(change)
                value[name] = nested
            else:
                value[name] = change
        return value

    def approval(self, kind, **overrides):
        self.sequence += 1
        current = fs.now()
        observed = fs.inventory(self.policy, self.boundaries)
        value = {
            "operation": kind, "checkpoint_id": self.checkpoint_id,
            "operator": self.policy.account,
            "independent_verifier": "synthetic-independent-reviewer",
            "tool_sha256": fs.tool_digest(), "candidate": fs.CANDIDATE,
            "host_inventory_reference": "synthetic-host-inventory",
            "root_identity": fs.identity(self.policy, "synthetic-host-inventory"),
            "issued_utc": current.isoformat(),
            "expires_utc": (current + dt.timedelta(minutes=10)).isoformat(),
            "identity_verified_utc": current.isoformat(),
            "evidence": {key: "synthetic-only-" + key for key in fs.EVIDENCE},
            "publisher_lock_path": str(self.policy.lock),
            "effective_identity": {
                "environment": "production", "url": "https://app.dombicenter.com",
                "database": "u399215191_dombi_pr_1023",
            },
            "observed_state_sha256": fs.object_digest(observed),
            "boundaries": copy.deepcopy(self.boundaries),
            **{key: True for key in fs.FLAGS},
        }
        if kind == publisher.OPERATION:
            value["manifest_sha256"] = self.manifest_sha
            value["publisher_sha256"] = publisher.publisher_digest()
            value["volatile_policy"] = publisher.volatile_policy()
            value["prior_operations"] = publisher.prior_operation_lineage(self.directory)
            value["cutover"] = self.cutover()
        value.update(overrides)
        path = self.private / ("synthetic-approval-" + str(self.sequence) + ".json")
        fs.write_json(path, value)
        return path

    def sign(self, approval, key=None, label=None):
        """Write a detached signature over the approval's exact current bytes."""
        token = publisher.approval_signature(Path(approval).read_bytes(), (key or self.key).read_bytes())
        path = self.private / ((label or "synthetic-signature-")
                               + str(self.sequence) + ".sig")
        path.write_bytes((token + "\n").encode())
        path.chmod(0o600)
        return path

    def amended(self, approval, **changes):
        """Write a distinct approval file with edits applied; the old bytes stay signed."""
        self.sequence += 1
        value = fs.load_json(approval)
        for name, change in changes.items():
            if change is None:
                value.pop(name, None)
            else:
                value[name] = change
        path = self.private / ("synthetic-amended-" + str(self.sequence) + ".json")
        fs.write_json(path, value)
        return path

    def capture(self):
        result = fs.capture(self.policy, self.approval("filesystem-checkpoint-capture"))
        self.manifest_sha = result["manifest_sha256"]
        return fs.load_json(self.directory / "manifest.json")

    def build_artifact(self, contents, application_sha=APP_SHA, label="artifact"):
        manifest = {"schema": 1, "sha": application_sha,
                    "files": {name: hashlib.sha256(data).hexdigest()
                              for name, data in contents.items()}}
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
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        checksum = self.private / (label + ".sha256")
        checksum.write_bytes((digest + "  release.tar.gz\n").encode())
        checksum.chmod(0o600)
        return archive, checksum, digest, manifest["files"]

    def candidate(self, digest, **changes):
        """The synthetic release pin: a fixture identity, never the real one."""
        value = {"artifact_id": "synthetic-candidate", "application_sha": APP_SHA,
                 "archive_sha256": digest}
        value.update(changes)
        return value

    def artifact_approval(self, digest, files, **overrides):
        manifest = fs.load_json(self.directory / "manifest.json")
        observed = fs.inventory(self.policy, self.boundaries)
        plan = publisher.artifact_plan(manifest, observed, files)
        fields = {
            "artifact_application_sha": APP_SHA,
            "artifact_sha256": digest,
            "artifact_entries_sha256": fs.object_digest(files),
            "publication_plan_sha256": publisher.plan_digest(plan),
            "removals": plan["removals"],
            "production_key_sha256": self.key_identity(),
        }
        fields.update(overrides)
        return self.approval(publisher.OPERATION, **fields)

    def candidate_contents(self, **changes):
        contents = dict(self.files)
        for name, value in changes.items():
            if value is None:
                contents.pop(name, None)
            else:
                contents[name] = value
        return contents

    def publish(self, approval, signature, archive, checksum, candidate=None,
                key=None, policy=None):
        return publisher.publish_artifact_production(
            policy or self.policy, self.checkpoint_id, self.manifest_sha, approval,
            signature, key or self.key, archive, checksum, candidate)

    def snapshot(self, path):
        result = {}
        for item in [path, *sorted(path.rglob("*"))]:
            s = item.lstat()
            value = (s.st_mode, s.st_uid, s.st_gid, s.st_size, s.st_mtime_ns)
            if item.is_symlink():
                value += (os.readlink(item),)
            elif item.is_file():
                value += (item.read_bytes(),)
            result[str(item.relative_to(path))] = value
        return result

    def managed(self):
        return {n: e for n, e in fs.inventory(self.policy, self.boundaries).items()
                if e["class"] == "managed"}

    def signed_candidate(self, **changes):
        """Capture, build an artifact and return a signed, pinned production request."""
        self.capture()
        archive, checksum, digest, files = self.build_artifact(
            self.candidate_contents(**changes))
        approval = self.artifact_approval(digest, files)
        return (approval, self.sign(approval), archive, checksum,
                self.candidate(digest), digest, files)

    # ── explicit activation only ──────────────────────────────────────


class ProductionPublisherTests(ProductionPublisherFixture):
    """The reviewed production suite, run from the shared synthetic fixture."""

    def test_production_is_unreachable_without_the_explicit_flag(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum = request[:4]
        arguments = ["publish", "--checkpoint", self.checkpoint_id,
                     "--manifest-sha256", "0" * 64, "--approval", str(approval),
                     "--signature", str(signature), "--approval-key", str(self.key),
                     "--archive", str(archive), "--checksum", str(checksum)]
        before = self.snapshot(self.root)
        self.assertEqual(publisher.main(arguments), 1)
        self.assertEqual(before, self.snapshot(self.root))
        self.assertEqual(publisher.main([]), 1)
        # A populated environment alone must not open the door either.
        with mock.patch.dict(os.environ, {"DOMBI_PUBLISHER_PRODUCTION": "1",
                                          "DOMBI_PUBLISHER_EXECUTE": "1"}):
            self.assertEqual(publisher.main([]), 1)
            self.assertEqual(publisher.main(arguments), 1)
        self.assertEqual(before, self.snapshot(self.root))
        self.assertFalse(any(self.directory.glob("publication-*")))

    def test_production_mode_without_arguments_aborts_and_never_uses_fixture_paths(self):
        result = subprocess.run(
            [sys.executable, "-B", str(SOURCE), "publish", "--production"],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr.strip(), publisher.PRODUCTION_ABORT)

    def test_cli_exposes_no_host_or_identity_override(self):
        help_text = subprocess.run([sys.executable, "-B", str(SOURCE), "--help"],
                                   capture_output=True, text=True, check=True).stdout
        self.assertIn("--production", help_text)
        for flag in ("--root", "--account", "--private", "--execute", "--confirm",
                     "--force", "--host", "--database"):
            self.assertNotIn(flag, help_text)

    # ── fail-closed prerequisites ─────────────────────────────────────
    def test_refuses_without_a_signature_key(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        before = self.snapshot(self.root)
        with self.assertRaises(fs.CheckpointError):
            self.publish(approval, signature, archive, checksum, candidate,
                         key=self.keys / "absent.key")
        self.assertEqual(before, self.snapshot(self.root))
        self.assertFalse(any(self.directory.glob("publication-*")))

    def test_refuses_a_loosely_permissioned_key(self):
        key = self.provision_key("loose.key")
        key.chmod(0o644)
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "private_file"):
            self.publish(approval, signature, archive, checksum, candidate, key=key)
        self.assertEqual(before, self.snapshot(self.root))

    def test_refuses_a_key_inside_the_private_or_application_state(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        for location in (self.private / "inside.key", self.root / "inside.key"):
            with self.subTest(location=str(location)):
                key = Path(location)
                key.write_bytes(os.urandom(48))
                key.chmod(0o600)
                before = self.snapshot(self.root)
                with self.assertRaises(fs.CheckpointError):
                    self.publish(approval, signature, archive, checksum, candidate, key=key)
                self.assertEqual(before, self.snapshot(self.root))
                key.unlink()

    def test_refuses_a_bad_signature(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        self.provision_key("other.key")
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "approval_signature_mismatch"):
            self.publish(approval, signature, archive, checksum, candidate,
                         key=self.keys / "other.key")
        self.assertEqual(before, self.snapshot(self.root))
        self.assertFalse(any(self.directory.glob("publication-*")))

    def test_refuses_an_approval_tampered_after_signing(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate, digest = request[:6]
        tampered = self.amended(approval, artifact_application_sha="b" * 40)
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "approval_signature_mismatch"):
            self.publish(tampered, signature, archive, checksum, candidate)
        self.assertEqual(before, self.snapshot(self.root))
        self.assertFalse(any(self.directory.glob("publication-*")))

    def test_refuses_a_malformed_signature_receipt(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        signature.write_bytes(b"not-a-signature\n")
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "approval_signature"):
            self.publish(approval, signature, archive, checksum, candidate)
        self.assertEqual(before, self.snapshot(self.root))

    def test_refuses_a_stale_approval(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact(
            self.candidate_contents(**{"app/service.php": b"synthetic candidate\n"}))
        approval = self.artifact_approval(
            digest, files, expires_utc=(fs.now() - dt.timedelta(seconds=1)).isoformat())
        before = self.snapshot(self.root)
        with self.assertRaises(fs.CheckpointError):
            self.publish(approval, self.sign(approval), archive, checksum,
                         self.candidate(digest))
        self.assertEqual(before, self.snapshot(self.root))
        self.assertFalse(any(self.directory.glob("publication-*")))

    def test_refuses_a_future_dated_approval(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact(
            self.candidate_contents(**{"app/service.php": b"synthetic candidate\n"}))
        approval = self.artifact_approval(
            digest, files, issued_utc=(fs.now() + dt.timedelta(minutes=5)).isoformat())
        before = self.snapshot(self.root)
        with self.assertRaises(fs.CheckpointError):
            self.publish(approval, self.sign(approval), archive, checksum,
                         self.candidate(digest))
        self.assertEqual(before, self.snapshot(self.root))

    def test_refuses_a_missing_publisher_lock(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        self.policy.lock.unlink()
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "publisher_lock_missing"):
            self.publish(approval, signature, archive, checksum, candidate)
        self.assertFalse(self.policy.lock.exists())
        self.assertEqual(before, self.snapshot(self.root))
        self.assertFalse(any(self.directory.glob("publication-*")))

    def test_refuses_a_busy_shared_lock(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        before = self.snapshot(self.root)
        with fs.publisher_lock(self.policy):
            with self.assertRaises(BlockingIOError):
                self.publish(approval, signature, archive, checksum, candidate)
        self.assertEqual(before, self.snapshot(self.root))
        self.assertFalse(any(self.directory.glob("publication-*")))

    def test_refuses_an_artifact_digest_mismatch(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact(
            self.candidate_contents(**{"app/service.php": b"synthetic candidate\n"}))
        approval = self.artifact_approval(digest, files, artifact_sha256="0" * 64)
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "approval_candidate_archive"):
            self.publish(approval, self.sign(approval), archive, checksum,
                         self.candidate(digest))
        self.assertEqual(before, self.snapshot(self.root))
        self.assertFalse(any(self.directory.glob("publication-*")))

    def test_refuses_a_receipt_that_disagrees_with_the_archive(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact(
            self.candidate_contents(**{"app/service.php": b"synthetic candidate\n"}))
        _, _, other_digest, _ = self.build_artifact(
            self.candidate_contents(**{"app/other.php": b"synthetic other\n"}),
            label="other")
        mismatched = self.private / "mismatched.sha256"
        mismatched.write_bytes((other_digest + "  release.tar.gz\n").encode())
        mismatched.chmod(0o600)
        approval = self.artifact_approval(digest, files)
        before = self.snapshot(self.root)
        with self.assertRaises(fs.CheckpointError):
            self.publish(approval, self.sign(approval), archive, mismatched,
                         self.candidate(digest))
        self.assertEqual(before, self.snapshot(self.root))

    def test_refuses_a_manifest_pin_mismatch(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        self.manifest_sha = "0" * 64
        before = self.snapshot(self.root)
        with self.assertRaises(fs.CheckpointError):
            self.publish(approval, signature, archive, checksum, candidate)
        self.assertEqual(before, self.snapshot(self.root))

    def test_refuses_a_stale_checkpoint_baseline(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        before = self.snapshot(self.root)
        later = fs.now() + dt.timedelta(minutes=16)
        with mock.patch.object(fs, "now", lambda: later):
            with self.assertRaisesRegex(fs.CheckpointError, "production_checkpoint_stale"):
                self.publish(approval, signature, archive, checksum, candidate)
        self.assertEqual(before, self.snapshot(self.root))
        self.assertFalse(any(self.directory.glob("publication-*")))

    def test_refuses_an_unfinished_prior_recovery(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact(
            self.candidate_contents(**{"app/service.php": b"synthetic candidate\n"}))
        approval = self.artifact_approval(digest, files)
        signature = self.sign(approval)
        operation = self.directory / ("recovery-" + "d" * 64)
        operation.mkdir(mode=0o700)
        (operation / "authorization.json").write_bytes(b"{}")
        (operation / "journal.jsonl").write_bytes(b"{}\n")
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "incomplete_prior_recovery"):
            self.publish(approval, signature, archive, checksum, self.candidate(digest))
        self.assertEqual(before, self.snapshot(self.root))
        self.assertFalse(any(self.directory.glob("publication-*")))

    def test_refuses_an_approval_without_the_key_identity(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        unsigned = self.amended(approval, production_key_sha256=None)
        resigned = self.sign(unsigned)
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "approval_key_identity"):
            self.publish(unsigned, resigned, archive, checksum, candidate)
        self.assertEqual(before, self.snapshot(self.root))
        self.assertFalse(any(self.directory.glob("publication-*")))

    def test_refuses_a_candidate_pin_that_disagrees_with_the_approval(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, digest = (request[0], request[1],
                                                          request[2], request[3], request[5])
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "approval_candidate"):
            self.publish(approval, signature, archive, checksum,
                         self.candidate(digest, application_sha="b" * 40))
        self.assertEqual(before, self.snapshot(self.root))
        self.assertFalse(any(self.directory.glob("publication-*")))

    def test_refuses_a_malformed_candidate_pin(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum = request[:4]
        before = self.snapshot(self.root)
        for candidate in ({"artifact_id": "x"}, {"artifact_id": "x", "application_sha": "nope",
                                                 "archive_sha256": "0" * 64}):
            with self.subTest(candidate=sorted(candidate)):
                with self.assertRaisesRegex(fs.CheckpointError, "production_candidate_pin"):
                    self.publish(approval, signature, archive, checksum, candidate)
        self.assertEqual(before, self.snapshot(self.root))

    def test_refuses_a_signature_file_outside_the_private_directory(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        outside = self.base / "outside.sig"
        outside.write_bytes(signature.read_bytes())
        outside.chmod(0o600)
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "approval_signature_boundary"):
            self.publish(approval, outside, archive, checksum, candidate)
        self.assertEqual(before, self.snapshot(self.root))

    def test_refuses_a_policy_that_does_not_describe_its_own_identity(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        before = self.snapshot(self.root)
        for policy in (fs.Policy(self.root, self.private, "not-the-owner"),
                       fs.Policy(self.root, self.root / "missing-private", self.policy.account)):
            with self.subTest(policy=policy):
                with self.assertRaises(fs.CheckpointError):
                    self.publish(approval, signature, archive, checksum, candidate,
                                 policy=policy)
        self.assertEqual(before, self.snapshot(self.root))

    # ── success and failure semantics ─────────────────────────────────
    def test_synthetic_production_publication_completes(self):
        request = self.signed_candidate(**{
            "app/service.php": b"synthetic candidate service\n",
            "app/new.php": b"synthetic added file\n",
            "app/cache.php": None,
        })
        approval, signature, archive, checksum, candidate, digest, files = request
        result = self.publish(approval, signature, archive, checksum, candidate)
        self.assertEqual(result["status"], publisher.SUCCESS)
        self.assertEqual(result["realm"], publisher.PRODUCTION_REALM)
        self.assertEqual(result["approval_key_sha256"], self.key_identity())
        self.assertEqual(result["additions"], ["app/new.php"])
        self.assertEqual(result["replacements"], ["app/service.php"])
        self.assertEqual(result["removals"], ["app/cache.php"])
        self.assertEqual((self.root / "app/new.php").read_bytes(), b"synthetic added file\n")
        self.assertFalse((self.root / "app/cache.php").exists())
        operation = self.directory / ("publication-" + fs.file_digest(approval))
        self.assertEqual(fs.load_json(operation / "outcome.json")["status"], publisher.SUCCESS)
        self.assertEqual(set(files), {n for n, e in self.managed().items()
                                      if e["type"] == "file"})
        self.assertTrue((self.root / ".env").exists())
        self.assertTrue((self.root / "public/storage").is_symlink())
        self.assertNotIn(self.key_identity(), (operation / "journal.jsonl").read_text())

    def test_production_approval_remains_single_use(self):
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        self.publish(approval, signature, archive, checksum, candidate)
        before = self.snapshot(self.root)
        with self.assertRaises(fs.CheckpointError):
            self.publish(approval, signature, archive, checksum, candidate)
        self.assertEqual(before, self.snapshot(self.root))
        self.assertEqual(len(list(self.directory.glob("publication-*"))), 1)

    def test_production_interruption_journals_and_keeps_held(self):
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
                raise KeyboardInterrupt("synthetic production interruption")
            return replace(*args, **kwargs)

        with mock.patch.object(fs.os, "replace", side_effect=interrupt):
            with self.assertRaises(KeyboardInterrupt):
                self.publish(approval, signature, archive, checksum, candidate)
        operation = self.directory / ("publication-" + fs.file_digest(approval))
        self.assertFalse((operation / "outcome.json").exists())
        self.assertIn(b"FAILED_OR_INTERRUPTED_KEEP_HELD", (operation / "journal.jsonl").read_bytes())

    def test_production_artifact_cannot_widen_scope(self):
        self.capture()
        contents = self.candidate_contents()
        contents["routes/web.php"] = b"synthetic out-of-scope route\n"
        archive, checksum, digest, files = self.build_artifact(contents)
        baselined = self.build_artifact(self.candidate_contents(), label="baseline")[3]
        approval = self.artifact_approval(digest, baselined)
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "artifact_path_outside_managed_scope"):
            self.publish(approval, self.sign(approval), archive, checksum,
                         self.candidate(digest))
        self.assertEqual(before, self.snapshot(self.root))
        self.assertFalse(any(self.directory.glob("publication-*")))

    def test_production_artifact_cannot_write_into_protected_state(self):
        self.capture()
        contents = self.candidate_contents()
        contents["config/synthetic-private.pem"] = b"synthetic protected write\n"
        archive, checksum, digest, files = self.build_artifact(contents)
        baselined = self.build_artifact(self.candidate_contents(), label="baseline")[3]
        approval = self.artifact_approval(digest, baselined)
        before = self.snapshot(self.root)
        with self.assertRaisesRegex(fs.CheckpointError, "artifact_path_protected"):
            self.publish(approval, self.sign(approval), archive, checksum,
                         self.candidate(digest))
        self.assertEqual(before, self.snapshot(self.root))
        self.assertFalse((self.root / "config/synthetic-private.pem").exists())

    def test_production_preserves_protected_state(self):
        self.capture()
        (self.root / ".env").write_bytes(b"SYNTHETIC_ROTATED=true\n")
        (self.root / "storage/app/public/new-upload").write_bytes(b"synthetic new upload\n")
        before = fs.stable_protected(fs.inventory(self.policy, self.boundaries))
        archive, checksum, digest, files = self.build_artifact(
            self.candidate_contents(**{"app/service.php": b"synthetic candidate\n"}))
        approval = self.artifact_approval(digest, files)
        self.publish(approval, self.sign(approval), archive, checksum,
                     self.candidate(digest))
        self.assertEqual(before,
                         fs.stable_protected(fs.inventory(self.policy, self.boundaries)))

    # ── fixture realm is unchanged ────────────────────────────────────
    def test_realm_dispatch_is_closed_and_cannot_be_injected(self):
        with self.assertRaisesRegex(fs.CheckpointError, "publisher_realm"):
            publisher.enforce_realm(self.policy, "neither")
        with self.assertRaisesRegex(fs.CheckpointError, "publisher_realm"):
            publisher.enforce_realm(self.policy, lambda _: None)
        with self.assertRaisesRegex(fs.CheckpointError, "publisher_realm"):
            publisher.enforce_realm(self.policy, True)
        with self.assertRaisesRegex(fs.CheckpointError, "publisher_realm"):
            publisher.artifact_publication(
                self.policy, self.checkpoint_id, self.manifest_sha,
                Path("/nonexistent"), Path("/nonexistent"), Path("/nonexistent"),
                realm="neither")
        publisher.enforce_realm(self.policy, publisher.FIXTURE_REALM)

    def test_mutation_helpers_default_to_the_fixture_realm(self):
        """The default realm of every shared helper is the fixture guard, not production."""
        calls = (
            (publisher.artifact_preflight, (fs.PRODUCTION, "app/service.php",
                                            {}, {}, {}, {})),
            (publisher.publish_artifact_file, (fs.PRODUCTION, "app/service.php",
                                               "0" * 64, Path("/nonexistent"),
                                               {}, Path("/nonexistent"), {})),
            (publisher.remove_artifact_file, (fs.PRODUCTION, "app/service.php",
                                              {}, Path("/nonexistent"), {})),
        )
        for helper, arguments in calls:
            with self.subTest(helper=helper.__name__):
                with self.assertRaisesRegex(fs.CheckpointError,
                                            "production_execution_disabled"):
                    helper(*arguments)

    def test_fixture_realm_still_refuses_the_pinned_production_identity(self):
        with self.assertRaisesRegex(fs.CheckpointError, "production_execution_disabled"):
            publisher.require_fixture_policy(fs.PRODUCTION)
        with self.assertRaisesRegex(fs.CheckpointError, "production_execution_disabled"):
            publisher.publish_artifact(
                fs.PRODUCTION, self.checkpoint_id, self.manifest_sha,
                Path("/nonexistent"), Path("/nonexistent"), Path("/nonexistent"))

    def test_fixture_realm_needs_no_key_or_signature(self):
        self.capture()
        archive, checksum, digest, files = self.build_artifact(
            self.candidate_contents(**{"app/service.php": b"synthetic fixture candidate\n"}))
        approval = self.approval(publisher.OPERATION, **{
            "artifact_application_sha": APP_SHA,
            "artifact_sha256": digest,
            "artifact_entries_sha256": fs.object_digest(files),
            "publication_plan_sha256": publisher.plan_digest(publisher.artifact_plan(
                fs.load_json(self.directory / "manifest.json"),
                fs.inventory(self.policy, self.boundaries), files)),
            "removals": publisher.artifact_plan(
                fs.load_json(self.directory / "manifest.json"),
                fs.inventory(self.policy, self.boundaries), files)["removals"],
        })
        result = publisher.publish_artifact(
            self.policy, self.checkpoint_id, self.manifest_sha, approval, archive, checksum)
        self.assertEqual(result["status"], publisher.SUCCESS)
        self.assertNotIn("realm", result)

    def test_fixture_realm_does_not_accept_a_production_only_approval(self):
        """A production approval carries extra fields; the fixture path must still work
        only when its own (unchanged) requirements hold, proving no field moved."""
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, _, archive, checksum = request[:4]
        result = publisher.publish_artifact(
            self.policy, self.checkpoint_id, self.manifest_sha, approval, archive, checksum)
        self.assertEqual(result["status"], publisher.SUCCESS)

    def test_production_adds_no_weakening_of_the_shared_lock_file(self):
        """The production path never creates or chmods the lock; it only requires it."""
        request = self.signed_candidate(**{"app/service.php": b"synthetic candidate\n"})
        approval, signature, archive, checksum, candidate = request[:5]
        self.policy.lock.unlink()
        before = self.snapshot(self.private / self.checkpoint_id)
        with self.assertRaises(fs.CheckpointError):
            self.publish(approval, signature, archive, checksum, candidate)
        self.assertFalse(self.policy.lock.exists())
        self.assertEqual(before, self.snapshot(self.private / self.checkpoint_id))


if __name__ == "__main__":
    unittest.main()
