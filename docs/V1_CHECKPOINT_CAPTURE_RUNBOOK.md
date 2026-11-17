# V1.0 old-code checkpoint capture — execution runbook

Status: **PREPARED / NOT AUTHORIZED.** This document describes one future capture.
Nothing here has been executed against production. No capture, approval, signature,
publication, deployment or rollback is authorized by this file.

Scope: one **read-only-of-application-state** capture of the live code tree into a
verified checkpoint under the fixed production policy.

## 1. What is being captured, and what is not

| Identity | Value | Meaning |
| --- | --- | --- |
| Release candidate (`CANDIDATE`) | artifact `14305937487`, app `220a0190…6f2b7`, archive `f48b68fb…98fd` | Deployment context: which accepted artifact this tooling is reviewed against |
| Old-code baseline (`historical_release_sha`) | JSON `null` | Explicitly unknown. The baseline **is** the captured inventory of the live tree |
| Checkpoint id | `dombi-fs-<UTC>-<32 hex>` | Unique, never reused |

The repin moves only the candidate. The old-code baseline is never repinned to the
release SHA: a rollback must restore code that actually ran in production, not the
code being deployed.

### Captured

- Managed code scopes only: `app`, `artisan`, `composer.json`, `composer.lock`,
  `public`, `bootstrap/app.php`, `bootstrap/providers.php`, `config`, `vendor`, and
  managed symlinks/directories inside them.
- Every entry's type, uid, gid, mode, nanosecond mtime, device, inode, nlink, and
  class (`managed`, `protected`, `shared-parent`).

### Explicitly not captured, not hashed, not restored

`database/`, `storage/` payload, `.env*`, `public/storage` target contents, caches.
The database is recorded metadata-only; its contents are never opened, hashed,
archived or restored.

## 2. Prerequisites (all must already be true)

1. This pin-alignment change is merged and reviewed; `scripts/recovery/filesystem_checkpoint.py`
   has a known digest (see §6 — it changed, so host re-provisioning is required).
2. Host tool at `private-backups/filesystem_checkpoint.py` matches that digest.
3. HMAC approval key exists at `private-secrets/dombi-code-publication-approval.key`
   (`0600`, 48 bytes) — already provisioned.
4. Advisory lock `private-backups/dombi-filesystem-publication.lock` exists (`0600`).
5. An **independent verifier** (not the executing operator) has reviewed this runbook
   and will sign the capture approval.
6. Owner has issued the explicit capture authorization in §7.

## 3. Exact command sequence

The tool's `inspect` mode is read-only and creates nothing. Run it first, always.

```bash
cd /home/u399215191/private-backups

# 3.1 Boundary and identity inspection. Read-only; writes nothing.
/usr/bin/python3 -B filesystem_checkpoint.py inspect \
  --checkpoint "<checkpoint_id>" --manifest-sha256 "<manifest_sha256>"
# (first capture: use plan mode against a capture approval instead, see 3.2)

# 3.2 Plan mode against the prepared capture approval. Read-only.
/usr/bin/python3 -B filesystem_checkpoint.py inspect --plan "<capture-approval.json>"
# Expect: {"root_identity": {...}, "observed_state_sha256": "<64 hex>"}

# 3.3 Capture. The only state-changing step. Requires the approval the
#     independent verifier signed, bound to exactly the state seen in 3.2.
/usr/bin/python3 -B filesystem_checkpoint.py capture \
  --approval "/home/u399215191/private-backups/<capture-approval.json>"
# Expect: {"checkpoint_id": "...", "manifest_sha256": "...", "status": "CHECKPOINT_VERIFIED"}
```

Capture refuses unless, under the shared lock: the observed inventory equals the
approval's `observed_state_sha256`, the approval has not expired, the approval's
`tool_sha256` equals the on-host tool digest, and the approval's `candidate` equals
the fixed `CANDIDATE`.

### Pre-capture checks the operator records (evidence, not assertions by the tool)

```bash
df -h /home/u399215191            # free space must exceed the preflight floor
du -sh /home/u399215191/domains/dombicenter.com/public_html/app/{app,config,vendor,public}
```

Capture preflight requires free space >
`3 × managed payload bytes + 4 × encoded-inventory bytes + 1 MiB`, else
`insufficient_space` and nothing is written.

## 4. Storage and quota safeguards

- The checkpoint lives under `private-backups/<checkpoint_id>/`, never in the app root.
- Preflight fails closed on insufficient space before any directory is created.
- The checkpoint id is unique per capture; a second capture never overwrites a first.
- Only one capture may run at a time: the shared `flock` is non-blocking and a busy
  lock raises `BlockingIOError` with nothing changed.
- `code.tar.gz` is the only payload archive; protected state is not duplicated.

## 5. Failure recovery

| Failure | Effect | Recovery |
| --- | --- | --- |
| `insufficient_space` | Nothing created | Free space, re-plan |
| `capture_drift` (tree changed after approval) | Nothing created | Re-plan, obtain a fresh approval |
| `approval_expired` / `approval_pin` | Nothing created | Fresh approval |
| `approval_tool_or_candidate` | Nothing created | Confirm host tool digest and candidate pin |
| Interrupted mid-capture | Checkpoint dir has no `verification.json` | Never a valid checkpoint; inspect refuses it. Remove only that exact directory after review |
| `publication_lock` busy | Nothing created | Wait; do not retry in a loop |

A capture never deletes or rewrites anything in the application root. Recovery from a
capture failure is purely local to `private-backups`.

## 6. Tool digest consequence (blocking prerequisite)

The pin alignment edits `filesystem_checkpoint.py`, so `tool_digest()` moves from
`edc305160fe9a298507a3e8538a92a426858e8a7b0439290692314138fc06933` to
`79004472163b60cc976202805982a25909d0868210f8ecd7fc4cd7ca7f74d255`
(recompute independently; do not trust this value).

The host currently carries the **old** digest. Therefore:

- a capture approval signed against the host tool would pin the old digest, and a
  manifest captured by the old tool would not match the reviewed source;
- the reviewed tool must be **re-provisioned** to `private-backups/filesystem_checkpoint.py`
  under a separate authorization before capture, exactly as the existing
  `provision_checkpoint_tool.py` procedure requires (no overwrite; the existing file
  needs an explicit operator decision because it already exists).

No existing checkpoint exists, so no approval or checkpoint is invalidated by the
digest change. If one did exist, it would remain bound to the old digest and must not
be migrated.

## 7. Independent verifier evidence

The verifier must independently record, not merely accept:

1. Host identity: account `u399215191`, root `/home/u399215191/domains/dombicenter.com/public_html/app`,
   real directories (no symlink ancestors), device agreement with `private-backups`.
2. On-host tool digest equals the reviewed source digest.
3. Approval key digest and `0600` single-link custody.
4. `observed_state_sha256` from plan mode, matching the approval.
5. Writer-drain evidence: admissions held, scheduler paused, workers drained (cron-driven),
   DOKU callbacks still able to land.
6. Schema-compatibility evidence reference and persistent-path preservation reference.
7. Free space above the preflight floor.
8. That `.env`, `database/` and `storage/` content are untouched by the capture.

## 8. STOP conditions

- Tool digest on host ≠ reviewed source digest.
- Any symlink in the root or private path; unexpected ownership or mode.
- Approval `candidate` ≠ fixed `CANDIDATE`, or approval expired.
- Observed state drifts between plan and capture.
- Free space below the preflight floor.
- Any attempt to capture `database/`, `.env` content, or storage payload.
- Any request to repin `historical_release_sha` to the release SHA.

## 9. Owner envelope (one future capture)

> Authorized: one checkpoint capture of the production code tree at
> `/home/u399215191/domains/dombicenter.com/public_html/app`, using the reviewed,
> re-provisioned `filesystem_checkpoint.py`, into
> `/home/u399215191/private-backups/<checkpoint_id>/`, preceded by read-only
> inspection and plan output, on the signed capture approval of a named independent
> verifier, with admissions HELD and no deployment, publication, rollback, migration,
> cache rebuild or worker restart.
>
> Not authorized: any publication, `code_publisher.py --production`, any rollback,
> any change to `.env`/database/storage/cron, any reopening of admissions, and any
> second capture.
