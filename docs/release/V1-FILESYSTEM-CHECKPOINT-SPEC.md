# Dombi V1.0 filesystem checkpoint and code recovery specification

Status: **DRAFT / execution HOLD**. Local specification only. No checkpoint,
recovery implementation, provisioning, production access or execution is authorized.
Existing Owner-approved finance and restore-drill waivers remain unchanged within
their recorded scope. This document neither reopens them nor treats them as proof.

## 1. Identity and compatibility

- Fixed account: `u399215191`.
- Fixed root: `/home/u399215191/domains/dombicenter.com/public_html/app`.
- Fixed document root: application root plus `/public`.
- Historical application SHA: **UNKNOWN**, not a prerequisite or a fabricated value.
- Proposed candidate artifact: `14015610232`.
- Candidate application SHA: `4ebe5e1da608b0c7404e2667cb99742747db4796`.
- Candidate archive SHA-256:
  `5b5a54453badc86134e890cb4f5448a80dce1fc1b391eec03ec41284988225d5`.

Historical context, not a dependency shipped with this candidate: the previously
inspected recovery README and `recover-production.py` describe a separate
SHA-bound recovery contract. The inspected tool's SHA-256 was
`b84cbd959f09b75f89611e99b57dd6d34cda2f9609adc006a9902fd2d8090d88`;
it binds historical baseline `334637a9e8cd2ba639c557e4be80d4a19fdfc92d`,
RC `76ca5ca209c8fee2a500194c4ea6d9894ef2d051`, archive pins and
release-marker contents. Those historical documents/tools are absent from this
candidate's local `develop` base and are not imported here. They cannot accept
this checkpoint by substitution. Preserve all historical tools, archives,
receipts, approval requirements and worktree procedures unchanged.

The new variant is limited to this fixed production root and code-only recovery.
It must not bootstrap PHP, query a database, manage payments, restore persistent
data, change workflows, regenerate caches or reopen admissions.

## 2. Manifest contract, version 1

Use UTF-8 JSON with duplicate keys rejected. The immutable `manifest.json` has
the following required fields; reject unknown schema versions and invalid types.

| Field | Required value / semantics |
| --- | --- |
| `schema_version` | Integer `1`. |
| `checkpoint_id` | Unique `dombi-fs-` identifier containing UTC capture time and a random suffix; never reused. |
| `historical_release_sha` | JSON `null`; unknown is explicit. |
| `root_identity` | Fixed account, absolute root, resolved root, document root, uid/gid, root mode, device/inode and trusted host-inventory reference. Paths must match the separately reviewed fixed policy. |
| `capture` | UTC `started_utc`/`completed_utc`, operator, authorization reference, publisher-lock identity, writer-drain and callback-containment evidence references. |
| `candidate` | Artifact ID, full application SHA and archive SHA-256 from section 1. These are deployment context, not baseline identity. |
| `boundaries` | Explicit `managed_scopes`, protected paths, shared ancestor directories, observed external targets and per-entry classification. No implicit catch-all deletion scope. |
| `inventory` | Map of every relative path, including dotfiles, untracked files, empty directories and root `.` to the entry contract below. |
| `archives` | Exact relative filename, byte count, SHA-256, purpose and included inventory subset for each archive. Code payload is mandatory; protected-state capture is separately authorized. |
| `recovery_contract` | Variant identifier, exact recovery-tool SHA-256, supported metadata policy and separate runtime/schema-compatibility evidence reference. |

Every inventory entry records `class` (`managed`, `protected` or `shared-parent`),
`type`, integer uid/gid, permission bits and nanosecond mtime. Regular files also
record byte count and SHA-256, except protected local database files and their
identified WAL/journal/sidecar files: these record `content_integrity: "not-verified"`,
`inventory_mode: "metadata-only"` and no content hash. Do not open or capture them;
content hashing or capture requires separate explicit authorization outside this
code-only contract. Metadata agreement never proves their content integrity.
Symlinks record the literal target and approved resolved boundary.
Device/inode/link count support capture-drift checks but are not restoration
targets; device/inode are mandatory for shared-parent identity comparison.
Reject unsupported special files, hardlinked regular
files, privileged mode bits, unclassified entries and unsupported ACLs/xattrs.
Probe ACLs explicitly with no-follow `getxattr` on `system.posix_acl_access` for
every entry and `system.posix_acl_default` for directories only. Treat only
`ENODATA`/`ENOATTR` as absent. Linux POSIX symlinks have no ACL of their own, so
`ENOTSUP`/`EOPNOTSUPP` from the `system.posix_acl_access` probe is non-applicable
only when no-follow entry classification verified a Linux symlink; never follow or
probe its target. For regular files, directories, other platforms, ACL defaults,
and every other error, fail closed. Reject a present ACL, `EPERM`/`EACCES`, a
missing ACL API and any unexpected error. Keep `listxattr` independently strict:
listed attributes and listing errors abort; an empty result does not establish ACL
absence. Do not claim full-tree ACL coverage from sampled paths. Symlink mode/mtime
support must be explicit.

Preserve managed-entry mtime as integer nanoseconds without rounding through
floating-point timestamps. Restore managed directory timestamps only after all
child operations. For shared parents affected by managed changes, compare type,
device/inode, uid/gid and mode; expected directory mtime changes are excluded
from recovery identity comparison and must not be reset. All other applicable
metadata protections remain in force.

The manifest does not contain its own digest. A separate approval pins SHA-256
of its exact bytes and checkpoint ID. The manifest pins each archive; no circular
digest or reliance on a mutable checksum file inside the same archive.
The recovery-tool digest is pinned in the manifest and approval. Any tool change
that changes `tool_digest()` invalidates approvals and checkpoints pinned to the
previous digest; do not migrate or silently repin existing records.
All manifests, protected-file hashes and receipts remain private: no environment
values, keys, payloads or raw process commands in shared output.

## 3. Coverage and boundaries

| Class | Coverage and handling |
| --- | --- |
| Managed code | Existing application/framework entrypoints, application code, routes, configuration source, views, `vendor`, dependency locks and all release-owned public assets. Include existing local custom/untracked code. Missing release markers stay missing; never create an old SHA marker. |
| Protected configuration | All `.env*`, private keys and other identified credential-bearing files, regardless of filename. Inventory privately; never overwrite, delete or print their contents during code recovery. |
| Protected persistent state | Entire `storage/`, uploads at every identified location, session/log/application-cache files, local database files and their identified sidecars, `.git` and `node_modules` if present, and other operator-owned nonrelease state. Database files/sidecars are metadata-only under section 2: no content read, hash, capture or integrity claim without separate authorization. |
| Protected generated caches | `bootstrap/cache` contents and compiled views in storage. Preserve current bytes. If publication changes these, a separate reviewed cache-restoration/regeneration plan is required before deployment. |
| Protected links | Preserve `public/storage` and approved persistent/external links exactly. Do not follow them into an archive or deletion traversal. External data coverage needs its own approved reference. |
| Shared parents | Root and directories containing protected descendants. Validate type, device/inode, uid/gid and mode; do not remove, replace or chmod them during recovery. Exclude only expected directory mtime changes caused by managed operations; do not restore their timestamps. |

No Git tracking assumption is allowed. Every untracked entry must be classified;
an unknown entry blocks publication planning. Protected and managed leaf coverage
must not overlap. A deletion cannot target an ancestor of a protected entry.
Unknown external storage or unsupported metadata means HOLD, not exclusion by guess.

The code archive contains only managed payload and required parent structure.
Opaque secret/configuration and upload backups, when separately authorized, use
separate private payloads and checksums; code recovery never extracts them.
Code-only recoverability requires evidence these paths cannot be mutated by the
deployment and will remain intact. Without that guarantee or approved separate
coverage, the checkpoint is incomplete. It is not whole-server/disaster recovery.

## 4. Consistent capture and validation

Future capture requires explicit backup authorization and existing production-only
admission/callback containment, actual HTTP/queue/scheduler/manual-writer drain,
and exclusion of competing publishers. A lock alone or quiet queue is insufficient.
Keep these controls held throughout final inventory and capture.

1. Validate fixed host/account/root, private ancestors, no path substitution,
   supported metadata, hosting quota and capacity for capture, validation and recovery.
2. Use a fresh exclusive `0700` directory under
   `/home/u399215191/private-backups`; never overwrite a historical checkpoint.
   Files are operator-owned, regular, single-link `0600`; reject symlinked parents.
3. Inventory before capture. Archive only reviewed scopes without dereferencing
   links; reject unreadable/disappearing/changing entries. Capture is not allowed to
   repair permissions or mutate the application.
4. Compare inventory before and after capture, including metadata and required file
   hashes; database files/sidecars remain metadata-only, without content validation.
   Any drift invalidates the capture. A second matching scan is not a substitute
   for writer containment.
5. Validate compressed-stream integrity and every member against the manifest:
   canonical relative names, unique entries, exact coverage/types/content/modes,
   no absolute paths, `..`, escaping links, links into protected state or writes
   through symlink ancestors. Verify ownership and exact managed nanosecond mtime
   metadata before any extraction; reject unsupported precision or rounding.
6. Fsync payloads, manifest and private directory entries; finalize a separate
   immutable verification receipt. Partial capture is never a usable checkpoint.

No extraction or restore drill is required by this local task. Archive inspection
and applicable existing evidence must be reported honestly; they are not proof of
runtime adoption or a newly performed restore drill.

## 5. Separate recovery variant

Design a new, separately named tool; do not patch or invoke historical recovery.
Keep a fixed production policy, not arbitrary root/database overrides. Inputs:
checkpoint ID, pinned manifest SHA-256, separately pinned tool digest and a private
operation approval. Proposed confirmation:
`RECOVER <fixed-root> TO CHECKPOINT <checkpoint-id> <manifest-sha256>`.
This is deliberate confirmation, not authentication.

**Read-only inspection mode:** no lock-file creation, audit creation, extraction,
temporary directories, imports of application code or automatic follow-up action.
Return only redacted validation results and inventory digests.

**Execution preconditions:** validate private approval ownership, authenticity
under applicable policy and real required approvers. Approval issuance and effective
identity evidence must be no more than 15 minutes old, not future-dated; approval
must be unexpired and valid for at most 15 minutes. Bind fixed
identity, candidate, checkpoint, tool/archive digests, complete current damaged-state
inventory and current protected-state digest. Require fresh independently supported
effective runtime/database identity, unchanged compatible schema/data, writer drain,
safe DOKU hold, maintenance/admission control and no competing publication.
Do not infer these from `.env`, marker files or approval booleans. Existing
single-owner eligibility is not automatically extended to this variant.

Under the shared publisher lock, validate archives and approved current state,
stage payload privately, and persist a `0600` authorization/audit record before
the first code mutation. Recheck approval, identity, containment and state immediately
before mutation. Fail closed on any mismatch or audit persistence failure.

Use exclusive private staging outside the application root on the same filesystem
as the managed destinations; validate device identity before mutation and fail
closed rather than fall back to cross-filesystem copying. The minimal variant must
keep temporary payloads, journals and audit files outside all managed/protected
application paths, including during interruption.

If in-root temporary files prove unavoidable, STOP before mutation for a separately
reviewed and authorized exception. Before creation, durably journal the exact
reserved path, operation ID, checkpoint and intended type/content identity; bind
the actual device/inode after exclusive no-follow creation and before use.
An interrupted creation with incomplete identity evidence stays UNKNOWN.
No unjournaled in-root temporary path is permitted, and no temporary file may be
placed in protected paths. Cleanup or continuation requires separate fresh approval
bound to the journal and observed file identities; never delete by filename prefix.

Restore managed files with no-follow path validation, verified private staging,
same-filesystem atomic replacement per file, fsync and supported metadata restoration.
Per-file atomicity is not whole-release atomicity: admissions remain held.
Remove new candidate-only paths solely within approved managed scopes, bound to
the fresh approved damaged-state inventory. Reject new unknown files or protected
descendants; never perform broad root deletion. Do not replace the real application
directory with a symlink or change the vhost/document root.

## 6. Interruption and completion

- Persist operation ID, approval/manifest/tool digests, pre-state and mutation
progress privately. No complete outcome means **UNKNOWN / keep held**.
- On interruption, do not automatically resume, reopen, reverse a journal or reuse
  approval. Reinspect full damaged state and obtain a fresh bounded approval;
  partial prior recovery must be a supported input to the same pinned checkpoint.
  Account for external staging and any separately authorized in-root temporary paths
  against their durable journals. Unknown or incomplete identities block cleanup
  and continuation; a matching filename or prefix is never ownership evidence.
- Verification requires exact managed path set, types, hashes, sizes, ownership,
  modes, nanosecond mtime and link targets under the declared metadata policy.
  Restore managed directory timestamps after child operations and verify them last.
- Protected inventory and shared-parent identity must match **immediately before
  recovery**, not an old capture that predates legitimate business activity.
  Apply section 2's metadata-only rule to database files/sidecars, without claiming
  content integrity. For shared parents affected by managed changes, compare type,
  device/inode, uid/gid and mode, excluding expected directory mtime changes.
  Any other observed protected-state or shared-parent identity change fails
  verification; metadata-only coverage cannot detect database content changes.
- Success means `FILESYSTEM_CHECKPOINT_VERIFIED_KEEP_HELD`, not healthy production.
  Web-worker adoption, compatible generated caches, authorized acceptance and
  reopening remain separate. Never restore database state or reverse money here.

## 7. Authorization and review gates

| Authorization | Permitted scope; explicitly excluded |
| --- | --- |
| Current request | This local document only. No implementation, provisioning or execution. |
| Future implementation | Separate local variant and focused synthetic tests; no production access or automatic deployment. Test valid restore, rejection paths, unsafe archives/links, protected descendants, drift, partial recovery and audit failure. Not a new production restore drill. |
| Backup creation | Exact host/root, boundaries, secret-handling permission, private destination, capture window and containment actions. No deployment or recovery implied. |
| Tool provisioning | Reviewed tool digest and exclusive private filename/destination only. Not recovery authority. |
| Recovery execution | Exact checkpoint/digests, current damaged state, mutation scope, time limit and applicable genuine approvals. No persistent-state restore, PHP/cache operations, callback release or reopening. |
| Reopening | Separate explicit decision after filesystem, full worker adoption, scoped acceptance and DOKU accounting pass. Resume writers only in the approved order. |

Compatibility risks: historical tools are SHA-bound; managed/protected classification
and external targets are incomplete; cache compatibility, runtime identity,
production-only containment/adoption and capacity/quota remain unresolved.
Any required gate UNKNOWN means HOLD. The existing waivers are preserved.

Assessment: specification **READY FOR LOCAL IMPLEMENTATION**; executable recovery
readiness remains **UNKNOWN**. Implementation is not authorized by this document.
Next action: authorize only the bounded local implementation and synthetic
verification. No production operation follows automatically.
