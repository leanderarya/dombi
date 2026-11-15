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
| `scripts/recovery/code_publisher.py` | Fixture-only `publish()` (checkpoint-to-checkpoint) and `publish_artifact()` (candidate artifact). |
| `scripts/recovery/test_code_publisher.py` | Focused synthetic tests for `publish()`. |
| `scripts/recovery/test_publisher_artifact.py` | Focused synthetic tests for `publish_artifact()`. |
| Production CLI command | **Does not exist.** `main()` prints a refusal, exit 1, empty stdout. |
| Production host/account/root override | **Does not exist.** No such argument is parsed. |
| Environment-variable or flag bypass | **Does not exist.** |
| SSH, SFTP, Hostinger, database, payment, PHP, migration | Not implemented. |

`require_fixture_policy()` rejects the fixed production identity structurally: any
policy whose account equals the pinned account, whose root is or is beneath the
pinned root, or whose private directory is or is beneath the pinned private
directory aborts with `production_execution_disabled`. There is no override
constant; enabling production requires a separately authorized implementation.
`publish()`, `publish_artifact()`, `artifact_preflight()`, `publish_artifact_file()`,
`remove_artifact_file()`, `publication_preflight()`, `apply_publication()` and
`publish_file()` each enforce it themselves, so no single entry point carries the guard.

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

`publish(policy, checkpoint_id, manifest_sha256, approval_path)` republishes the
checkpoint's own contents. `publish_artifact(policy, checkpoint_id, manifest_sha256,
approval_path, archive_path, checksum_path)` instead applies a candidate release
artifact, and is the mode a release uses.

| Input | Requirement |
| --- | --- |
| `policy` | A fixture `fs.Policy`, refused if it matches production identity. |
| `checkpoint_id` | Existing `dombi-fs-…` identifier pinned by a verified capture. |
| `manifest_sha256` | SHA-256 of that checkpoint's exact manifest bytes. |
| `approval_path` | Operator-owned `0600` single-link regular file under `policy.private`. |
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
    `apply_publication()`, `publication_preflight()`, `publish_artifact()`,
    `artifact_preflight()`, `publish_artifact_file()` and `remove_artifact_file()`
    each call `require_fixture_policy()` themselves, so importing the module and
    calling a mutation helper directly is refused for a production-shaped policy
    before any journal entry or write.

## Success and failure semantics

Success means only `CODE_PUBLISH_COMPLETE_KEEP_HELD`. It is a filesystem
statement about a disposable fixture: it is **not** deployment, adoption,
healthy runtime, callback safety, payment correctness or permission to reopen.

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

Protected state, persistent uploads, generated caches, `.env*` keys, database
files and their sidecars are preserved and are absent from the code archive.

## Verification

```bash
python3 -B -m unittest discover -s scripts/recovery -p 'test_code_publisher.py' -v
python3 -B -m unittest discover -s scripts/recovery -p 'test_publisher_artifact.py' -v
python3 -B -m unittest discover -s scripts/recovery -p 'test_filesystem_checkpoint.py' -v
```

All three suites use synthetic fixtures under a temporary directory. They mock only
the macOS metadata adapters (`os.listxattr`, POSIX ACL probes); real file
replacement, unlink, timestamps, ownership, locking and `fsync` are exercised.

`test_publisher_artifact.py` covers normal publication (additions, replacements and
removals together), no-op publication, mode repair, protected-state preservation,
artifact identity and receipt mismatch, out-of-scope and protected artifact members,
inventory and plan digest approval, unapproved removals, type conflicts, unbaselined
stale files, stale approvals, interruption with a required fresh approval, unfinished
prior recovery, shared-lock contention, symlinked-parent escape, input boundary, and
the production refusal.

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
4. A production execution path: the CLI still refuses, `require_fixture_policy()`
   still excludes the pinned production identity, and no approved wrapper exists
   that supplies the artifact, approval and shared-lock preconditions.
5. Approved operator documentation and provisioning for that path: the shared
   `dombi-filesystem-publication.lock` must exist, and the checkpoint and publisher
   must be provisioned with pinned digests.
6. Evidence that every writer cooperates with the shared publication lock;
   otherwise the lock is advisory only.
7. A remediation policy for interrupted operations and unexpected inventory; this
   variant refuses rather than repairs.

No production host, database, callback, worker, backup or recovery evidence was
accessed while producing this file.
