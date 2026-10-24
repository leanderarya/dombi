# Production preparation evidence — 23 October 2026

Status: PARTIAL release preparation; NO GO-LIVE. Repository `leanderarya/dombi`.
All local work is in the independent `release-prep` clone on
`release/v1-preparation-20261023`. The original Herd checkout was not used.
No commit, push, PR creation, workflow dispatch/rerun, production deployment, migration,
seed, import or business write was performed. The authorized NEW-user password rotation
and its private credential update are the only remote mutations in this preparation.

## Observed identities and state

- Remote compare: main `39cea6dee33f4ce31af5e3dff2efc124151d6c6b`, develop
  `9f82f3338d5c619b99e50448ad2d8ad3ca480c16`; diverged, 5 ahead/1 behind,
  43 changed paths. Main-only PR #29 merge tree equals merge-base tree.
- Local `git merge --no-commit --no-ff origin/main`: no conflicts, no application
  changes. Merge remains intentionally uncommitted pending commit/push authorization.
- Candidate application/routes/config/migrations/resources/tests/dependency files match
  the approved staging source. Preparation changes are workflow and documents only.
- hPanel selected the row for `u399215191_dombi_pr_1023` /
  `u399215191_dombi_ap_1023`. A first long candidate was rejected (HTTP 422);
  a shorter cryptographically random candidate succeeded (HTTP 204 and success notice).
  No password or verifier was printed. The staged candidate authenticated as NEW user
  to NEW DB before an atomic replacement of the private credential file; no staged
  credential remains after successful replacement. No local secret file was created.
- Private credential: `/home/u399215191/private-secrets/dombi-v1-production-db-20261023.cnf`;
  directory 0700, file 0600, outside public web storage.
- Read-only effective Laravel connection AFTER rotation: production env, OLD DB/user
  `u399215191_app`, DOKU sandbox=false. Exactly 2 `needs_review` attempts and 1 generated
  settlement with paid_amount=0. No financial record was changed.
- Direct NEW-user PDO connection AFTER rotation: NEW schema/user match, 164 migration
  records, 67 base tables; every business table checked with exact COUNT and all empty.
  SELECT against OLD and staging migration tables denied with database privilege errors.
- Active production code HEAD still equals main `39cea6dee33f4ce31af5e3dff2efc124151d6c6b`.
  A separate effective staging bootstrap confirms staging DB, env=staging and sandbox=true.
- OLD backup SHA256 matches the supplied checksum. Isolated restore was not executed.
- Staging QA/payment/checkout/pickup/inventory/settlement PASS and the Manual Retry HTTP
  400 acceptance are supplied release evidence from the user, not rerun in this task.

## Remote deployment protection (read-only GitHub API)

`deploy.yml` is still ACTIVE remotely with name `Deploy Production`. The latest five
main deployment runs returned completed/success; no deploy was triggered here.
Main is protected. Production environment has a required reviewer, but self-review is
allowed (`prevent_self_review=false`), admin bypass is allowed, and there is no deployment
branch policy. This is not an independent approval gate. Settings were not changed.
The prepared workflow's hold is LOCAL until separately authorized and promoted.
Old workflow reruns must be prevented before a future main merge. Never merge this task.

## Verification actually executed

| Check | Observed result |
| --- | --- |
| `git merge --no-commit --no-ff origin/main` | PASS, no conflicts; pending merge retained |
| `git diff --quiet origin/develop -- app database resources tests routes config bootstrap composer.json composer.lock package.json package-lock.json` | PASS, approved application source unchanged |
| `git diff --check` | PASS |
| `APP_ENV=testing composer install --no-interaction --prefer-dist` | PASS, locked dependencies installed in isolated clone |
| `npm ci` | PASS, lock unchanged |
| `APP_ENV=testing DOKU_IS_SANDBOX=true npm run build` | PASS, 3281 modules transformed, manifest generated |
| `composer lint:check` | PASS |
| `npm run lint:check` | PASS, 0 errors; 2 existing React effect dependency warnings |
| `npm run format:check` | PASS |
| `npm run types:check` | PASS |
| `npm test` | PASS, 53 files / 261 tests |
| Focused PHPUnit: PhoneNormalizer, PaymentMethod, OrderTimingConfig, WebhookSecurity | PASS, 25 tests / 51 assertions with explicit dummy sandbox client/key |
| Python YAML parse + structural job/action/permission checks + `bash -n` for each run block | PASS, no production environment/secrets or remote mutation steps |
| SSH/PDO NEW identity + privilege-denial checks + exact business table counts | PASS after rotation |
| Effective OLD Laravel identity + financial aggregate counts | PASS, OLD / Live remains configured |
| SHA256 of supplied OLD backup | MATCH; restore remains UNTESTED |

The first focused PHPUnit invocation failed 3 WebhookSecurity tests because a clean clone
had no DOKU client/key configured (`refreshKeysForTest(): Argument #1 ... null given`).
Repeating the same 25 tests with explicit non-secret dummy sandbox values passed; source
was not modified to hide the setup error. No database migrations or DB feature suites
were run. Local runtime is PHP 8.5.9 / Node 26.7.0; CI is configured for PHP 8.3 / Node 22.
Exact hosted CI, full MySQL concurrency/feature tests and artifact upload remain unexecuted
for this uncommitted candidate. No claim of fresh production E2E or independent pause proof.

## Material findings and priced decisions

| What | Size | Blast radius | Status / next decision |
| --- | --- | --- | --- |
| OLD callback routed to empty NEW raises canonical_attempt_missing | M/L: receiver/routing + registry/recovery tests | Live payment callbacks, historical money | Blocking Go-Live if exposure persists; choose drain or separate recovery receiver and authorize implementation |
| Backup restore not rehearsed | M: confined target and evidence | Recovery, RPO/RTO | Blocking Go-Live; authorize disposable restore target and drill |
| NEW has no opening business data | M/L depending approved scope | Identity/catalog/stock/financial opening balances | Blocking business launch; owner defines mapping and separately authorizes tested import/bootstrap |
| Independent reviewer and writer/identity enforcement absent | M: hosting controls, guarded cutover runner, rehearsal | All production writes | Blocking cutover; preparation removes deploy capability rather than adding an unchecked bypass |
| Existing npm advisories | M investigation; upgrade size depends dependency graph | Native app, developer/build tools, possibly bundled code | Non-blocking preparation; Go-Live risk assessment/acceptance required, no silent dependency update |

`npm ci` reported 31 advisories in all dependencies (4 critical, 19 high, 7 moderate,
1 low). `npm audit --omit=dev --json` reported 13 (3 critical, 8 high, 1 moderate,
1 low). This lock classifies build tools as production dependencies, so that count is
not proof every advisory is exploitable in the deployed web app. Critical paths include
`@capacitor/android`, `concurrently` via `shell-quote`; Vite and other build/transitive
packages have high advisories. Examples: GHSA-rvm3-566m-v7fv and GHSA-w7jw-789q-3m8p.
Native/web/build exposure needs explicit triage, outside this workflow-only change.

The runbook in `docs/PRODUCTION-CUTOVER-V1.md` provides owner gates, callback continuity,
financial dispositions, archive separation and rollback/roll-forward decision boundaries.
The preparation workflow is fail-closed for deployment: no operation reaches the server.
It does not claim to implement the future writer pause or traffic-switch mechanism.
