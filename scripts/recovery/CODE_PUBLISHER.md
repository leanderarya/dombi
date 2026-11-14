# Fixture-only managed-code publisher

Status: **LOCAL SYNTHETIC ONLY. Production publication does not exist and is
hard-disabled.** No production CLI, workflow, SSH/SFTP path, Hostinger access,
database or payment operation is implemented. `.github/workflows/*` is unchanged.

This is the smallest production-code-only publisher that can be exercised safely
against disposable local fixtures. It reuses the existing
[filesystem checkpoint](../../docs/release/V1-FILESYSTEM-CHECKPOINT-SPEC.md) contract
rather than defining a competing one.

## What exists and what does not

| Component | Status |
| --- | --- |
| `scripts/recovery/code_publisher.py` | Fixture-only `publish()` function. |
| `scripts/recovery/test_code_publisher.py` | Focused synthetic tests. |
| Production CLI command | **Does not exist.** `main()` prints a refusal, exit 1, empty stdout. |
| Production host/account/root override | **Does not exist.** No such argument is parsed. |
| Environment-variable or flag bypass | **Does not exist.** |
| SSH, SFTP, Hostinger, database, payment, PHP, migration | Not implemented. |

`require_fixture_policy()` rejects the fixed production identity structurally: any
policy whose account equals the pinned account, whose root is or is beneath the
pinned root, or whose private directory is or is beneath the pinned private
directory aborts with `production_execution_disabled`. There is no override
constant; enabling production requires a separately authorized implementation.
`publish()`, `publication_preflight()`, `apply_publication()` and `publish_file()`
each enforce it themselves, so no single entry point carries the guard.

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

## Operator inputs

`publish(policy, checkpoint_id, manifest_sha256, approval_path)`:

| Input | Requirement |
| --- | --- |
| `policy` | A fixture `fs.Policy`, refused if it matches production identity. |
| `checkpoint_id` | Existing `dombi-fs-…` identifier pinned by a verified capture. |
| `manifest_sha256` | SHA-256 of that checkpoint's exact manifest bytes. |
| `approval_path` | Operator-owned `0600` single-link regular file under `policy.private`. |

The approval is the same private JSON record the checkpoint tool already defines,
with `operation` set to `filesystem-code-publication` plus:

| Field | Requirement |
| --- | --- |
| `publisher_sha256` | `sha256` of `code_publisher.py` at approval time. |
| `manifest_sha256` | Exactly the supplied manifest pin. |
| `prior_operations` | `{"publication": {...}, "recovery": {...}}` as observed. |

A `removals` field is never read, so it is ignored rather than rejected. This
publisher only rewrites managed regular files; it never deletes, creates or
relinks anything, so a deletion map carries no meaning here.

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
   and re-verified before use.
5. **Preflight before the first replacement.** `publication_preflight()` and
   `verify_staged()` complete every inventory, type, parent and staged-content
   check before the first file is replaced and before the audit directory exists.
   A missing managed symlink or drifted target is therefore rejected with the
   tree untouched, not part-way through the publication. `apply_publication()`
   repeats both checks so a direct call cannot skip them.
5. **Staging stays outside the application root.** `fs.validate_archive()` writes
   `payload-N` files only inside the private publication directory, on the same
   device as the application root (validated by `fs.check_policy()`).
6. **Shared lock, no bypass.** The whole apply phase runs under
   `fs.publisher_lock()`, which is the checkpoint's non-blocking `flock` on the
   one shared lock file. A busy lock raises `BlockingIOError` and nothing changes.
7. **Protected-state equality.** `fs.restored_matches()` requires the managed set
   to equal the checkpoint exactly *and* `stable_protected()` to equal its own
   immediate pre-publication value. Database files stay metadata-only; no content
   is read and no integrity is claimed.
8. **Approval is single-use.** The audit directory name embeds the approval
   digest, so replaying an approval aborts. An interrupted operation stays on
   disk and must be acknowledged in a fresh approval.
9. **No silent repair of lineage.** Any unfinished `recovery-*` directory aborts
   with `incomplete_prior_recovery`. Prior publication directories with unknown
   entries abort. Nothing is cleaned by prefix.
10. **Interruption keeps held.** `FAILED_OR_INTERRUPTED_KEEP_HELD` is journalled,
    no `outcome.json` is written, no rollback or resume occurs, and the result is
    never reported as success.
11. **The fixture boundary is not entry-point scoped.** `publish_file()`,
    `apply_publication()` and `publication_preflight()` each call
    `require_fixture_policy()` themselves, so importing the module and calling a
    mutation helper directly is refused for a production-shaped policy before any
    journal entry or write. The guard does not depend on the CLI or on `publish()`.

## Success and failure semantics

Success means only `CODE_PUBLISH_COMPLETE_KEEP_HELD`. It is a filesystem
statement about a disposable fixture: it is **not** deployment, adoption,
healthy runtime, callback safety, payment correctness or permission to reopen.

| Condition | Result |
| --- | --- |
| Valid approval, valid checkpoint, valid target tree | `CODE_PUBLISH_COMPLETE_KEEP_HELD` |
| Missing/stale/expired/mismatched approval | `CheckpointError`, nothing mutated |
| Busy shared lock | `BlockingIOError`, nothing mutated |
| Unexpected, missing-parent, retyped or relinked target | `CheckpointError`, nothing mutated |
| Missing managed symlink or directory | `CheckpointError` before the first replacement, nothing mutated |
| Interrupted apply | Journal only; operation stays unfinished; never success |
| Post-condition mismatch | `CheckpointError`; journal only; never success |

Protected state, persistent uploads, generated caches, `.env*` keys, database
files and their sidecars are preserved and are absent from the code archive.

## Verification

```bash
python3 -B -m unittest discover -s scripts/recovery -p 'test_code_publisher.py' -v
python3 -B -m unittest discover -s scripts/recovery -p 'test_filesystem_checkpoint.py' -v
```

Both suites use synthetic fixtures under a temporary directory. They mock only the
macOS metadata adapters (`os.listxattr`, POSIX ACL probes); real file replacement,
timestamps, ownership, locking and `fsync` are exercised.

## Remaining production blockers

This publisher is deliberately **not** a production tool. Before any real
publication a separately authorized change must still provide:

1. An authenticated, one-use production approval with genuine independent
   review, and a signer/authority model the tool cannot fabricate.
2. Bound production host/account/root identity, fresh checkpoint manifest and
   tool digests, and a complete observed damaged-state inventory.
3. Independently established writer/admission containment, DOKU callback
   handling, live runtime database identity, schema compatibility and complete
   worker adoption.
4. A remediation policy for stale files, unexpected inventory and interrupted
   operations; this variant refuses rather than repairs.
5. A rendered operator documentation review of artifact deployment, and evidence
   that every writer cooperates with the shared publication lock.

No production host, database, callback, worker, backup or recovery evidence was
accessed while producing this file.
