# Manifest-based filesystem checkpoint tool

Status: local review candidate only. No production execution/provisioning approval.
Implements [the specification](../../docs/release/V1-FILESYSTEM-CHECKPOINT-SPEC.md)
separately from the historical SHA-bound tools. Finance/restore-drill waivers and
historical tools are unchanged.

## Interface

`filesystem_checkpoint.py` defaults to read-only `inspect`; missing arguments abort
before production policy access. The CLI has no root/account/test-policy overrides.

| Mode | Inputs | Effect |
| --- | --- | --- |
| `inspect --plan` | Private JSON plan containing `boundaries` and `host_inventory_reference` | Read-only inventory digest and root identity for independent preparation of capture authorization. |
| `inspect` | `--checkpoint`, `--manifest-sha256` | Validate checkpoint/archive and report current inventory, removal-plan and prior-operation digests. No extraction, lock creation or cleanup. |
| `verify` | Same checkpoint pins | Additionally compare managed inventory with baseline. Does not attest protected content or web-worker identity. |
| `capture` | `--approval` | Separately authorized, exclusive private code archive, manifest and verification receipt. |
| `recover` | Checkpoint pins, `--approval`, `--confirm` | Separately authorized managed-code recovery; always keeps admissions held. |

The existing private parent and shared publisher lock must already be securely
provisioned. Lock filename: `dombi-filesystem-publication.lock` under the fixed
private parent. Every publisher must cooperate with this same lock; its presence
does not establish that operational fact.

Boundary declarations contain explicit `managed_scopes`, `protected_paths`,
`database_paths` and `protected_links` (path to literal target). Include every
identified custom credential, database, upload and persistent path. Built-in
protections are a floor, not a secret-discovery mechanism. Unknown entries outside
declared scopes abort. External/chained links, xattrs/ACLs, hardlinks, special files,
cross-device roots and unsupported metadata operations fail closed.

## Authorization records

There is no production approval generator. An independently reviewed private JSON
approval binds `operation`, `checkpoint_id`, `operator`, `independent_verifier`,
`tool_sha256`, `candidate`, `root_identity`, `host_inventory_reference`, `boundaries`,
`issued_utc`, `expires_utc`, `identity_verified_utc`, `observed_state_sha256`,
`publisher_lock_path`, `effective_identity`, every `FLAGS` assertion and each
`EVIDENCE` reference defined in the tool. Times are UTC and bounded to 15 minutes.
The operation is `filesystem-checkpoint-capture` or `filesystem-code-recovery`.

Recovery additionally binds `manifest_sha256`, the exact `prior_operations` digest
map, and an explicit `removals` map of paths to observed-entry digest and reason
(`candidate-only` or `type-conflict`). A `deletion_evidence_reference` must support
that attribution. Being under a managed scope alone does not authorize deletion.
Confirmation binds the fixed root, checkpoint ID and manifest digest.

References/assertions are operator attestations, not automatically authenticated
external evidence. The tool cannot establish real authority, writer drain, DOKU
delivery guarantees, schema compatibility or hosting quota. These remain real
operational gates; filesystem free-space checks do not establish account quota.

## Failure and platform limits

Staging/audit/journal files remain outside the application root on the same device.
There is no in-root temporary-file fallback and no cleanup command. Failed/partial
operations remain private for review; new approval must acknowledge their exact
inventory digests. Unknown/incompletely identified operation directories stop
continuation and require separate review, never prefix-based deletion.

Manifest and approval JSON are hashed and parsed from the same bounded byte buffer
read through one validated descriptor. Path identity is checked after parsing;
each later authorization recheck reads a new snapshot against the original digest.
The audit stores the exact approved bytes, including noncanonical whitespace.

Mutations traverse parent descriptors without following symlinks and revalidate
target identity/content immediately before unlink or replacement. These checks
detect observed drift; they are not an atomic compare-and-unlink/replace primitive.
A non-cooperative writer can still race the final check and syscall, or rename an
opened parent. Real writer exclusion and the shared publisher lock remain mandatory;
the tool cannot make concurrent unauthorized writers safe.

Damaged-state inspection may accept an unchanged managed symlink whose baseline
target was removed for a type conflict, only when a pinned prior operation's
authorization, pre-state and durable removal-intent journal match. This covers a
crash immediately after deletion, before a completion entry. Baseline validation
and final verification still require complete links. Escaping, chained, changed or
unjournaled dangling links remain rejected. Continuation requires a fresh approval
binding the entire damaged inventory and prior-operation digests; no automatic
resume or cleanup is performed.

Repeated attempts extend that lineage with `publish-symlink-intent` records. Before
rename, the staged link's exact device/inode, ownership, mode, nanosecond mtime,
literal target and baseline metadata are recorded in a fsynced journal. Staging
directory entries are synced before the intent; destination and source directories
are synced after rename. Rename preserves the recorded inode, so a crash after
publication but before a completion record does not require guessing its identity.

A publication record is eligible only when its operation's pinned authorization
and approved pre-state reference a previously validated link identity, and its
`prior_operations` pin matches that ancestor operation's current digest. Resolution
follows this dependency chain, not filename/hash ordering. The current link must
match one exact identity in the chain; an identical-target replacement with another
inode is rejected. Each subsequent attempt still requires a fresh approval of the
entire observed damaged state and prior-operation digests.

Failure before intent persistence leaves the original link eligible; a durable
intent without rename does not authorize an arbitrary replacement. A torn or
otherwise invalid journal remains fail-closed and needs separate review, not
automatic repair. These fsync ordering rules are not a claim that power-loss
durability has been tested on Linux or the hosting filesystem. Private journals
and approvals remain operator attestations under the existing authority model,
not cryptographic authentication against a malicious same-account operator.

### ACL handling

ACLs are probed explicitly rather than inferred from `listxattr`. For every entry
the tool calls `getxattr` with `follow_symlinks=False` on
`system.posix_acl_access`; directories are also probed for
`system.posix_acl_default`. Descriptor-relative paths are used on Linux.

| Result | Handling |
| --- | --- |
| `ENODATA` / `ENOATTR` | Treated as absent; inventory continues. |
| ACL value returned | Fail closed (`acl_present`); metadata is not silently dropped. |
| `EPERM` / `EACCES` | Fail closed (`acl_inaccessible`). |
| `ENOTSUP` / `EOPNOTSUPP` | Fail closed (`acl_unsupported`). |
| Missing `os.getxattr` | Fail closed (`unsupported_metadata_platform`). |
| Any other `OSError` | Fail closed (`acl_check_failed`). |

The same inventory path runs for capture, inspect/verify and recovery, so an
ACL that appears after approval causes recovery to abort before mutation. Database
files stay metadata-only: ACL probing reads metadata, never file contents.

Remaining limitations: ACLs on symlinks are probed with no-follow semantics but
may report unsupported/inaccessible on some filesystems, which fails closed rather
than being ignored. Non-POSIX ACL implementations (for example NFSv4 or
platform-specific ACL xattrs) are not detected, and a host-side ACL that is
invisible to `getxattr` cannot be excluded. Coverage is per path; a passing sample
does not prove the whole tree is ACL-free.

Database files/sidecars are never opened for content. Their metadata-only equality
cannot detect content changes that leave metadata unchanged. Protected state is
compared with immediately pre-recovery state, not an old business-data snapshot.
No protected data, cache regeneration, PHP, database connection, external request,
callback release or reopening operation is implemented.

Native metadata handling targets Linux Python with `os.listxattr` and `/proc/self/fd`.
Missing APIs or nonempty xattrs/ACLs abort. On macOS the synthetic tests explicitly
mock the missing xattr adapter; actual fixture file replacement, timestamps,
ownership, links, locking and fsync are exercised. This is not native Linux or
Hostinger verification. No production readiness is inferred.

## Synthetic verification only

```bash
python3 -B -m unittest discover -s scripts/recovery -p 'test_filesystem_checkpoint.py' -v
```

Tests inject a fixture-only internal `Policy`; no fixed production path is accessed.
Approval helpers exist only in tests and describe synthetic evidence.
