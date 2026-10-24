# Dombi V1.0 production cutover and recovery

Status: PREPARATION ONLY / NO GO-LIVE authorization. Date: 23 October 2026 (Asia/Jakarta).

This document is an operator procedure, not permission to execute production writes. All
steps after the last-mile owner gate require a new explicit approval. Do not run the
old deployment workflow, `scripts/deploy.sh`, or a migration against the active database.

## Release identity and promotion

| Item | Identity / disposition |
| --- | --- |
| Repository | `leanderarya/dombi` |
| Approved staging source | `9f82f3338d5c619b99e50448ad2d8ad3ca480c16` |
| Main before preparation | `39cea6dee33f4ce31af5e3dff2efc124151d6c6b` |
| Merge base | `fb90cee21ce8d999bd7daef2bb5e088f8b06d365` |
| Main-only commit | PR #29 merge; its tree equals merge-base tree `9c594dc6fed6ace50315ba4e2a237ce5eecbcb81` |
| Release difference | 5 commits ahead, 1 behind; 43 changed paths before preparation |
| Promotion strategy | Release branch from approved staging SHA; merge main preserving both parents; no reset/cherry-pick/squash that discards main history |

The main-only commit adds ancestry, not a unique file change. A local non-fast-forward
merge completed without conflicts and with no application-tree changes. The 43 paths
cover canonical payment/fulfilment guards, offline-sale stock and financial snapshots,
settlement allocation/reconciliation and locking, customer banners, related UI and tests.
Two migrations are included in the application release: offline-sale financial snapshots
and settlement reconciliation issues. They are reported installed on the NEW database;
this is not permission to apply them to OLD production.

Compare the final candidate against the approved SHA: application, migrations, routes,
config and dependency locks must remain identical. Only the preparation workflow and
release documentation differ. Re-fetch/recompare remote main/develop immediately before
opening/updating a PR and before any future merge. Any new file change needs a fresh review.
Use a merge commit into main to retain ancestry. Never push/merge main in this task.

## Deployment hold: enforced scope and remaining gap

The existing workflow reset active code and uploaded assets before maintenance. It later
edited `.env`, installed dependencies, migrated the effective active connection and
unconditionally reopened the app on failure. `artisan down` alone does not stop cron,
queue workers, webhook delivery, requests already in flight or other entrypoints.

The prepared `.github/workflows/deploy.yml` replaces that entire remote mutation path
with quality checks and an asset artifact. It has no production environment, production
secret references, SSH/SCP, runtime changes, migration, maintenance or traffic switch.
Push-to-main and manual events only package once this reviewed revision exists on main.
Until then, REMOTE main still contains the old auto-deployment workflow. Old workflow
reruns can still execute their old instructions. No workflow dispatch/rerun is authorized.
Before a future merge, an owner must prevent old deployments/reruns via Actions controls
and confirm no deployment is in flight; do not assume the prepared local file protects
remote production now. GitHub environment protection must require an independent reviewer,
prevent self-review and disallow bypass where available. Verify actual repository settings.

There is deliberately no executable cutover job or boolean escape hatch in this PR.
A future deployment implementation must independently enforce the following checks before
any code update, asset upload, config write, Composer script or migration on a live path:

1. Bind an immutable reviewed source SHA, asset digest, expected OLD/NEW schema and user,
   expiry time and change ticket to the owner approval. Hold one deployment lock through
   verification, mutation and health checks. Serialize manual and automated releases.
2. Build outside the active directory with production secrets unavailable and no writers.
   Do not bootstrap candidate code against OLD production. Resolve effective Laravel config
   in the isolated candidate, including configuration cache and any DB URL overrides.
3. Verify database identity twice: direct PDO/MySQL using the private NEW-user credential,
   and effective candidate Laravel connection. Both must return NEW schema and authenticated
   NEW user from `SELECT DATABASE(), CURRENT_USER(), VERSION()`. Check host identity privately;
   never log credentials or password verifiers. Query denied access to OLD/staging schemas;
   fail closed on unexpected access, missing values, query errors or mismatch. Never use
   `SHOW GRANTS`. Do not point the active runtime at NEW just to obtain this proof.
4. An operator independent of the deployment author verifies every writer is stopped:
   customer/outlet/owner/API/CLI admission, workers and supervisors, cron (including this
   repo's scheduled `queue:work --stop-when-empty`), scheduler, outbox, reconciliation,
   expiry jobs, remittance/payout and incoming gateway callbacks. Record process/cron and
   ingress evidence, in-flight drain and two stable count/max-update snapshots. A checked
   box, a maintenance file, no visible queue job, or stable counts alone is insufficient.
   A healthy isolated callback receiver may spool raw events; it must not mutate either DB.
5. Bind independent evidence to this exact host/path/DB/SHA and short time window. Recheck
   immediately before each mutation boundary under the same lock; abort if writers resume,
   evidence expires or candidate changes. The independent reviewer cannot be the submitter.
6. On failure keep admissions/writers paused; preserve logs privately and require a recovery
   decision. Never run unconditional `artisan up`, automated rollback migrations, or clear
   shared cache files that could contain locks. Bootstrap/cache/storage for each release
   must be separate; shared customer uploads must be backed up and mapped deliberately.

These are prerequisites for the future cutover implementation and rehearsal, not a claim
that independent writer verification or repository protections were executed today.

## Baseline, archives and unresolved financial records

| Resource | Required handling |
| --- | --- |
| OLD `u399215191_app` | Continues serving DOKU Live; preserve code/config/data and callback history |
| NEW `u399215191_dombi_pr_1023` | Reported 164 migrations, zero business rows; no import or seed authorized |
| NEW user `u399215191_dombi_ap_1023` | Rotate via hPanel only; private credential mode 0600, directory 0700 |
| Staging | Keep sandbox-only and separate from historical production archive |
| Two historical `needs_review` attempts | Unresolved money, not disposable test data; finance decision required |
| One generated unpaid settlement | Liability/receivable requires reconciliation, not automatic deletion or payment |

Use three distinct stores: immutable OLD production archive, sandbox QA evidence, and NEW
opening business data. Never import staging dummy orders or copy the whole historical DB
into NEW as a shortcut. The owner must approve an opening-data scope: users/access recovery,
outlets, catalog/prices, stock quantities/cost basis, unpaid orders, refunds and outstanding
settlement balances. Every copied entity needs source ID mapping, reconciliation totals,
referential checks, an idempotent import/rehearsal and an independently reviewed report.
No importer or schema change is supplied by this preparation PR. Empty NEW DB is not a
usable business launch; bootstrap accounts/catalog/stock remain a separate controlled task.

For each of the two attempts, finance must privately record attempt/order/invoice ID,
amount/currency, gateway status and timestamp, actual bank/gateway evidence, refund or
fulfilment obligations, and responsible operator. Obtain authoritative gateway evidence
through an approved operation; do not mark paid, retry, refund, expire or delete to make
verification green. If unpaid/expired is proved, document the closure; if paid, reconcile
fulfilment/refund before closure. If still uncertain, retain the obligation on OLD and
block cutover unless a tested carry-forward/recovery route is explicitly approved.
IDs, invoices, customer data and raw gateway evidence belong in restricted evidence storage.

For the unpaid settlement, finance must reconcile source orders/offline sales, fees,
refunds, previous payments/allocations, direction of remittance and exact opening balance.
A generated record is not proof of a payable bank instruction. Choose and sign either
settlement on OLD before freeze, or a traceable opening obligation in NEW after a tested
import. Do not regenerate an overlapping period, mark it paid, or run payouts in both stores.
After the boundary, keep OLD archive immutable. Any later legacy money adjustment must use
an explicitly approved recovery ledger/process with evidence and mapping, not writes into
an archive or an unrelated NEW invoice.

## Old callbacks and redirects: hard gate

`routes/web.php` serves `/payment/doku/notify` and `/payment/doku/redirect` on the current
runtime. `DokuService::handleNormalizedWebhook` throws `canonical_attempt_missing` if an
invoice has no canonical attempt. The ingress stores a retryable receipt and returns 500.
An empty NEW DB therefore cannot receive unresolved OLD callbacks safely. Redirects also
write webhook logs and may initiate status synchronization; include both paths in the freeze.

Before switching, choose and rehearse one approved continuity strategy:

- Drain and reconcile all OLD invoices plus gateway retry/late-success exposure, backed by
  provider confirmation of retention/retry behavior; retain durable callback recovery after
  the switch. Elapsed payment expiry alone does not prove no late success/callback.
- Keep a separate legacy receiver and route by an authoritative OLD/NEW invoice registry.
  Preserve raw bytes, Client-Id, Request-Id, signature and timestamp headers; validate the
  provider signature and enforce Request-Id/body-digest idempotency. Unknown invoices are
  quarantined durably and alerted for review, never synthesized into NEW orders or silently
  acknowledged. A legacy receiver must write to a separately approved operational recovery
  store; the immutable archive remains read-only.

No such dispatcher/spool/registry is implemented by this PR. It is a blocking dependency
if callback exposure persists. Do not change the DOKU Back Office callback now. Do not route
using an unverified invoice prefix or rely on gateway retries alone. Replaying an old raw
signature after the configured 300-second freshness window is rejected; replay requires a
reviewed recovery mechanism, not weakened signature validation. Test same Request-Id/same
body, body conflict, invalid/expired signature, missing/unknown invoice, late success,
redirect and receiver outage with synthetic sandbox data. Never use live transactions.

Manual Retry DOKU Sandbox HTTP 400 remains the accepted V1 known issue; do not reopen it
as a release blocker. It is separate from OLD callback continuity and unresolved liabilities.

## Backup and restore proof

Known OLD SQL backup (reported from the preceding preparation):

- Path: `/home/u399215191/private-backups/dombi-prod/dombi-prod-u399215191_app-20261023T034748Z-919551b67a31.sql`
- SHA256: `5f1b8f908ac0add37630654bfcd45683a2ab557542e9e5993888e165d8e15c60`
- Isolated restore: NOT TESTED. A matching hash is not restore proof or a current RPO.

Before Go-Live approval, provision a disposable restore target with a user unable to access
OLD, NEW or staging. Independently verify that restriction before restore. Inspect dump
for `CREATE DATABASE`, `USE`, qualified schema names, DEFINER and executable statements;
restore only after target confinement is proved. Never use the existing `restore-drill.sh`
unchanged: it expects an encrypted ZIP, drops a configurable database and has credential
fallbacks unsuitable for this SQL backup. Do not run it against production.

Restore without outbound integrations, workers, scheduler or web access. Verify schema,
constraints, trigger behavior, table counts, representative order/payment/settlement
relations and totals, and read-only boot of the matching archived application. Record
checksum, start/end time, duration, restore target identity, all errors, comparison results
and achievable RTO/RPO. Keep uploads, application encryption key, release code/assets,
cron/worker definitions and relevant config backed up privately too. At the approved
freeze take and validate a fresh final backup; the earlier dump cannot include later writes.
Restore rehearsal and final backup require their own approved targets/actions.

## Last-mile owner gate (not approved by this document)

All must have dated evidence and a named executor plus independent verifier:

- [ ] Exact candidate SHA, final PR diff, checks and immutable assets reviewed; no new app/schema changes.
- [ ] Remote deployment hold and protections verified; no old job running or eligible for accidental rerun.
- [ ] Credential rotation verified with NEW identity and OLD/staging access denied; private storage permissions checked.
- [ ] Isolated restore succeeded; final backup plan, uploads/config/key recovery and RTO/RPO accepted.
- [ ] Opening-data mapping/import and bootstrap access rehearsed with totals and no staging contamination.
- [ ] Two `needs_review` attempts and unpaid settlement have signed resolutions or tested obligation carry-forward.
- [ ] OLD callbacks/redirects have a tested continuity/recovery route and approved retention period.
- [ ] Writer inventory, pause/resume procedures and independent proof rehearsed, including cron-spawned workers.
- [ ] Runtime DB identity checks, cache/storage separation and lock-bound mutation boundaries rehearsed.
- [ ] Rollback boundary, operational monitoring, escalation contacts and risk acceptance recorded.
- [ ] Dependency advisories assessed for shipped web/native/build paths; upgrades are a separate scoped decision.
- [ ] Owner explicitly approves Go-Live for the exact SHA, databases, window, approved financial actions and recovery plan.

Current decision: HOLD. Any unchecked item blocks the corresponding production action.
Approval to prepare/push a review branch or open a draft PR never approves merge or Go-Live.

## Approved-window execution sequence

Only after the gate above has separate explicit approval:

1. Confirm main/candidate SHA, protected workflow state and deployment lock; allocate a time
   window and record old runtime SHA, release paths and traffic/config rollback targets.
2. Stop new admissions, pause every writer and callback mutation; durably capture callbacks,
   drain in-flight work, independently verify the freeze, then create the final OLD backup.
3. Reconcile final deltas against opening-data plan and financial dispositions. Re-verify NEW
   identity/isolation and imported totals. Verify no pending migrations against the exact
   release; any unexpected migration stops the change for separate review, not auto-run.
4. Prepare candidate code/assets/config outside the active path; preserve encryption/session
   implications, uploads and separate cache/locks. Verify effective candidate config is NEW,
   production debug=false, DOKU Live and legacy writes=false without printing secrets.
5. While ingress/writers stay closed, switch the approved runtime/config/traffic atomically
   using the rehearsed hosting mechanism. No active-tree `git reset`. Re-verify effective
   DB/user and release SHA. Keep maintenance until checks succeed; failure invokes recovery.
6. Check `/up`, `/api/health`, owner access and read-only catalog/config/database health.
   Run `payments:verify-cutover` only once legitimate approved canonical attempts exist;
   empty NEW DB fails by design. Never insert a fake/live payment just to obtain READY.
   First real payment validation requires separate explicit Live transaction authorization.
7. Confirm callback continuity, release admissions in the approved order, then enable only
   approved NEW workers/scheduler. Keep OLD writers disabled. Monitor errors, callback
   backlog/deduplication, outbox/queue lag, stock movement and settlement/refund totals.
8. Record the first NEW write and first external side effect precisely. Reconcile after
   15/30/60 minutes and the next business day; keep the legacy callback recovery route until
   provider exposure and finance obligations are explicitly signed closed. Archive sign-off
   never deletes financial history or satisfies retention by itself.

## Rollback and roll-forward decision table

| Boundary | Action | Prohibited shortcut |
| --- | --- | --- |
| Before traffic switch / NEW writes | Abort, discard inactive candidate, retain OLD runtime; restore old admissions only after checking captured callbacks/in-flight state | Migrate OLD or restore over its current data |
| Switched but no NEW write or external side effect | Freeze again, prove absence of NEW writes (including sessions/jobs/callbacks), revert traffic/config to exact OLD release, replay captured events via approved recovery, verify before resuming OLD | Assume no writes because no customer order exists |
| Any NEW write, accepted payment, notification, stock change or payout | Pause affected writers; preserve NEW and OLD snapshots plus gateway/callback evidence. Default to roll-forward on NEW under reviewed repair; reconcile every external side effect | Point old code at NEW schema, drop/reimport NEW, rollback migrations, or reopen OLD to sell concurrently |
| Catastrophic NEW failure after writes | Incident lead and owner choose a reviewed reverse-data reconciliation or isolated restore plus forward journal replay; independently prove financial/stock totals before reopening | Blind traffic rollback that loses/duplicates NEW transactions |

Monitor RPO from the last validated backup and durable event journal, not an assumed zero.
Escalate if DB identity changes, unknown/late callbacks accumulate, duplicate fulfilment,
negative stock or allocation/totals diverge. Keep affected flows closed until an authorized
recovery decision; unrelated emergency fixes do not inherit Go-Live authority.
