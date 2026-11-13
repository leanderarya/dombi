# PR #33: RC-preserving local integration

Date: 2026-11-13. Status: **validated integration; publication to PR #33 authorized**.
The subsequent publication task authorizes one focused commit and normal fast-forward
push to PR #33's existing branch for exact-head CI validation. It authorizes no merge,
release tag, deployment, settings change, credential rotation or production/staging
operation. The verification below records the preceding local preparation.

## Source selection

| Input | Frozen commit |
| --- | --- |
| `develop` inspected for this task | `9f82f3338d5c619b99e50448ad2d8ad3ca480c16` |
| PR #33 head before the integration commit | `2ec7635987dd16aa922ce7b571d20b695e1ab372` |
| Approved V1.0 RC source | `76ca5ca209c8fee2a500194c4ea6d9894ef2d051` |

The integration was prepared in an isolated worktree on
`ci/pr33-preserve-v1-rc-20261113`, based on PR #33. The integration commit, not the old
PR head above, represents this reconciled source. It is not a release acceptance or
an immutable artifact yet. Publication updates only the existing PR branch; the
original dirty checkout, other worktrees, pinned RC, private backups and existing
release evidence remain untouched.

The smallest source-safe resolution was a path-bounded, byte-for-byte RC carryover:
the 31 previously identified application/frontend paths, 12 related PHP test files,
the dedicated Owner seeder, and six guarded runner/test dependencies. No application
conflict resolution or refactor was needed because PR #33 changes infrastructure,
not those application files. One test-only protocol adjustment is described below.
Importing the entire RC would instead replace the new
CI/CD contract and introduce unrelated documentation/dependency changes.

## Preserved behavior

- DOKU `DMB1` invoice namespace and its redirect/webhook/reconciliation protections,
  strict redirect input handling and canonical-only order resolution.
- Retired Owner bootstrap command, guarded Owner recovery/provisioning code, session
  revocation safeguards and mandatory password-change protection on system status.
- Canonical/legacy refund queue selection, stale/fresh in-progress distinctions,
  destination filtering, Finance tab-specific data and refund pagination state.
- Persistent Owner layout, notification polling lifecycle/deduplication, active-tab
  visibility and tab-specific analytics/Finance loading behavior.
- Associated RC tests, including the dedicated disposable MariaDB Owner recovery
  tests. Test operations use synthetic accounts and disposable local databases only.

## Migration reconciliation

Restore exactly:

`database/migrations/2026_10_23_000001_create_owner_recovery_audit_logs_table.php`

Its filename and bytes are unchanged from the RC. SHA-256:
`8103ca5d734524fe450874b4051caa4fbf2f5a93ab4373434384cacd630a762a`.
The source inventory is again **165 migrations**, with exactly one audit migration.
This agrees with the restored readiness guard's existing pins; no guard was changed.

Earlier read-only staging evidence recorded this migration as already applied. Keeping
the original filename restores the source/ledger association: normal `migrate` skips
an already-recorded migration. No rename, replacement migration, table recreation,
`hasTable` bypass, rollback, reseed or direct staging data repair is introduced.

## CI/CD and artifact boundaries

All `.github/workflows/` and `scripts/ci/` files remain byte-identical to PR #33,
including immutable packaging, SHA/checksum/provenance checks, persistent-file
exclusions, staging opt-in, concurrency and the hard-coded production NO-GO.
Composer manifests/lockfile and npm manifests/lockfile are unchanged and match the RC.

Guarded Owner seeding/runner sources are retained for completeness and their tests;
the existing runtime artifact contract intentionally does not package database seeders
or private release/recovery scripts. No seeder, credential generator or recovery runner
is added to a deployment workflow. Their presence in source grants no execution rights.

The RC's unrelated `pnpm-lock.yaml` dependency-resolution churn is intentionally not
carried over: CI uses the unchanged `package-lock.json`. Historical RC production
cutover documentation is retained in its original pinned worktree, not substituted
for the new CI/CD contract or treated as permission to deploy this integration.

## Resulting source comparison

Of **1,175 RC-tracked files** under `app`, the two bootstrap entry files, `config`,
`routes`, `database`, `resources`, `tests` and `scripts/release`, **1,174 match** the
pinned RC byte-for-byte. All application, migration, seeder, frontend and guarded
runner code is identical to the RC. The sole additional source delta is in
`tests/Feature/OwnerRecoveryMariaDbTest.php`: its final Inertia GET now supplies
`X-Inertia-Version` using `Inertia::getVersion()`.

The original test passed without built assets but returned a correct protocol-level
409 after this integration's production build generated an asset version. The test
client now sends a valid matching version, like the browser client. No middleware,
asset-version validation, recovery guard, security assertion or application behavior
is disabled or changed. Generated assets/dependencies are verification outputs, not
part of this source equality claim.

Remaining differences versus the RC are intentional infrastructure/documentation
differences from PR #33, this local receipt, the test-only Inertia header adjustment,
and the unused pnpm lockfile resolution. They are not missing V1.0 application fixes.

## Verification

| Check | Result |
| --- | --- |
| Composer validation, platform checks and locked dependency installation | PASS |
| `php artisan test --testsuite Unit` | PASS: 130 tests, 326 assertions |
| Focused PHP Feature group, 15 files | PASS: 179 tests, 925 assertions |
| `php artisan test tests/Feature/OwnerRecoveryMariaDbTest.php` | PASS: 2 tests, 414 assertions, dedicated disposable MariaDB fixture |
| Fresh local migration and rerun with an existing audit row | PASS: row/table preserved; exactly one audit migration ledger entry |
| `npm test`, Node 22.22.2 / locked npm dependencies | PASS: 57 files, 282 tests |
| `npm run build` | PASS: production Vite build |
| `actionlint -shellcheck=` on the three CI/deployment workflows | PASS, actionlint 1.7.12 |
| `bash -n` on staging deployment and disposable Owner test launcher | PASS |
| `node --test scripts/ci/test-select-release.cjs` | PASS: 2 tests |
| `python3 -B -m unittest discover -s scripts/ci -p 'test_*.py' -v` | PASS: 16 executed; 2 Linux filesystem fixtures skipped on macOS |
| `php -l` on restored PHP sources | PASS: 28 files |
| RC source equality / CI and packaging equality / migration pin | PASS |

The first combined PHP run reached the tool's two-minute execution deadline during
the larger Feature group, after Unit passed. The rerun completed that group with a
longer deadline and persistent logs. The dedicated Owner recovery run then exposed
the built-asset version mismatch described above. After the test-client-only fix,
both Owner recovery cases passed with production assets still present. Total PHP
coverage executed successfully: **311 tests, 1,665 assertions**.

The 15-file Feature invocation comprised `BootstrapInitialOwnerTest`,
`DokuMarkPaidCommandTest`, `DokuPaymentTest`, `DokuReconciliationTest`,
`DokuWebhookIngressTest`, `OwnerRefundWorkspaceTest`, `PaymentProductionInvariantTest`,
`PaymentProductionMatrixTest`, `PaymentReliabilityTest`, `PaymentRetryTest`,
`SystemStatusAuthorizationTest`, `CanonicalPaymentVerifierTest`,
`CheckoutPaymentJsonResponseTest`, `PaymentAuthorizationMutationTest` and
`PaymentFulfilmentConcurrencyTest`, all under `tests/Feature/` and run sequentially
through `php artisan test`. Forking/concurrency cases used the disposable SQL server,
not SQLite or an existing database.

`php artisan migrate --force --no-interaction` initialized a separate local fixture
schema. A throwaway PHP probe inserted a synthetic audit row, invoked normal `migrate`
again, then verified unchanged row contents and one original audit ledger entry.
All disposable database instances were stopped and their datadirs/fixture schemas
removed, including the first interrupted run's directory. No staging DB was accessed.

The installed MariaDB 11.8.9 binary runs against a new private local datadir, loopback
port and schema-scoped fixture accounts. No existing database service is reused.
PHP is local 8.5.12; GitHub's configured PHP 8.3 + MySQL 8 execution for the eventual
new commit remains separate evidence. Credentials and temporary endpoints are not
published. External application HTTP transport is blocked during the PHP fixture run.

The two unchanged Linux filesystem tests already passed in PR #33's historical
GitHub run; that does not count as a new integration run. No artifact was labeled with
the old PR SHA from the dirty integration: the existing packer correctly rejects dirty
runtime source. PR CI validates the new exact head. A deployable immutable artifact
still requires a separately authorized merge and successful `develop` push CI.

## Merge readiness

**GO for publication and exact-head CI; NO-GO for merge or deployment under this
authorization.** Review these 50 source/test paths and this receipt, require passing
CI for the new exact head, then obtain separate merge authorization. Do not reuse the
old PR head's green status or label the reconciled source with its old SHA. Hosted CI
results belong to the new commit's checks and the publication receipt, not the earlier
local test results above.

The staging opt-in and every deployment/recovery authorization guard remain unchanged.
No staging fingerprint, permission, release acceptance or production-only blocker is
resolved or waived by this local integration. The pinned RC remains independently
available; no RC ref, backup, manifest or private tool was replaced or repinned.

## Changed paths versus PR #33

```text
app/Console/Commands/BootstrapInitialOwner.php
app/Console/Commands/RecoverOwnerPassword.php
app/Http/Controllers/DokuPaymentController.php
app/Http/Controllers/Owner/FinanceSettlementController.php
app/Models/Order.php
app/Services/DokuService.php
app/Services/DokuWebhookIngressService.php
app/Services/ProductionOwnerProvisioner.php
bootstrap/app.php
database/migrations/2026_10_23_000001_create_owner_recovery_audit_logs_table.php
database/seeders/ProductionOwnerSeeder.php
resources/js/components/owner/owner-page-shell.test.tsx
resources/js/components/owner/owner-page-shell.tsx
resources/js/components/owner/owner-segmented-tabs.test.tsx
resources/js/components/owner/owner-segmented-tabs.tsx
resources/js/components/shared/notification-bell.test.tsx
resources/js/components/shared/notification-bell.tsx
resources/js/internal-app.tsx
resources/js/layouts/owner-layout.test.tsx
resources/js/layouts/owner-layout.tsx
resources/js/lib/owner-page-layout.test.ts
resources/js/lib/owner-page-layout.ts
resources/js/pages/owner/analytics/audit-tab.tsx
resources/js/pages/owner/analytics/dashboard-tab.tsx
resources/js/pages/owner/analytics/index.tsx
resources/js/pages/owner/analytics/loading-skeletons.test.tsx
resources/js/pages/owner/analytics/loading-skeletons.tsx
resources/js/pages/owner/analytics/masalah-tab.tsx
resources/js/pages/owner/finance/index.test.tsx
resources/js/pages/owner/finance/index.tsx
resources/js/pages/owner/finance/refund-tab.test.tsx
routes/web.php
scripts/release/OwnerBootstrapReadiness.php
scripts/release/owner-bootstrap-runner.php
scripts/release/run-owner-bootstrap-disposable-test.sh
scripts/release/test-owner-bootstrap-disposable.php
scripts/release/test-owner-bootstrap-runner-driver.py
scripts/release/test-owner-seeder-worker.php
tests/Feature/BootstrapInitialOwnerTest.php
tests/Feature/DokuMarkPaidCommandTest.php
tests/Feature/DokuPaymentTest.php
tests/Feature/DokuReconciliationTest.php
tests/Feature/DokuWebhookIngressTest.php
tests/Feature/OwnerRecoveryMariaDbTest.php
tests/Feature/OwnerRefundWorkspaceTest.php
tests/Feature/PaymentProductionInvariantTest.php
tests/Feature/PaymentProductionMatrixTest.php
tests/Feature/PaymentReliabilityTest.php
tests/Feature/PaymentRetryTest.php
tests/Feature/SystemStatusAuthorizationTest.php
docs/PR33_RC_INTEGRATION.md
```
