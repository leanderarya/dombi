# Managed-code publisher: fixture realm plus a gated, unprovisioned production door

Status: **LOCAL SYNTHETIC ONLY. Production publication is still not authorized and
still cannot run here.** The CLI refuses by default, the fixture realm refuses the
pinned production identity, and the production realm refuses everything until an
operator-held approval key, a detached approval signature, the shared publisher
lock, a verified checkpoint and a verified candidate artifact all exist. None of
those are provisioned in this repository. `.github/workflows/*` is unchanged.

This is the smallest production-code-only publisher that can be exercised safely
against disposable local fixtures. It reuses the existing
[filesystem checkpoint](../../docs/release/V1-FILESYSTEM-CHECKPOINT-SPEC.md) contract
rather than defining a competing one.

## What exists and what does not

| Component | Status |
| --- | --- |
| `scripts/recovery/code_publisher.py` | Fixture `publish()` (checkpoint-to-checkpoint) and `publish_artifact()` (candidate artifact), plus the gated `publish_artifact_production()`. |
| `scripts/recovery/test_code_publisher.py` | Focused synthetic tests for `publish()`. |
| `scripts/recovery/test_publisher_artifact.py` | Focused synthetic tests for `publish_artifact()`. |
| `scripts/recovery/test_publisher_production.py` | Focused synthetic tests for the production door and its refusals. |
| Production CLI command | **Gated and unprovisioned.** `main()` refuses unless `--production` plus every prerequisite is supplied; without the flag it prints a refusal and exits 1. |
| Production host/account/root override | **Does not exist.** No such argument is parsed; the CLI always passes `fs.PRODUCTION`. |
| Environment-variable or flag bypass | **Does not exist.** No environment variable is read at all. |
| Provisioned approval key, signature, lock or approval | **Does not exist.** Nothing is generated, created or shipped. |
| SSH, SFTP, Hostinger, database, payment, PHP, migration | Not implemented. |

`require_fixture_policy()` rejects the fixed production identity structurally: any
policy whose account equals the pinned account, whose root is or is beneath the
pinned root, or whose private directory is or is beneath the pinned private
directory aborts with `production_execution_disabled`. There is no override
constant. `publish()`, `publication_preflight()`, `apply_publication()`,
`publish_file()` and `enforce_realm()` (fixture branch) call it directly. The four
artifact helpers — `publish_artifact()`, `artifact_preflight()`,
`publish_artifact_file()` and `remove_artifact_file()` — call it through
`enforce_realm()`, whose default realm is `fixture`, so a direct call still refuses
a production-shaped policy before any journal entry or write.

## Shared contract reuse

The publisher imports the sibling module by path and refuses a foreign module:
- `fs.load_checkpoint` — pinned checkpoint, manifest and archive validation.
- `fs.inventory` — classified inventory with content hashes and metadata.
- `fs.stable_protected` — protected and shared-parent identity comparison.
- `fs.authorize` — approval shape, freshness, assertion, evidence and state pin.
- `fs.publisher_lock` — the same `dombi-filesystem-publication.lock` file.
- `fs.prior_operations` — the existing `recovery-*` lineage.
- `fs.validate_archive` — bounded archive validation and private staging.
- `fs.parent_fd`, `fs.target_at`, `fs.expected_target` — descriptor-relative,
  revalidated, no-follow mutation.
- `fs.restored_matches` — post-condition check against the checkpoint.
- `fs.journal`, `fs.write_json`, `fs.write_bytes`, `fs.fsync_directory`.

No inventory, approval, lock, archive or mutation helper is reimplemented. The
tests assert this by checking the publisher contains no copy of those functions.

The operation string is `filesystem-code-publication`, distinct from
`filesystem-checkpoint-capture` and `filesystem-code-recovery`, so an approval for
another operation cannot be substituted. Approval records must additionally carry
`publisher_sha256` equal to the publisher's own digest, and `prior_operations`
must equal the combined `{"publication": ..., "recovery": ...}` lineage.

Both realms therefore run **one** implementation of the apply sequence:
`artifact_publication()` selects exactly one identity guard from the closed set
`("fixture", "production")` via `enforce_realm()` — a constant, never a callback, so a
caller cannot inject a no-op guard — and accepts any extra realm proof. The fixture
and production realms cannot drift apart in what they validate or mutate; they differ
only in who may run them and what extra proof is demanded before anything is staged.
Every shared mutation helper defaults to the fixture realm.

## Operator inputs

`publish(policy, checkpoint_id, manifest_sha256, approval_path)` republishes the
checkpoint's own contents. `publish_artifact(policy, checkpoint_id, manifest_sha256,
approval_path, archive_path, checksum_path)` instead applies a candidate release
artifact, and is the mode a release uses.

| Input | Requirement |
| --- | --- |
| `policy` | A fixture `fs.Policy`, refused if it matches production identity. The production door requires a policy that instead describes the pinned identity. |
| `checkpoint_id` | Existing `dombi-fs-…` identifier pinned by a verified capture. |
| `manifest_sha256` | SHA-256 of that checkpoint's exact manifest bytes. |
| `approval_path` | Operator-owned `0600` single-link regular file under `policy.private`. |
| `signature_path` | Production only. Detached `0600` HMAC token under `policy.private`. |
| `key_path` | Production only. Operator-held `0600` key file outside the root and `private`. |
| `archive_path` | Verified `release.tar.gz`, `0600`, under `policy.private`. |
| `checksum_path` | Matching `release.sha256` receipt, `0600`, under `policy.private`. |

The approval is the same private JSON record the checkpoint tool already defines,
with `operation` set to `filesystem-code-publication` plus:

| Field | Requirement |
| --- | --- |
| `publisher_sha256` | `sha256` of `code_publisher.py` at approval time. |
| `manifest_sha256` | Exactly the supplied manifest pin. |
| `prior_operations` | `{"publication": {...}, "recovery": {...}}` as observed. |
| `artifact_application_sha` | Full 40-hex application SHA the artifact claims. |
| `artifact_sha256` | `sha256` of `release.tar.gz`; must equal the checksum receipt. |
| `artifact_entries_sha256` | `object_digest` of the artifact's `name → sha256` map. |
| `publication_plan_sha256` | `plan_digest(plan)` for the exact additions/replacements/removals. |
| `removals` | Exactly `plan["removals"]`; any removal must be listed here. |

`publish()` (checkpoint-to-checkpoint) ignores `removals` entirely: that mode never
deletes, creates or relinks anything, so a deletion map carries no meaning there.
`publish_artifact()` **does** honour `removals`, and refuses to remove anything the
approval did not list.

## The production door

`publish_artifact_production(policy, checkpoint_id, manifest_sha256, approval_path,
signature_path, key_path, archive_path, checksum_path, candidate=None)` is a separate
entry point that is additionally gated. It is the only production-capable code in
this repository, and it is **not provisioned**: no key, no signature, no lock and no
approval exists for it.

### Activation

Activation requires all of the following at once. There is no single switch, and no
environment variable is consulted anywhere in the module.

| Gate | Requirement |
| --- | --- |
| Explicit mode | CLI `--production`. Without it `main()` prints `PUBLISHER_DISABLED` and exits 1, whatever else is supplied. |
| Complete arguments | `--checkpoint`, `--manifest-sha256`, `--approval`, `--archive`, `--checksum`, `--signature`, `--approval-key`. Any missing one aborts with `production_arguments`. |
| Fixed identity | The CLI always passes `fs.PRODUCTION`; no host/account/root flag exists. `require_production_policy()` then requires the policy to describe that identity (`fs.check_policy`: account, resolved ancestors, `0700` private directory, root ownership/mode/device). |
| Provisioned lock | The shared `dombi-filesystem-publication.lock` must already exist as a `0600` single-link owner-owned regular file. The production path never creates it. |
| Provisioned key | A 32..4096-byte raw operator key in a `0600` single-link owner-owned regular file, absolute path, **outside** the application root and **outside** `policy.private`. |
| Detached signature | Exactly one lowercase 64-hex HMAC-SHA256 token, `0600`, inside `policy.private`, verifying against the exact approval bytes. |
| Verified checkpoint | Manifest pin, archive pin and `CHECKPOINT_VERIFIED` receipt via `fs.load_checkpoint`, plus a production-only freshness bound on `capture.completed_utc`. |
| Verified artifact | `release.py verify()` plus receipt pin, digest re-check, and the fixed candidate pin. |
| Authenticated approval | Signature covers the whole approval; the approval must also pin the key identity and the candidate digests. |

### Approval authentication, and what it does not prove

The production approval is signed with **HMAC-SHA256** over the exact approval bytes,
domain-separated by the constant `dombi-code-publication-approval-v1\0`, and compared
with `hmac.compare_digest`. The key is a **symmetric, operator-held secret file**.

This authenticates *possession of the key file*, nothing else:

- It is **not** a third-party identity. There is no public-key PKI, no certificate,
  no external signer and no notion of "who" approved.
- Anyone who can read the key file can forge an approval. Any process running as the
  publisher account can therefore sign; the signature does not prove independent
  review, and it does not prove the operator is a different person from the executor.
- The approval already requires `independent_verifier != operator`. That remains an
  **unauthenticated operator attestation**: the HMAC does not make it true.
- A symmetric key gives no non-repudiation and cannot distinguish two holders.

The signed record additionally must include `production_key_sha256` (SHA-256 of the
key material) so a signature cannot be replayed under a different key, and
`artifact_application_sha` / `artifact_sha256` must equal the fixed candidate pin so a
validly signed approval cannot be aimed at a substituted release. Detached signature
file and key path are validated on every call, and the approval digest is re-derived
and compared to the signed digest again inside the lock (`approval_signature_drift`),
so signing one record and swapping in another fails.

If stronger authenticity is required later, the honest next step is an asymmetric
signature over the same bytes with the public key pinned in the repository — that
would authenticate *a key*, still not a person. Neither step substitutes for an
external authorization record.

### Why the fixture guards are untouched

`require_fixture_policy()` and all of its call sites are preserved: no fixture check
was removed, loosened or repointed. The production realm has its own guard and never
calls the fixture one, so production cannot be reached by weakening a fixture check,
and the fixture realm cannot be reached by supplying a production key. Realm
selection is a closed constant (`enforce_realm`), not an injectable callable.
`test_publisher_production.py` asserts both directions, including that fixture
publication still needs no key or signature and that every shared helper still
defaults to the fixture guard.

### Candidate artifact versus pre-release checkpoint

The artifact is the release input; the checkpoint is the pre-release baseline and the
managed-scope authority. They are validated separately and must both agree before
anything mutates:

- The artifact is validated by the existing `scripts/ci/release.py` `verify()`:
  schema 1, `sha` equality, allowed-path rules, member modes `0644`, exact inventory
  equality, and per-member SHA-256. The publisher re-checks the archive digest before
  and after validation, and pins the receipt token, so a substituted archive fails.
- The checkpoint supplies `boundaries`, the managed/protected classification and the
  baseline inventory used for the plan and the post-condition.
- Nothing is planned until both are validated and every planned path is inside a
  declared `managed_scope`, outside every protected path, and classified `managed`.

Approval issuance and the effective-identity witness must be at most 15 minutes
old, unexpired, and not future-dated — enforced by `fs.authorize()`. Every
`FLAGS` assertion and `EVIDENCE` reference is still mandatory. Nothing here
authenticates the truth of those attestations; they remain operator statements.

## Invariants

1. **Explicit management only.** Only entries the checkpoint classifies as
   `managed` are published. `protected` and `shared-parent` entries are compared
   and never written, chmodded, chowned or removed.
2. **No publication without a verified checkpoint.** The manifest, archive pin
   and `CHECKPOINT_VERIFIED` receipt are validated on every run and revalidated
   under the lock.
3. **Exact target inventory.** An unlisted managed entry aborts with
   `unexpected_target_inventory`. A type change aborts with
   `target_type_conflict`. A retargeted, relinked or metadata-drifted managed
   symlink aborts with `symlink_target_changed` / `managed_symlink_drift`. A
   missing managed entry aborts with `missing_target_entry` unless it is a
   regular file whose parent directories are all still live directories, in which
   case it is republished. No directory is ever created and no path is ever
   deleted or relinked.
4. **Identity-bound mutation.** Every write goes through `fs.parent_fd()` with
   recorded root device/inode, then `fs.target_at()` revalidates device, inode,
   uid, gid, mode, size, mtime and content immediately before `os.replace`.
   Staged payloads are opened with `O_NOFOLLOW`, verified against the manifest
   size and SHA-256, and metadata (uid, gid, mode, nanosecond mtime) is applied
   and re-verified before use. `publish_artifact()` applies the release format's
   own contract instead: mode `0644`, artifacts are regular files only.
5. **Preflight before the first replacement.** `publication_preflight()`,
   `artifact_preflight()` and `verify_staged()` complete every inventory, type,
   parent and staged-content check before the first file is replaced or removed,
   and before the audit directory exists. A missing managed symlink, drifted
   target or unapproved removal is therefore rejected with the tree untouched,
   not part-way through the publication. `apply_publication()` repeats its checks
   so a direct call cannot skip them.
6. **Staging stays outside the application root.** `fs.validate_archive()` and
   `stage_artifact()` write `payload-N` files only inside the private publication
   directory, on the same device as the application root (validated by
   `fs.check_policy()`). Artifact members are re-hashed against the manifest while
   staging; a mismatch aborts before any mutation.
7. **Shared lock, no bypass.** The whole apply phase runs under
   `fs.publisher_lock()`, which is the checkpoint's non-blocking `flock` on the
   one shared lock file. A busy lock raises `BlockingIOError` and nothing changes.
8. **Protected-state equality.** `fs.restored_matches()` (and
   `artifact_matches()` for the artifact mode) requires the managed set to equal
   the intended state *and* `stable_protected()` to equal its own immediate
   pre-publication value. Database files stay metadata-only; no content is read
   and no integrity is claimed.
9. **Approval is single-use.** The audit directory name embeds the approval
   digest, so replaying an approval aborts. An interrupted operation stays on
   disk and must be acknowledged in a fresh approval.
10. **No silent repair of lineage.** Any unfinished `recovery-*` directory aborts
    with `incomplete_prior_recovery`. Prior publication directories with unknown
    entries abort. Nothing is cleaned by prefix.
11. **Interruption keeps held.** `FAILED_OR_INTERRUPTED_KEEP_HELD` is journalled,
    no `outcome.json` is written, no rollback or resume occurs, and the result is
    never reported as success. Removal is journalled as `remove-intent` before the
    unlink and `removed` after it, so a crash mid-way is visible and never assumed.
12. **Removals are bounded and explicit.** Only a managed regular file that also
    exists in the checkpoint baseline may be removed, it must be listed in
    `approval["removals"]`, it must not be protected, and it must not be an
    ancestor of any protected entry. An unbaselined stale file aborts with
    `unbaselined_target_removal` rather than being swept away.
13. **The artifact cannot widen scope.** Every artifact path must be canonical,
    inside a declared `managed_scope`, outside every protected path, and
    classified `managed`. Directories and symlinks are never created or retargeted;
    a managed symlink whose metadata drifts aborts. Artifact and checksum inputs
    must live under `policy.private`, be `0600` single-link regular files.
14. **The fixture boundary is not entry-point scoped.** `publish_file()`,
    `apply_publication()`, `publication_preflight()`, `publish()` and the fixture
    branch of `enforce_realm()` call `require_fixture_policy()` directly. The four
    artifact helpers call it through `enforce_realm()`, whose default realm is
    `fixture`. Either way, importing the module and calling a mutation helper
    directly is refused for a production-shaped policy before any journal entry or
    write.
15. **The production realm is separately and additionally gated.** It runs the same
    apply body with its own identity guard and its own extra proofs (provisioned
    lock, provisioned key, detached signature, key identity, candidate pin,
    checkpoint freshness). It cannot be entered without `--production` *and* every
    prerequisite, and it does not weaken, bypass or duplicate any fixture guard.
16. **Production failure is quiet.** Every production abort prints only
    `PRODUCTION_ABORT` on stderr with empty stdout. No key material, approval
    content, path or inventory digest is printed by the production path.

## Success and failure semantics

Success means only `CODE_PUBLISH_COMPLETE_KEEP_HELD`. It is a filesystem
statement about a disposable fixture, or with the production door about managed
code placement only: it is **not** deployment, adoption, healthy runtime,
callback safety, payment correctness or permission to reopen.

| Condition | Result |
| --- | --- |
| Valid approval, valid checkpoint, valid target tree | `CODE_PUBLISH_COMPLETE_KEEP_HELD` |
| Valid artifact, valid checkpoint, valid target tree | `CODE_PUBLISH_COMPLETE_KEEP_HELD` |
| Missing/stale/expired/mismatched approval | `CheckpointError`, nothing mutated |
| Artifact digest, receipt, schema or member digest mismatch | `CheckpointError`, nothing mutated |
| Artifact path outside managed scope, or protected | `CheckpointError`, nothing mutated |
| Unapproved, unbaselined or protected-target removal | `CheckpointError`, nothing mutated |
| Busy shared lock | `BlockingIOError`, nothing mutated |
| Unexpected, missing-parent, retyped or relinked target | `CheckpointError`, nothing mutated |
| Missing managed symlink or directory | `CheckpointError` before the first replacement, nothing mutated |
| Interrupted apply | Journal only; operation stays unfinished; never success |
| Post-condition mismatch | `CheckpointError`; journal only; never success |
| Production: no `--production` | `PUBLISHER_DISABLED`, exit 1, empty stdout |
| Production: any missing key/lock/signature/prerequisite | `PRODUCTION_ABORT`, exit 1, nothing mutated |
| Production: bad or stale signature, wrong key identity, wrong candidate | `PRODUCTION_ABORT`, exit 1, nothing mutated |

Protected state, persistent uploads, generated caches, `.env*` keys, database
files and their sidecars are preserved and are absent from the code archive.

## Verification

```bash
python3 -B -m unittest discover -s scripts/recovery -p 'test_publisher_production.py' -v
python3 -B -m unittest discover -s scripts/recovery -p 'test_code_publisher.py'
python3 -B -m unittest discover -s scripts/recovery -p 'test_publisher_artifact.py'
python3 -B -m unittest discover -s scripts/recovery -p 'test_filesystem_checkpoint.py' -v
```

All four suites use synthetic fixtures under a temporary directory. They mock only
the macOS metadata adapters (`os.listxattr`, POSIX ACL probes); real file
replacement, unlink, timestamps, ownership, locking and `fsync` are exercised.

`test_publisher_artifact.py` covers normal publication (additions, replacements and
removals together), no-op publication, mode repair, protected-state preservation,
artifact identity and receipt mismatch, out-of-scope and protected artifact members,
inventory and plan digest approval, unapproved removals, type conflicts, unbaselined
stale files, stale approvals, interruption with a required fresh approval, unfinished
prior recovery, shared-lock contention, symlinked-parent escape, input boundary, and
the production refusal.

`test_publisher_production.py` covers the production door with a synthetic fixture
policy that is **not** the pinned identity: refusal without the explicit flag (and
with a populated environment), refusal of a missing/unreadable/permission-loose/
wrongly located key, a bad or malformed signature, an approval tampered after
signing, a missing key-identity field, stale and future-dated approvals, a missing
or busy lock, an artifact digest mismatch, a receipt that disagrees with the archive,
a manifest pin mismatch, a stale checkpoint baseline, an unfinished prior recovery,
a candidate pin that disagrees with the approval or is malformed, an inconsistent
policy, out-of-scope and protected artifact members, protected-state preservation,
single-use approval, interruption journal, and a fully-satisfied synthetic success.
It also asserts the fixture realm is unchanged.

No test creates the real production lock, key, approval or checkpoint, and
`fs.PRODUCTION` is never provisioned or written.

## Remaining production blockers

The production door is a **fail-closed skeleton, not an authorized tool**. No real
publication may be attempted. Before any real publication a separately authorized
change must still provide:

1. **Real execution authorization.** This repository contains no approval that
   authorizes running the production path against the real host. Nothing here is
   that authorization, and the tool cannot create or grant it.
2. **Host provisioning.** The shared `dombi-filesystem-publication.lock` must exist
   as a `0600` operator-owned file on the production account, and the publisher and
   checkpoint must be provisioned with pinned digests. None of that exists.
3. **Operator key custody.** The HMAC key must be generated, stored `0600` outside
   both the application root and `private-backups`, and have a documented rotation
   and revocation procedure. Custody is entirely external; no key material is
   generated, stored or referenced here.
4. **An authenticated authority model.** A symmetric operator key authenticates
   possession of a file, not a person or an approving body. Genuine independent
   review still has to be established outside this tool. A pinned asymmetric key
   would raise the bar for forgery but would still not authenticate a human.
5. **Bound production identity evidence.** Fresh host/account/root identity, a fresh
   verified checkpoint, current tool digests and a complete damaged-state inventory
   must be established independently and bound into the approval.
6. **Containment and compatibility evidence.** Independent writer/admission
   containment, DOKU callback handling, live runtime database identity, schema
   compatibility and complete worker adoption. The `FLAGS` and `EVIDENCE` fields
   remain operator attestations; nothing verifies their truth.
7. **Writer cooperation with the lock.** Every writer must actually take the shared
   lock; otherwise it is advisory only and the preflight re-checks prove nothing
   against a concurrent writer.
8. **An interrupted-operation and unexpected-inventory remediation policy.** This
   variant refuses rather than repairs: a `FAILED_OR_INTERRUPTED_KEEP_HELD`
   operation stays on disk and blocks further publication until acknowledged.
9. **A reopening decision process.** `CODE_PUBLISH_COMPLETE_KEEP_HELD` is a
   filesystem statement only. It is not deployment, adoption, healthy runtime,
   callback safety, payment correctness or permission to reopen.

No production host, database, callback, worker, backup or recovery evidence was
accessed while producing this file.
