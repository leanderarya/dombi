# V1.0 production cutover — authorization envelope

Status: **draft for owner decision.** Nothing here has been executed. No host was
contacted, no key/lock/approval exists, and the production door remains
unprovisioned and unreachable.

## Boundaries

| Fact | Value |
| --- | --- |
| Verified staging candidate | `220a0190ec57c8ed64f5792dcaa10c7ca906f2b7` |
| Staging acceptance | run `44044616407-1` PASS, receipt `14310493554` |
| Production source (for reference) | `334637a9e8cd2ba639c557e4be80d4a19fdfc92d` |
| Production host | `app.dombicenter.com`, single account `u399215191` |
| Existing data | Preserved: existing DB, `storage/`, `.env`. No migration, no seeding, no SQL. |
| Customer checkout | **HELD** before, during and after the window until an explicit reopen decision. |
| Publisher state | Production realm implemented, **unprovisioned**: no key, no lock, no approval, no pin. |

Staging is out of scope. Nothing in this envelope authorizes any staging change.

## What the tooling now enforces (locally tested)

1. Rollback metadata (`rollback.json`) is written and digest-verified **before** any
   code replacement, binding checkpoint, artifact/release identity, pre-state and
   plan; completion outcomes pin its digest.
2. Production publication requires a `cutover` attestation that is structurally
   complete, non-destructive and honestly labelled `declared-not-verified`. A claim
   of verification, a global-maintenance step, a migrate/db-wipe command, an
   admission-coupled callback gate, or a stale/wrong procedure pin refuses the door.
3. Candidate identity, checkpoint archive integrity, checkpoint tool identity, and
   the presence of every protected path are re-proved immediately before mutation.
4. DOKU callback routes are statically asserted to carry no admission middleware,
   and admission middleware is asserted to remain per-route only.
5. An interrupted or failed publication journals `FAILED_OR_INTERRUPTED_KEEP_HELD`
   and never records success.

Not enforced, because it cannot be observed locally: that callbacks actually land,
that workers actually adopted the new code, and that `.env`/DB/storage are intact
after the fact. Those are host facts and remain operator/owner responsibility.

## Host command allowlist (the only commands in the window)

| Purpose | Command |
| --- | --- |
| Hold admission | edit `ADMISSION_CUSTOMER_CHECKOUT=held`, then `php artisan config:cache` |
| Prove callbacks ungated | `php artisan route:list --path=payment/doku` |
| Publish code | `python3 scripts/recovery/code_publisher.py publish --production --checkpoint … --manifest-sha256 … --approval … --archive … --checksum … --signature … --approval-key …` |
| Warm caches | `php artisan config:cache`, `php artisan route:cache`, `php artisan view:cache` |
| Adopt workers | `php artisan queue:restart` |
| Health | `GET /up`, `GET /api/health` |
| Reopen | edit `ADMISSION_CUSTOMER_CHECKOUT=active`, then `php artisan config:cache` |
| Rollback | `python3 scripts/recovery/filesystem_checkpoint.py recover --checkpoint … --manifest-sha256 … --approval … --confirm "RECOVER …"` |

Explicitly forbidden: `php artisan down`/`up` as a cutover tool, `migrate*`,
`db:wipe`, `migrate:fresh`, seeding, ad-hoc SQL, cron edits, editing `.env` beyond
the single admission flag, any write to `storage/` or the database.

## Sequence

1. **Capture** a verified checkpoint of current production code under the shared
   lock. The manifest must be recent (inside the approval window) and its archive
   digest recorded.
2. **Approve.** An independent verifier signs one approval covering checkpoint id +
   manifest digest, candidate application SHA, artifact archive digest, and a
   `cutover` attestation whose `procedure.sha256` equals the reviewed copy of
   `docs/CUTOVER_CALLBACK_WORKER.md` placed in the private directory.
3. **Hold admission** (reversible, per-route; callbacks stay open).
4. **Publish** through the production door. Expect `CODE_PUBLISH_COMPLETE_KEEP_HELD`.
5. **Warm caches, adopt workers** (`queue:restart`), confirm every worker start time
   is after the publication.
6. **Verify** health, one replayed/already-initiated DOKU callback persists, `.env`
   (apart from the admission flag), `storage/` and the DB are unchanged.
7. **Reopen** only on an explicit decision.

## Rollback prerequisites

- The checkpoint manifest and `code.tar.gz` are intact for the checkpoint id.
- The `rollback.json` of the publication operation is present and unedited.
- A separate recovery approval exists (recovery is a different operation, not
  auto-run by the publisher).
- Workers are drained and admission stays held across the recovery.
- Recovery restores managed code only; `.env`, `storage/`, DB and the storage link
  are explicitly preserved. It is not a data rollback.

## Accepted risks

| Risk | Mitigation | Residual |
| --- | --- | --- |
| Callback continuity is declared, not proven | static route test + procedure step 2 evidence | host-dependent |
| Worker adoption is declared, not proven | procedure step 5 start-time check | host-dependent |
| `rollback.json` could be edited after publication | digest bound into outcome and validated on next lineage read | a root-level actor can rewrite both |
| HMAC approval authenticates a key, not a person | independent verifier field + external review | no non-repudiation |
| A pre-existing publication operation without `rollback.json` blocks all later publications | fail-closed by design; resolve by remediation approval | intentional |

## STOP conditions

- Any DOKU callback fails to persist, or either `/payment/doku/*` route becomes
  gated.
- A worker is still running the old release after adoption.
- Checkpoint manifest/archive digest mismatch, or a missing protected path.
- `.env` (beyond the admission flag), database or `storage/` changes unexpectedly.
- Publication reports anything other than `CODE_PUBLISH_COMPLETE_KEEP_HELD`, or a
  prior operation is unfinished.
- Any need for a schema change, seeding, or `artisan down`.

## Owner decisions required before any execution

1. **Provisioning** (owner/credentials): create the `0600` publisher lock, generate
   and store the HMAC approval key outside the app root and `private-backups`,
   define rotation, and place the reviewed procedure copy in the private directory.
2. **Authority** (owner/approval): name the independent verifier and the exact
   approval record; confirm that a symmetric key is acceptable or require an
   asymmetric pin.
3. **Window** (owner): authorize the maintenance window and the worker supervisor
   restart, and confirm the reopen decision owner.

Recommended default: authorize provisioning and the callback/worker procedure
together, keep checkout HELD, and treat this envelope as the only permitted
command set for the window.
