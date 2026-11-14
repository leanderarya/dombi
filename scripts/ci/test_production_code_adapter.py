import ast
from contextlib import ExitStack
from datetime import datetime, timedelta, timezone
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

import production_code_adapter as adapter
import test_release


class ProductionCodePreflightTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.fixture = test_release.ReleaseTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.archive = self.fixture.archive
        self.checksum = self.fixture.output / "release.sha256"
        self.archive.chmod(0o600)
        self.checksum.chmod(0o600)
        self.evidence_dir = Path(self.temp.name) / "evidence"
        self.evidence_dir.mkdir(mode=0o700)
        self.bundle_path = self.evidence_dir / "gates.json"
        self.now = datetime.now(timezone.utc).replace(microsecond=0)

    def write_private(self, path, value):
        path = Path(path)
        path.write_text(json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n")
        path.chmod(0o600)

    def set_archive_bytes(self, data):
        self.archive.write_bytes(data)
        self.archive.chmod(0o600)
        self.fixture.checksum = hashlib.sha256(data).hexdigest()
        self.checksum.write_text(self.fixture.checksum + "  release.tar.gz\n")
        self.checksum.chmod(0o600)

    def rewrite_archive(self, change):
        self.fixture.rewrite(change)
        self.checksum.write_text(self.fixture.checksum + "  release.tar.gz\n")
        self.checksum.chmod(0o600)

    def preflight_with_fixture_pins(self, **limits):
        with ExitStack() as stack:
            stack.enter_context(patch.object(adapter, "APPLICATION_SHA", self.fixture.sha))
            stack.enter_context(patch.object(adapter, "ARCHIVE_SHA256", self.fixture.checksum))
            for name, value in limits.items():
                stack.enter_context(patch.object(adapter, name, value))
            return adapter.preflight(self.archive, self.checksum)

    def gzip_tar_bytes(self, raw_tar):
        compressed = io.BytesIO()
        with gzip.GzipFile(fileobj=compressed, mode="wb", mtime=0) as stream:
            stream.write(raw_tar)
        return compressed.getvalue()

    def insert_pax_bodies(self, headers):
        raw_tar = gzip.decompress(self.archive.read_bytes())
        with tarfile.open(fileobj=io.BytesIO(raw_tar), mode="r:") as archive:
            target_offset = archive.getmember("app/Example.php").offset
        extension_bytes = bytearray()
        for body, member_type, padding_prefix in headers:
            pax_header = tarfile.TarInfo("PaxHeaders/app/Example.php")
            pax_header.type = member_type
            pax_header.mode = 0o644
            pax_header.size = len(body)
            header_bytes = pax_header.tobuf(format=tarfile.USTAR_FORMAT)
            padding_size = (-len(body)) % tarfile.BLOCKSIZE
            self.assertLessEqual(len(padding_prefix), padding_size)
            padding = padding_prefix + b"\x00" * (padding_size - len(padding_prefix))
            extension_bytes.extend(header_bytes + body + padding)
        raw_tar = (
            raw_tar[:target_offset]
            + extension_bytes
            + raw_tar[target_offset:]
        )
        self.set_archive_bytes(self.gzip_tar_bytes(raw_tar))

    def insert_pax_body(
        self, body, member_type=tarfile.XHDTYPE, padding_prefix=b"",
    ):
        self.insert_pax_bodies([(body, member_type, padding_prefix)])

    @staticmethod
    def pax_record(key, value, separator=b"="):
        content = b" " + key + separator + value + b"\n"
        length = len(content) + 1
        while True:
            updated = len(str(length)) + len(content)
            if updated == length:
                return str(length).encode("ascii") + content
            length = updated

    def proof(self, gate, *, status="PASS", claims=None, observed=None, expires=None):
        observed = observed or self.now - timedelta(minutes=1)
        expires = expires or self.now + timedelta(minutes=10)
        value = {
            "schema": 1,
            "gate": gate,
            "status": status,
            "candidate": adapter.pinned_candidate_record(),
            "target_identity_sha256": "a" * 64,
            "observed_utc": observed.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "expires_utc": expires.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "independent_verifier": "fixture-reviewer",
            "claims": claims or {"reference": "synthetic fixture evidence"},
        }
        filename = gate + ".json"
        path = self.evidence_dir / filename
        self.write_private(path, value)
        return {"file": filename, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}

    def make_gate_bundle(self, proofs=None):
        refs = {}
        for gate in adapter.GATES:
            refs[gate] = self.proof(gate) if proofs is None else proofs[gate]
        self.write_private(self.bundle_path, {
            "schema": 1,
            "operator": "fixture-operator",
            "evidence": refs,
        })

    def test_release_pins_are_fixed_and_synthetic_artifact_is_rejected_read_only(self):
        self.assertEqual(adapter.pinned_candidate_record(), {
            "artifact_id": "14015610232",
            "source_run_id": "43377554794",
            "application_sha": "4ebe5e1da608b0c7404e2667cb99742747db4796",
            "archive_sha256": "5b5a54453badc86134e890cb4f5448a80dce1fc1b391eec03ec41284988225d5",
            "container_sha256": "48ff3ba53525c194efc5db859c8f6fc6a1a4a860e019c7a18c5b29838ed3c0dc",
        })
        before = self.archive.read_bytes()
        with self.assertRaisesRegex(adapter.AdapterError, "archive_checksum_receipt_mismatch"):
            adapter.verify_artifact(self.archive, self.checksum)
        self.assertEqual(self.archive.read_bytes(), before)
        self.assertEqual(self.checksum.read_text(),
                         self.fixture.checksum + "  release.tar.gz\n")

    def test_fixed_checksum_does_not_accept_different_tar_bytes(self):
        self.checksum.write_text(adapter.ARCHIVE_SHA256 + "  release.tar.gz\n")
        self.checksum.chmod(0o600)
        with self.assertRaisesRegex(adapter.AdapterError, "archive_digest_mismatch"):
            adapter.verify_artifact(self.archive, self.checksum)

    def test_valid_synthetic_preflight_reads_through_manifest_without_mutating_inputs(self):
        def file_state(path):
            info = path.stat()
            return (
                path.read_bytes(), info.st_mode, info.st_size, info.st_mtime_ns, info.st_ctime_ns,
            )

        archive_before = file_state(self.archive)
        checksum_before = file_state(self.checksum)
        entries_before = sorted(path.name for path in self.fixture.output.iterdir())
        with patch.object(adapter, "APPLICATION_SHA", self.fixture.sha), patch.object(
            adapter, "ARCHIVE_SHA256", self.fixture.checksum,
        ):
            result = adapter.preflight(self.archive, self.checksum)

        self.assertEqual(result["status"], "UNKNOWN")
        self.assertEqual(result["artifact"]["status"], "PASS")
        self.assertEqual(result["github_provenance"]["status"], "UNKNOWN")
        self.assertEqual(result["operational_gates"]["status"], "UNKNOWN")
        self.assertEqual(file_state(self.archive), archive_before)
        self.assertEqual(file_state(self.checksum), checksum_before)
        self.assertEqual(sorted(path.name for path in self.fixture.output.iterdir()), entries_before)
        for name in (
            "tarfile", "release", "os", "Path", "_os", "_Path", "argparse",
        ):
            self.assertFalse(hasattr(adapter, name), name)

    def test_tar_resource_limits_reject_before_accepting_archive(self):
        cases = (
            ("archive bytes", {"MAX_ARCHIVE_BYTES": 1}, "input_too_large"),
            ("member count", {"MAX_TAR_MEMBERS": 1}, "release_member_count_limit"),
            ("member name", {"MAX_MEMBER_NAME_BYTES": 1}, "release_member_name_limit"),
            ("member declared bytes", {"MAX_MEMBER_BYTES": 1}, "release_member_size_limit"),
            ("total declared bytes", {"MAX_TOTAL_DECLARED_BYTES": 1},
             "release_total_declared_limit"),
            ("actual payload bytes", {"MAX_ACTUAL_PAYLOAD_BYTES": 1},
             "release_actual_payload_limit"),
            ("actual tar bytes", {"MAX_ACTUAL_TAR_BYTES": 1}, "release_actual_tar_limit"),
            ("manifest bytes", {"MAX_MANIFEST_BYTES": 1}, "release_manifest_size_limit"),
        )
        for name, limits, reason in cases:
            with self.subTest(limit=name):
                with self.assertRaisesRegex(adapter.AdapterError, reason):
                    self.preflight_with_fixture_pins(**limits)

    def test_tar_extension_headers_are_bounded(self):
        original = self.archive.read_bytes()

        def add_pax_header(members):
            for index, (member, data) in enumerate(members):
                if member.name == "app/Example.php":
                    member.pax_headers = {"comment": "x" * 256}
                    members[index] = (member, data)
                    return members
            self.fail("fixture is missing app/Example.php")

        self.rewrite_archive(add_pax_header)
        result = self.preflight_with_fixture_pins()
        self.assertEqual(result["status"], "UNKNOWN")
        self.assertEqual(result["artifact"]["status"], "PASS")
        for limits, reason in (
            ({"MAX_TAR_EXTENSION_BYTES": 1}, "release_extension_size_limit"),
            ({"MAX_TAR_EXTENSION_HEADERS": 0}, "release_extension_count_limit"),
            ({"MAX_TOTAL_TAR_EXTENSION_BYTES": 1},
             "release_total_extension_size_limit"),
        ):
            with self.subTest(limits=limits):
                with self.assertRaisesRegex(adapter.AdapterError, reason):
                    self.preflight_with_fixture_pins(**limits)

        self.set_archive_bytes(original)

    def test_gnu_sparse_pax_metadata_is_rejected_before_tarfile_processing(self):
        def add_sparse_member(members):
            member = tarfile.TarInfo("app/sparse.php")
            member.mode = 0o644
            member.pax_headers = {
                "GNU.sparse.major": "1",
                "GNU.sparse.minor": "0",
            }
            return members + [(member, b"1\n0\n")]

        self.rewrite_archive(add_sparse_member)
        with self.assertRaisesRegex(adapter.AdapterError, "release_sparse_member_unsafe"):
            self.preflight_with_fixture_pins()

    def test_pax_record_syntax_is_strict_and_valid_multi_record_body_passes(self):
        original = self.archive.read_bytes()
        valid_records = (
            self.pax_record(b"comment", b"synthetic")
            + self.pax_record(b"comment2", b"also-valid")
        )
        self.insert_pax_body(valid_records)
        result = self.preflight_with_fixture_pins()
        self.assertEqual(result["status"], "UNKNOWN")
        self.assertEqual(result["artifact"]["status"], "PASS")

        malformed_bodies = (
            ("valid record followed by junk",
             self.pax_record(b"comment", b"valid") + b"junk"),
            ("truncated record", b"99 comment=value\n"),
            ("invalid length syntax", b"+12 comment=x\n"),
            ("zero record length", b"0 comment=x\n"),
            ("negative record length", b"-1 comment=x\n"),
            ("oversized record length", b"99999 comment=x\n"),
            ("invalid key/value separator",
             self.pax_record(b"comment", b"value", separator=b":")),
            ("invalid key", self.pax_record(b"bad key", b"value")),
            ("NUL in value", self.pax_record(b"comment", b"bad\x00value")),
            ("invalid UTF-8 value", self.pax_record(b"comment", b"\xff")),
            ("stdlib charset probe inside value",
             self.pax_record(b"comment", b"before\n5 hdrcharset=BINARY\nafter")),
            ("unsupported charset", self.pax_record(b"hdrcharset", b"UTF-16")),
        )
        for name, body in malformed_bodies:
            with self.subTest(body=name):
                self.set_archive_bytes(original)
                self.insert_pax_body(body)
                with self.assertRaisesRegex(
                    adapter.AdapterError, "release_pax_record_invalid",
                ):
                    self.preflight_with_fixture_pins()

        self.set_archive_bytes(original)
        binary_records = (
            self.pax_record(b"hdrcharset", b"BINARY")
            + self.pax_record(b"path", b"app/Example.php")
        )
        self.insert_pax_body(binary_records)
        result = self.preflight_with_fixture_pins()
        self.assertEqual(result["status"], "UNKNOWN")
        self.assertEqual(result["artifact"]["status"], "PASS")

        self.set_archive_bytes(original)
        self.insert_pax_body(valid_records, member_type=tarfile.XGLTYPE)
        result = self.preflight_with_fixture_pins()
        self.assertEqual(result["status"], "UNKNOWN")
        self.assertEqual(result["artifact"]["status"], "PASS")

        self.set_archive_bytes(original)
        malformed_global = self.pax_record(b"comment", b"valid") + b"junk"
        self.insert_pax_body(malformed_global, member_type=tarfile.XGLTYPE)
        with self.assertRaisesRegex(adapter.AdapterError, "release_pax_record_invalid"):
            self.preflight_with_fixture_pins()

    def test_pax_padding_is_zero_and_global_charset_cannot_be_injected(self):
        original = self.archive.read_bytes()
        body = self.pax_record(b"comment", b"valid")
        self.insert_pax_body(body, padding_prefix=b"5 hdrcharset=BINARY\n")
        with self.assertRaisesRegex(adapter.AdapterError, "release_pax_padding_invalid"):
            self.preflight_with_fixture_pins()

        self.set_archive_bytes(original)
        global_body = self.pax_record(b"comment", b"valid")
        local_body = self.pax_record(b"uname", b"\xff")
        self.insert_pax_bodies([
            (global_body, tarfile.XGLTYPE, b"5 hdrcharset=BINARY\n"),
            (local_body, tarfile.XHDTYPE, b""),
        ])
        with self.assertRaisesRegex(adapter.AdapterError, "release_pax_padding_invalid"):
            self.preflight_with_fixture_pins()

    def test_solaris_pax_headers_use_strict_validation(self):
        original = self.archive.read_bytes()
        self.insert_pax_body(
            self.pax_record(b"comment", b"valid"),
            member_type=tarfile.SOLARIS_XHDTYPE,
        )
        result = self.preflight_with_fixture_pins()
        self.assertEqual(result["status"], "UNKNOWN")
        self.assertEqual(result["artifact"]["status"], "PASS")

        self.set_archive_bytes(original)
        self.insert_pax_body(
            self.pax_record(b"comment", b"valid") + b"junk",
            member_type=tarfile.SOLARIS_XHDTYPE,
        )
        with self.assertRaisesRegex(adapter.AdapterError, "release_pax_record_invalid"):
            self.preflight_with_fixture_pins()

    def test_unsafe_paths_links_types_and_duplicates_fail_closed(self):
        original = self.archive.read_bytes()

        def append_member(entries, name, kind=tarfile.REGTYPE, linkname=""):
            member = tarfile.TarInfo(name)
            member.type = kind
            member.mode = 0o644
            member.linkname = linkname
            return entries + [(member, b"")]

        cases = (
            ("traversal", lambda entries: append_member(entries, "../escape"),
             "release_unsafe_member"),
            ("absolute path", lambda entries: append_member(entries, "/outside"),
             "release_unsafe_member"),
            ("unexpected path", lambda entries: append_member(entries, "storage/local"),
             "release_unsafe_member"),
            ("symbolic link", lambda entries: append_member(
                entries, "app/link", tarfile.SYMTYPE, "artisan",
            ), "release_unsafe_member"),
            ("hard link", lambda entries: append_member(
                entries, "app/link", tarfile.LNKTYPE, "artisan",
            ), "release_unsafe_member"),
            ("directory", lambda entries: append_member(
                entries, "app/directory", tarfile.DIRTYPE,
            ), "release_unsafe_member"),
            ("duplicate", lambda entries: entries + [entries[0]],
             "release_duplicate_member"),
        )
        for name, change, reason in cases:
            with self.subTest(entry=name):
                self.set_archive_bytes(original)
                self.rewrite_archive(change)
                with self.assertRaisesRegex(adapter.AdapterError, reason):
                    self.preflight_with_fixture_pins()

    def test_malformed_manifest_and_truncated_tar_streams_fail_closed(self):
        original = self.archive.read_bytes()

        self.rewrite_archive(lambda entries: [
            (member, b"not-json" if member.name == "release.json" else data)
            for member, data in entries
        ])
        with self.assertRaisesRegex(adapter.AdapterError, "invalid_json"):
            self.preflight_with_fixture_pins()

        self.set_archive_bytes(original)
        raw_tar = gzip.decompress(original)
        with tarfile.open(fileobj=io.BytesIO(raw_tar), mode="r:") as tar:
            member = tar.getmember("artisan")
            cut_at = member.offset_data + max(1, member.size // 2)
        self.set_archive_bytes(self.gzip_tar_bytes(raw_tar[:cut_at]))
        with self.assertRaisesRegex(adapter.AdapterError, "release_member_size_mismatch"):
            self.preflight_with_fixture_pins()

        self.set_archive_bytes(original[:-4])
        with self.assertRaises(adapter.AdapterError):
            self.preflight_with_fixture_pins()

    def test_missing_tar_terminator_and_nonzero_trailing_data_fail_closed(self):
        original = self.archive.read_bytes()
        raw_tar = gzip.decompress(original)
        with tarfile.open(fileobj=io.BytesIO(raw_tar), mode="r:") as tar:
            final_member = tar.getmembers()[-1]
            terminator_offset = final_member.offset_data + (
                (final_member.size + tarfile.BLOCKSIZE - 1) // tarfile.BLOCKSIZE
            ) * tarfile.BLOCKSIZE

        self.set_archive_bytes(self.gzip_tar_bytes(raw_tar[:terminator_offset + tarfile.BLOCKSIZE]))
        with self.assertRaisesRegex(adapter.AdapterError, "release_tar_terminator_invalid"):
            self.preflight_with_fixture_pins()

        invalid_tail = (
            raw_tar[:terminator_offset]
            + (tarfile.NUL * (tarfile.BLOCKSIZE * 2))
            + b"x"
            + tarfile.NUL * (tarfile.BLOCKSIZE - 1)
        )
        self.set_archive_bytes(self.gzip_tar_bytes(invalid_tail))
        with self.assertRaisesRegex(adapter.AdapterError, "release_nonzero_trailing_data"):
            self.preflight_with_fixture_pins()

    def test_missing_or_matching_local_github_receipt_remains_unknown(self):
        self.assertEqual(adapter.inspect_github_evidence()["status"], "UNKNOWN")
        receipt_path = Path(self.temp.name) / "github-evidence.json"
        self.write_private(receipt_path, {
            "schema": 1,
            "artifact_id": adapter.ARTIFACT_ID,
            "source_run_id": adapter.SOURCE_RUN_ID,
            "application_sha": adapter.APPLICATION_SHA,
            "archive_sha256": adapter.ARCHIVE_SHA256,
            "container_sha256": adapter.CONTAINER_SHA256,
            "branch": "develop",
            "run_event": "push",
            "run_status": "completed",
            "run_conclusion": "success",
        })
        result = adapter.inspect_github_evidence(receipt_path)
        self.assertEqual(result["status"], "UNKNOWN")
        self.assertIn("cannot authenticate", result["reason"])
        forged = adapter.private_json(receipt_path)
        forged["artifact_id"] = "999"
        self.write_private(receipt_path, forged)
        with self.assertRaisesRegex(adapter.AdapterError, "github_evidence_identity_mismatch"):
            adapter.inspect_github_evidence(receipt_path)

    def test_missing_gate_evidence_is_unknown(self):
        result = adapter.inspect_gate_evidence()
        self.assertEqual(result["status"], "UNKNOWN")
        self.assertFalse(result.get("authenticated", False))
        self.assertIsNone(adapter.private_directory(self.evidence_dir))

    def test_hash_consistent_pass_receipts_remain_unknown_and_authorization_claim_fails(self):
        self.make_gate_bundle()
        result = adapter.inspect_gate_evidence(self.bundle_path, self.evidence_dir)
        self.assertEqual(result["status"], "UNKNOWN")
        self.assertEqual(result["references_checked"], len(adapter.GATES))

        refs = adapter.private_json(self.bundle_path)["evidence"]
        gate = adapter.GATES[0]
        proof_path = self.evidence_dir / refs[gate]["file"]
        proof = adapter.private_json(proof_path)
        proof["claims"]["production_authorized"] = True
        self.write_private(proof_path, proof)
        refs[gate]["sha256"] = hashlib.sha256(proof_path.read_bytes()).hexdigest()
        self.write_private(self.bundle_path, {
            "schema": 1,
            "operator": "fixture-operator",
            "evidence": refs,
        })
        with self.assertRaisesRegex(adapter.AdapterError, "unauthenticated_production_authorization"):
            adapter.inspect_gate_evidence(self.bundle_path, self.evidence_dir)

        for claim in (
            {"production_authorized": "yes"},
            {"decision": "Production is authorized"},
            {"decision": "Approved for deployment"},
            {"authorization": {"production": True}},
            {"status": "AUTHORIZED"},
        ):
            with self.subTest(claim=claim):
                with self.assertRaisesRegex(
                    adapter.AdapterError, "unauthenticated_production_authorization",
                ):
                    adapter.reject_authorization_claims(claim)

    def test_gate_evidence_hash_tampering_and_staleness_fail_closed(self):
        self.make_gate_bundle()
        refs = adapter.private_json(self.bundle_path)["evidence"]
        proof_path = self.evidence_dir / refs[adapter.GATES[0]]["file"]
        proof = adapter.private_json(proof_path)
        proof["claims"]["reference"] = "changed after pin"
        self.write_private(proof_path, proof)
        with self.assertRaisesRegex(adapter.AdapterError, "gate_evidence_hash_mismatch"):
            adapter.inspect_gate_evidence(self.bundle_path, self.evidence_dir)

        stale_refs = {}
        for gate in adapter.GATES:
            stale_refs[gate] = self.proof(
                gate,
                observed=self.now - timedelta(minutes=16),
            )
        self.make_gate_bundle(stale_refs)
        with self.assertRaisesRegex(adapter.AdapterError, "gate_evidence_stale"):
            adapter.inspect_gate_evidence(self.bundle_path, self.evidence_dir)

    def test_no_publication_api_or_mutating_filesystem_calls_are_reachable(self):
        public_names = {name.lower() for name in vars(adapter) if not name.startswith("_")}
        forbidden_public_names = {
            "release", "pack", "extract", "extractall", "subprocess", "ssh",
            "tarfile", "os", "path", "argparse",
        }
        self.assertFalse(forbidden_public_names & public_names)
        for name in (
            "release", "tarfile", "os", "Path", "_os", "_Path", "_stat", "_io", "argparse",
        ):
            self.assertFalse(hasattr(adapter, name), name)

        for name in (
            "publish_fixture", "append_tree", "cleanup_owned_payload", "safe_destination",
            "exclusive_lock", "append_journal", "transport_material",
        ):
            self.assertFalse(hasattr(adapter, name), name)
        for name in ("pack", "extract", "extractall", "subprocess", "ssh", "publish"):
            self.assertFalse(hasattr(adapter, name), name)
        self.assertFalse(adapter.PRODUCTION_EXECUTION_ENABLED)
        with self.assertRaisesRegex(adapter.AdapterError, "production_execution_disabled"):
            adapter.run_production()

        tree = ast.parse(Path(adapter.__file__).read_text())
        top_level_imports = {
            alias.name
            for node in tree.body
            if isinstance(node, ast.Import)
            for alias in node.names
        }
        self.assertFalse({"release", "subprocess", "paramiko", "fabric"} & top_level_imports)

        mutators = {
            "replace", "rename", "unlink", "remove", "mkdir", "rmdir", "chmod",
            "write_text", "write_bytes", "rmtree", "flock",
        }
        calls = [
            node.func for node in ast.walk(tree)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
        ]
        filesystem_mutators = {
            node.attr for node in calls
            if isinstance(node.value, ast.Name)
            and node.value.id in {"os_module", "shutil", "fcntl", "Path"}
            and node.attr in mutators
        }
        self.assertFalse(filesystem_mutators, sorted(filesystem_mutators))
        forbidden_calls = {
            node.attr for node in calls
            if node.attr in {"pack", "extract", "extractall", "Popen", "run", "system", "connect"}
        }
        self.assertFalse(forbidden_calls, sorted(forbidden_calls))
        source = Path(adapter.__file__).read_text()
        for forbidden in ("subprocess", "os.system(", "O_WRONLY", "O_RDWR", "O_CREAT",
                          "php artisan", "deploy-production"):
            self.assertNotIn(forbidden, source)

    def test_preflight_cli_has_no_deploy_command_and_does_not_write(self):
        before = self.archive.read_bytes()
        with patch("sys.stdout", new=io.StringIO()):
            result = adapter.main([
                "preflight", "--archive", str(self.archive), "--checksum", str(self.checksum),
            ])
        self.assertEqual(result, 1)
        self.assertEqual(self.archive.read_bytes(), before)
        with patch("sys.stderr", new=io.StringIO()):
            with self.assertRaises(SystemExit):
                adapter.main(["deploy"])


if __name__ == "__main__":
    unittest.main()
