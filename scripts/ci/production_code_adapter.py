#!/usr/bin/env python3
"""Read-only release preflight. Production execution and publication do not exist."""

from datetime import datetime, timedelta, timezone
import hashlib
import json
import re


PRODUCTION_EXECUTION_ENABLED = False
MAX_INPUT_BYTES = 64 * 1024 * 1024
MAX_ARCHIVE_BYTES = 512 * 1024 * 1024
MAX_TAR_MEMBERS = 100_000
MAX_MEMBER_NAME_BYTES = 1_024
MAX_MEMBER_BYTES = 256 * 1024 * 1024
MAX_TOTAL_DECLARED_BYTES = 2 * 1024 * 1024 * 1024
MAX_ACTUAL_PAYLOAD_BYTES = 2 * 1024 * 1024 * 1024
MAX_ACTUAL_TAR_BYTES = MAX_TOTAL_DECLARED_BYTES + 256 * 1024 * 1024
MAX_MANIFEST_BYTES = 16 * 1024 * 1024
MAX_TAR_EXTENSION_BYTES = 64 * 1024
MAX_TAR_EXTENSION_HEADERS = 100_000
MAX_TOTAL_TAR_EXTENSION_BYTES = 16 * 1024 * 1024
HASH_CHUNK_BYTES = 64 * 1024
ARTIFACT_ID = "14015610232"
SOURCE_RUN_ID = "43377554794"
APPLICATION_SHA = "4ebe5e1da608b0c7404e2667cb99742747db4796"
ARCHIVE_SHA256 = "5b5a54453badc86134e890cb4f5448a80dce1fc1b391eec03ec41284988225d5"
CONTAINER_SHA256 = "48ff3ba53525c194efc5db859c8f6fc6a1a4a860e019c7a18c5b29838ed3c0dc"
GATES = (
    "fresh_checkpoint_integrity",
    "exclusive_publication_lock",
    "writer_drain",
    "doku_callback_containment",
    "runtime_database_schema",
    "worker_adoption_recovery",
)
HEX64 = re.compile(r"[a-f0-9]{64}\Z")
AUTHORIZED_STATUSES = {
    "AUTHORIZED", "APPROVED", "PRODUCTION_AUTHORIZED", "APPROVED_FOR_PRODUCTION",
}
AUTHORIZATION_CLAIM_TEXT = re.compile(
    r"\b(?:production|prod|deployment|deploy)\b.{0,48}\b(?:authori[sz]\w*|approv\w*)\b"
    r"|\b(?:authori[sz]\w*|approv\w*)\b.{0,48}\b(?:production|prod|deployment|deploy)\b",
    re.IGNORECASE,
)


class AdapterError(ValueError):
    pass


def require(condition, reason):
    if not condition:
        raise AdapterError(reason)


def object_pairs(items):
    result = {}
    for key, value in items:
        require(key not in result, "duplicate_json_key")
        result[key] = value
    return result


def parse_json(raw):
    try:
        return json.loads(
            raw.decode("utf-8"),
            object_pairs_hook=object_pairs,
            parse_constant=lambda _: require(False, "json_constant"),
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise AdapterError("invalid_json") from error


def private_bytes(path, limit=MAX_INPUT_BYTES):
    import os as os_module
    import stat as stat_module
    from pathlib import Path

    path = Path(path)
    try:
        before = path.lstat()
    except OSError as error:
        raise AdapterError("input_missing_or_unreadable") from error
    require(stat_module.S_ISREG(before.st_mode) and before.st_nlink == 1, "unsafe_input_file")
    require(before.st_uid == os_module.getuid() and stat_module.S_IMODE(before.st_mode) == 0o600,
            "input_not_private")
    require(before.st_size <= limit, "input_too_large")
    flags = os_module.O_RDONLY | getattr(os_module, "O_NOFOLLOW", 0) | getattr(os_module, "O_CLOEXEC", 0)
    try:
        fd = os_module.open(path, flags)
    except OSError as error:
        raise AdapterError("input_open_failed") from error
    try:
        opened = os_module.fstat(fd)
        require(stat_module.S_ISREG(opened.st_mode) and opened.st_nlink == 1, "unsafe_input_file")
        require((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns)
                == (opened.st_dev, opened.st_ino, opened.st_size, opened.st_mtime_ns, opened.st_ctime_ns),
                "input_identity_changed")
        with os_module.fdopen(fd, "rb", closefd=False) as stream:
            raw = stream.read(limit + 1)
        after = os_module.fstat(fd)
        require(len(raw) == before.st_size and len(raw) <= limit, "input_size_changed")
        require((opened.st_dev, opened.st_ino, opened.st_size, opened.st_mtime_ns, opened.st_ctime_ns)
                == (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns),
                "input_changed")
        return raw, opened
    finally:
        os_module.close(fd)


def private_json(path):
    raw, _ = private_bytes(path)
    value = parse_json(raw)
    require(isinstance(value, dict), "json_object_required")
    return value


def pinned_candidate_record():
    return {
        "artifact_id": ARTIFACT_ID,
        "source_run_id": SOURCE_RUN_ID,
        "application_sha": APPLICATION_SHA,
        "archive_sha256": ARCHIVE_SHA256,
        "container_sha256": CONTAINER_SHA256,
    }


def _allowed_release_member(name):
    from pathlib import PurePosixPath

    path = PurePosixPath(name)
    if path.is_absolute() or str(path) != name or ".." in path.parts:
        return False
    if any(part.startswith(".env") or part == ".git" for part in path.parts):
        return False
    return (
        name in ("artisan", "composer.json", "composer.lock", "bootstrap/app.php",
                 "bootstrap/providers.php")
        or name.startswith(("app/", "config/", "routes/", "resources/views/",
                            "database/migrations/", "vendor/", "public/"))
    ) and not (
        name.startswith(("vendor/bin/", "public/storage/"))
        or name in ("public/storage", "public/hot", "public/build.zip")
    )


def _verify_release_bytes(data):
    """Read and validate the fixed schema-1 release archive without extracting it."""
    import gzip
    import io
    import tarfile
    import zlib

    class BoundedReader:
        def __init__(self, source):
            self.source = source
            self.bytes_read = 0

        def read(self, size=-1):
            require(isinstance(size, int) and 0 <= size <= HASH_CHUNK_BYTES,
                    "release_stream_read_limit")
            remaining = MAX_ACTUAL_TAR_BYTES - self.bytes_read
            if size > remaining:
                size = remaining + 1
            chunk = self.source.read(size)
            self.bytes_read += len(chunk)
            require(self.bytes_read <= MAX_ACTUAL_TAR_BYTES, "release_actual_tar_limit")
            return chunk

    extension_headers = 0
    extension_bytes = 0

    class ReplayReader:
        def __init__(self, prefix, source):
            self.prefix = prefix
            self.source = source
            self.position = 0
            self.start = source.tell() - len(prefix)

        def read(self, size=-1):
            if size < 0:
                raise AdapterError("release_stream_read_limit")
            available = len(self.prefix) - self.position
            take = min(size, available)
            prefix = self.prefix[self.position:self.position + take]
            self.position += take
            if take == size:
                return prefix
            return prefix + self.source.read(size - take)

        def tell(self):
            if self.position < len(self.prefix):
                return self.start + self.position
            return self.source.tell()

        def seek(self, position):
            current = self.tell()
            require(position >= current, "release_stream_seek_backwards")
            while current < position:
                chunk = self.read(min(HASH_CHUNK_BYTES, position - current))
                require(chunk, "release_stream_truncated")
                current += len(chunk)
            return current

    def validate_pax_records(extension, declared_size, inherited_headers):
        body = extension[:declared_size]
        padding = extension[declared_size:]
        require(len(body) == declared_size and not any(padding),
                "release_pax_padding_invalid")

        position = 0
        records = []
        while position < len(body):
            separator = body.find(b" ", position)
            require(separator > position, "release_pax_record_invalid")
            digits = body[position:separator]
            require(all(48 <= digit <= 57 for digit in digits),
                    "release_pax_record_invalid")

            remaining = len(body) - position
            record_length = 0
            for digit in digits:
                record_length = record_length * 10 + digit - 48
                require(record_length <= remaining, "release_pax_record_invalid")

            minimum_length = separator - position + 4
            require(record_length >= minimum_length,
                    "release_pax_record_invalid")
            end = position + record_length
            require(body[end - 1] == 0x0A, "release_pax_record_invalid")
            equals = body.find(b"=", separator + 1, end - 1)
            require(equals > separator + 1, "release_pax_record_invalid")
            key = body[separator + 1:equals]
            require(re.fullmatch(rb"[A-Za-z0-9][A-Za-z0-9._-]*", key) is not None,
                    "release_pax_record_invalid")
            value = body[equals + 1:end - 1]
            require(b"\x00" not in value, "release_pax_record_invalid")
            records.append((position, key, value, end))
            position = end

        require(position == len(body), "release_pax_record_invalid")
        charset = inherited_headers.get("hdrcharset")
        local_charset_seen = False
        for _, key, value, _ in records:
            if key == b"hdrcharset":
                require(
                    value in (b"BINARY", b"ISO-IR 10646 2000 UTF-8"),
                    "release_pax_record_invalid",
                )
                if not local_charset_seen:
                    charset = value.decode("ascii")
                    local_charset_seen = True

        stdlib_charset = re.search(rb"\d+ hdrcharset=([^\n]+)\n", extension)
        charset_records = [record for record in records if record[1] == b"hdrcharset"]
        if charset_records:
            start, _, value, end = charset_records[0]
            require(
                stdlib_charset is not None
                and stdlib_charset.start() == start
                and stdlib_charset.end() == end
                and stdlib_charset.group(1) == value,
                "release_pax_record_invalid",
            )
        else:
            require(stdlib_charset is None, "release_pax_record_invalid")

        require(
            charset in (None, "BINARY", "ISO-IR 10646 2000 UTF-8"),
            "release_pax_record_invalid",
        )
        binary_name_fields = {b"path", b"linkpath", b"uname", b"gname"}
        for _, key, value, _ in records:
            if charset == "BINARY" and key in binary_name_fields:
                continue
            try:
                value.decode("utf-8")
            except UnicodeDecodeError as error:
                raise AdapterError("release_pax_record_invalid") from error

    class BoundedTarInfo(tarfile.TarInfo):
        def _check_extension(self):
            nonlocal extension_headers, extension_bytes
            extension_headers += 1
            require(extension_headers <= MAX_TAR_EXTENSION_HEADERS,
                    "release_extension_count_limit")
            require(0 < self.size <= MAX_TAR_EXTENSION_BYTES,
                    "release_extension_size_limit")
            extension_bytes += self.size
            require(extension_bytes <= MAX_TOTAL_TAR_EXTENSION_BYTES,
                    "release_total_extension_size_limit")

        def _proc_pax(self, archive):
            if not getattr(self, "_adapter_extension_prechecked", False):
                self._check_extension()
            return super()._proc_pax(archive)

        def _proc_gnulong(self, archive):
            self._check_extension()
            return super()._proc_gnulong(archive)

        def _proc_sparse(self, archive):
            raise AdapterError("release_sparse_member_unsafe")

        @classmethod
        def fromtarfile(cls, archive):
            block = archive.fileobj.read(tarfile.BLOCKSIZE)
            if block == tarfile.NUL * tarfile.BLOCKSIZE:
                archive._adapter_end_blocks = getattr(archive, "_adapter_end_blocks", 0) + 1
            else:
                archive._adapter_end_blocks = 0
            member = cls.frombuf(block, archive.encoding, archive.errors)
            member.offset = archive.fileobj.tell() - tarfile.BLOCKSIZE
            if member.type in (tarfile.XHDTYPE, tarfile.XGLTYPE, tarfile.SOLARIS_XHDTYPE):
                member._check_extension()
                extension = archive.fileobj.read(member._block(member.size))
                require(len(extension) == member._block(member.size),
                        "release_extension_truncated")
                require(b"GNU.sparse." not in extension,
                        "release_sparse_member_unsafe")
                if member.type in (
                    tarfile.XHDTYPE, tarfile.XGLTYPE, tarfile.SOLARIS_XHDTYPE,
                ):
                    validate_pax_records(extension, member.size, archive.pax_headers)
                source = archive.fileobj
                archive.fileobj = ReplayReader(extension, source)
                member._adapter_extension_prechecked = True
                try:
                    return member._proc_member(archive)
                finally:
                    archive.fileobj = source
            return member._proc_member(archive)

    try:
        with gzip.GzipFile(fileobj=io.BytesIO(data), mode="rb") as compressed:
            reader = BoundedReader(compressed)
            with tarfile.open(
                fileobj=reader,
                mode="r|",
                bufsize=HASH_CHUNK_BYTES,
                tarinfo=BoundedTarInfo,
            ) as archive:
                names = set()
                digests = {}
                manifest_bytes = None
                total_declared = 0
                total_actual = 0
                member_count = 0

                for member in archive:
                    member_count += 1
                    require(member_count <= MAX_TAR_MEMBERS, "release_member_count_limit")
                    require(not member.issym() and not member.islnk()
                            and member.isfile() and member.mode == 0o644,
                            "release_unsafe_member")
                    try:
                        name_size = len(member.name.encode("utf-8"))
                    except UnicodeEncodeError as error:
                        raise AdapterError("release_member_name_invalid") from error
                    require(name_size <= MAX_MEMBER_NAME_BYTES, "release_member_name_limit")
                    require(
                        _allowed_release_member(member.name) or member.name == "release.json",
                        "release_unsafe_member",
                    )
                    require(member.name not in names, "release_duplicate_member")
                    names.add(member.name)
                    require(isinstance(member.size, int) and member.size >= 0,
                            "release_member_size_invalid")
                    require(member.size <= MAX_MEMBER_BYTES, "release_member_size_limit")
                    total_declared += member.size
                    require(total_declared <= MAX_TOTAL_DECLARED_BYTES,
                            "release_total_declared_limit")
                    if member.name == "release.json":
                        require(member.size <= MAX_MANIFEST_BYTES, "release_manifest_size_limit")

                    source = archive.extractfile(member)
                    require(source is not None, "release_member_unreadable")
                    digest = hashlib.sha256()
                    member_actual = 0
                    manifest_content = bytearray() if member.name == "release.json" else None
                    while True:
                        try:
                            chunk = source.read(HASH_CHUNK_BYTES)
                        except tarfile.ReadError as error:
                            raise AdapterError("release_member_size_mismatch") from error
                        if not chunk:
                            break
                        member_actual += len(chunk)
                        total_actual += len(chunk)
                        require(member_actual <= MAX_MEMBER_BYTES,
                                "release_actual_member_limit")
                        require(total_actual <= MAX_ACTUAL_PAYLOAD_BYTES,
                                "release_actual_payload_limit")
                        if manifest_content is not None:
                            require(len(manifest_content) + len(chunk) <= MAX_MANIFEST_BYTES,
                                    "release_manifest_size_limit")
                            manifest_content.extend(chunk)
                        digest.update(chunk)
                    require(member_actual == member.size, "release_member_size_mismatch")
                    digests[member.name] = digest.hexdigest()
                    if manifest_content is not None:
                        manifest_bytes = bytes(manifest_content)

                require(getattr(archive, "_adapter_end_blocks", 0) == 1,
                        "release_tar_terminator_missing")
                second_end_block = archive.fileobj.read(tarfile.BLOCKSIZE)
                require(
                    len(second_end_block) == tarfile.BLOCKSIZE
                    and second_end_block == tarfile.NUL * tarfile.BLOCKSIZE,
                    "release_tar_terminator_invalid",
                )
                while True:
                    trailing = archive.fileobj.read(HASH_CHUNK_BYTES)
                    if not trailing:
                        break
                    require(not any(trailing), "release_nonzero_trailing_data")

                require(reader.bytes_read <= MAX_ACTUAL_TAR_BYTES,
                        "release_actual_tar_limit")
                require(manifest_bytes is not None, "release_manifest_missing")
                manifest = parse_json(manifest_bytes)
                require(isinstance(manifest, dict), "release_manifest_schema")
                require(manifest.get("schema") == 1 and manifest.get("sha") == APPLICATION_SHA,
                        "release_manifest_mismatch")
                files = manifest.get("files")
                require(isinstance(files, dict), "release_manifest_inventory")
                require(set(files) == names - {"release.json"}, "release_inventory_mismatch")
                for required in (
                    "vendor/autoload.php", "public/build/manifest.json", "artisan",
                    "composer.json", "composer.lock", "bootstrap/app.php", "bootstrap/providers.php",
                ):
                    require(required in files, "release_inventory_incomplete")
                for name, expected in files.items():
                    require(digests.get(name) == expected, "release_file_digest_mismatch")
                return manifest
    except AdapterError:
        raise
    except (tarfile.TarError, OSError, EOFError, KeyError, TypeError, ValueError, OverflowError,
            zlib.error) as error:
        raise AdapterError("invalid_release_archive") from error


def verify_artifact(archive_path, checksum_path):
    """Verify fixed tar bytes and the embedded schema-1 release manifest."""
    checksum_raw, _ = private_bytes(checksum_path)
    expected_checksum = (ARCHIVE_SHA256 + "  release.tar.gz\n").encode("ascii")
    require(checksum_raw == expected_checksum, "archive_checksum_receipt_mismatch")

    archive_bytes, _ = private_bytes(archive_path, limit=MAX_ARCHIVE_BYTES)
    require(hashlib.sha256(archive_bytes).hexdigest() == ARCHIVE_SHA256, "archive_digest_mismatch")
    manifest = _verify_release_bytes(archive_bytes)
    return {
        "status": "PASS",
        "archive_sha256": ARCHIVE_SHA256,
        "application_sha": APPLICATION_SHA,
        "manifest_file_count": len(manifest["files"]),
    }


def inspect_github_evidence(receipt_path=None):
    """Check a local receipt for pin consistency, never authenticate its origin."""
    if receipt_path is None:
        return {
            "status": "UNKNOWN",
            "reason": "trusted GitHub API evidence is unavailable",
        }
    receipt = private_json(receipt_path)
    expected = {
        "schema": 1,
        "artifact_id": ARTIFACT_ID,
        "source_run_id": SOURCE_RUN_ID,
        "application_sha": APPLICATION_SHA,
        "archive_sha256": ARCHIVE_SHA256,
        "container_sha256": CONTAINER_SHA256,
        "branch": "develop",
        "run_event": "push",
        "run_status": "completed",
        "run_conclusion": "success",
    }
    require(receipt == expected, "github_evidence_identity_mismatch")
    return {
        "status": "UNKNOWN",
        "reason": "local JSON cannot authenticate GitHub origin or container bytes",
    }


def reject_authorization_claims(value):
    if isinstance(value, dict):
        for key, item in value.items():
            normalized = re.sub(r"[^a-z0-9]", "", key.lower())
            require(not any(term in normalized for term in ("authoriz", "authoris", "approv")),
                    "unauthenticated_production_authorization")
            require(not (normalized == "status" and isinstance(item, str)
                         and item.upper() in AUTHORIZED_STATUSES),
                    "unauthenticated_production_authorization")
            reject_authorization_claims(item)
    elif isinstance(value, str):
        require(AUTHORIZATION_CLAIM_TEXT.search(value) is None,
                "unauthenticated_production_authorization")
    elif isinstance(value, list):
        for item in value:
            reject_authorization_claims(item)


def timestamp(value):
    require(isinstance(value, str) and re.fullmatch(
        r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z", value) is not None,
        "evidence_timestamp_format")
    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except ValueError as error:
        raise AdapterError("evidence_timestamp_invalid") from error


def private_directory(path):
    import os as os_module
    import stat as stat_module
    from pathlib import Path

    path = Path(path)
    try:
        entry = path.lstat()
    except OSError as error:
        raise AdapterError("evidence_directory_missing") from error
    require(stat_module.S_ISDIR(entry.st_mode) and entry.st_uid == os_module.getuid()
            and stat_module.S_IMODE(entry.st_mode) == 0o700, "evidence_directory_not_private")


def inspect_gate_evidence(bundle_path=None, evidence_dir=None):
    """Hash-check untrusted references; valid receipt claims remain UNKNOWN."""
    from pathlib import Path, PurePosixPath

    if bundle_path is None or evidence_dir is None:
        return {"status": "UNKNOWN", "reason": "gate evidence is unavailable"}

    private_directory(evidence_dir)
    evidence_dir = Path(evidence_dir)
    bundle = private_json(bundle_path)
    require(set(bundle) == {"schema", "operator", "evidence"} and bundle.get("schema") == 1,
            "gate_bundle_schema")
    operator = bundle.get("operator")
    require(isinstance(operator, str) and operator.strip(), "gate_operator")
    evidence = bundle.get("evidence")
    require(isinstance(evidence, dict) and set(evidence) == set(GATES), "gate_missing_or_unknown")

    now = datetime.now(timezone.utc)
    statuses = []
    for gate in GATES:
        reference = evidence[gate]
        require(isinstance(reference, dict) and set(reference) == {"file", "sha256"},
                "gate_evidence_reference")
        filename = reference["file"]
        require(isinstance(filename, str)
                and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}", filename) is not None
                and PurePosixPath(filename).name == filename, "gate_evidence_path")
        expected_digest = reference["sha256"]
        require(isinstance(expected_digest, str) and HEX64.fullmatch(expected_digest) is not None,
                "gate_evidence_digest")
        proof_raw, _ = private_bytes(evidence_dir / filename)
        require(hashlib.sha256(proof_raw).hexdigest() == expected_digest,
                "gate_evidence_hash_mismatch")
        proof = parse_json(proof_raw)
        require(isinstance(proof, dict) and set(proof) == {
            "schema", "gate", "status", "candidate", "target_identity_sha256",
            "observed_utc", "expires_utc", "independent_verifier", "claims",
        }, "gate_proof_schema")
        require(proof.get("schema") == 1 and proof.get("gate") == gate,
                "gate_proof_identity")
        require(proof.get("status") in ("PASS", "UNKNOWN", "FAIL"), "gate_status")
        require(proof.get("candidate") == pinned_candidate_record(), "gate_candidate_mismatch")
        require(isinstance(proof.get("target_identity_sha256"), str)
                and HEX64.fullmatch(proof["target_identity_sha256"]) is not None,
                "gate_target_identity")
        verifier = proof.get("independent_verifier")
        require(isinstance(verifier, str) and verifier.strip() and verifier != operator,
                "gate_verifier_claim")
        require(isinstance(proof.get("claims"), dict), "gate_claims")
        reject_authorization_claims(proof)

        observed = timestamp(proof.get("observed_utc"))
        expires = timestamp(proof.get("expires_utc"))
        require(observed <= now + timedelta(seconds=30), "gate_evidence_from_future")
        require(now - observed <= timedelta(minutes=15), "gate_evidence_stale")
        require(expires > now and expires - observed <= timedelta(minutes=15),
                "gate_evidence_expired")
        statuses.append(proof["status"])

    if "FAIL" in statuses:
        return {"status": "FAIL", "reason": "one or more untrusted gate references claim FAIL"}
    return {
        "status": "UNKNOWN",
        "reason": "hash-consistent gate references are not authenticated approvals",
        "references_checked": len(GATES),
    }


def preflight(archive_path, checksum_path, github_receipt=None, gate_bundle=None, evidence_dir=None):
    artifact = verify_artifact(archive_path, checksum_path)
    github = inspect_github_evidence(github_receipt)
    gates = inspect_gate_evidence(gate_bundle, evidence_dir)
    return {
        "status": "UNKNOWN",
        "production_authorized": False,
        "artifact": artifact,
        "github_provenance": github,
        "operational_gates": gates,
    }


def run_production(*_args, **_kwargs):
    raise AdapterError("production_execution_disabled")


def main(argv=None):
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("preflight",))
    parser.add_argument("--archive", required=True)
    parser.add_argument("--checksum", required=True)
    parser.add_argument("--github-evidence")
    parser.add_argument("--gates")
    parser.add_argument("--evidence-dir")
    args = parser.parse_args(argv)
    try:
        result = preflight(
            args.archive, args.checksum, args.github_evidence, args.gates, args.evidence_dir,
        )
    except AdapterError as error:
        print(json.dumps({"status": "FAIL", "reason": str(error)}, sort_keys=True))
        return 1
    print(json.dumps(result, sort_keys=True))
    return 0 if result["status"] == "PASS" else 2


if __name__ == "__main__":
    raise SystemExit(main())
