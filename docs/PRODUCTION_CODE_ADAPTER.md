# Production release preflight

Status: **READY FOR REVIEW as a read-only preflight; NOT READY to authorize or
execute production changes.** The CLI supports only `preflight`. There is no
publisher, publication API, SSH/SFTP connection, lock acquisition, cleanup, or
deployment command. `.github/workflows/deploy.yml` remains hard-stopped and
unchanged.

The preflight is local and read-only. It validates fixed archive bytes and the
schema-1 `release.json` inventory using a verification-only implementation of the
existing release format. It does not import `scripts/ci/release.py`, whose module
also exposes pack/extract commands, and it never extracts the archive. The release
pins are fixed in the module:

| Field | Required value |
| --- | --- |
| Artifact ID | `14015610232` |
| Source CI run | `43377554794` |
| Application SHA | `4ebe5e1da608b0c7404e2667cb99742747db4796` |
| Artifact-container SHA-256 | `48ff3ba53525c194efc5db859c8f6fc6a1a4a860e019c7a18c5b29838ed3c0dc` |
| `release.tar.gz` SHA-256 | `5b5a54453badc86134e890cb4f5448a80dce1fc1b391eec03ec41284988225d5` |

`verify_artifact()` accepts only the local tar and checksum paths; callers cannot
override release identity or validation time. A matching tar proves its bytes and
embedded manifest against the fixed pins, but does not by itself authenticate the
GitHub artifact ID, source run, or outer container.

## Archive resource limits

The verifier reads the compressed archive into memory, capped at 512 MiB, to
check its pinned digest. It then walks the decompressed gzip/TAR stream in
streaming mode, hashing regular-file contents in 64 KiB chunks. It does not
extract members to disk or retain their contents; apart from the bounded
compressed input, only the manifest and member-name/digest inventory are kept
for schema validation.

| Resource | Limit |
| --- | ---: |
| Compressed archive | 512 MiB |
| TAR members | 100,000 |
| UTF-8 member name | 1,024 bytes |
| Declared size per member | 256 MiB |
| Total declared member payload | 2 GiB |
| Actual member payload consumed | 2 GiB |
| Decompressed TAR stream, including headers and padding | 2.25 GiB |
| `release.json` | 16 MiB |
| Each PAX/GNU extension header | 64 KiB |
| PAX/GNU extension headers | 100,000 |
| Total PAX/GNU extension data | 16 MiB |
| Hash/read chunk | 64 KiB |

The verifier rejects archives exceeding a cap, malformed or truncated streams,
missing or invalid TAR end markers, non-zero trailing TAR data, unsafe member
types or paths, links, duplicate names, declared/actual size mismatches, and
inventory or manifest mismatches. Each declared PAX body must consist entirely
of correctly sized records with valid UTF-8 keys/values (except binary name
fields explicitly marked `BINARY`), separators, and newline terminators; block
padding must be zero-filled and cannot supply PAX metadata. These bounds limit
work and memory, but do not make the preflight an authorization or a substitute
for authenticated provenance.

## Provenance and gate evidence

`inspect_github_evidence()` accepts an optional private local JSON receipt with the
fixed identity fields. A missing receipt is **UNKNOWN**. A matching local receipt
is also **UNKNOWN**, because a file supplied locally cannot authenticate that
GitHub produced it or prove the outer container bytes. A mismatch is rejected.
No network request or GitHub credential is used.

`inspect_gate_evidence()` checks the private bundle shape, exact six gate names,
candidate binding, timestamps, proof-file hashes, and explicit authorization
claims. These files are **untrusted evidence references**, not approvals. Even a
hash-consistent set of fresh `PASS` claims returns **UNKNOWN**; an explicit
production-authorization claim is rejected. There is no signer trust store,
signature verification, one-time approval consumption, or assertion that a named
verifier is genuine.

## Blockers before a separately authorized publisher

- Bind an authenticated, one-use approval to the exact host/account/root identity,
  fresh checkpoint manifest digest, checkpoint tool digest, candidate, observed
  inventory, and operation. The checkpoint’s private shared lock is
  `dombi-filesystem-publication.lock`; any future publisher must use that exact
  lock and demonstrate that every writer cooperates with it.
- Reconcile the full target inventory against checkpoint boundaries. Unknown local
  files and stale managed files must stop or require separately authorized,
  evidence-bound handling. Never delete by prefix or infer that unlisted means safe.
- Independently establish provider-supported admission/writer exclusion and drain,
  durable DOKU callback containment and late-event handling, actual runtime DB
  identity plus schema compatibility, and complete worker adoption/recovery.
- Design the publisher and failure recovery against the checkpoint contract:
  descriptor-relative no-follow mutation, revalidation, operation-bound durable
  journals, keep-held behavior after interruption, explicit approval for retry,
  protected-state preservation, and no automatic rollback or reopening.

No production host, checkpoint, DB, callback, worker, backup, or recovery evidence
was accessed here. The preflight result is never deployment authorization.

## Local tests

```bash
python3 -B -m unittest discover -s scripts/ci -p 'test_production_code_adapter.py' -v
python3 -B -m unittest discover -s scripts/ci -p 'test_release.py' -v
python3 -B -m unittest discover -s scripts/ci -p 'test_safety.py' -v
```

The exact pinned production artifact's successful preflight path is **UNTESTED
LOCALLY**. The local success-path test uses a synthetic release fixture and
temporary test-only pin substitution to exercise manifest validation and confirm
that reading through validation does not mutate its inputs.

Prior artifact-byte verification is referenced separately in `docs/CI_CD.md`,
under “Previously approved artifact compatibility” (artifact ID, source run,
application SHA, and tar digest). That historical record is not this local
synthetic test, does not authenticate GitHub provenance, and grants no production
authorization.

Tests use synthetic local artifacts and receipts. They cannot establish GitHub
origin, production readiness, Hostinger filesystem behavior, or operational gates.
