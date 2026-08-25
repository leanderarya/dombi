# Canonical Payment Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make payment/refund runtime canonical-only, verify staging safely, then remove legacy transaction data from staging only.

**Architecture:** `PaymentAttempt` owns runtime payment state and `RefundObligation` owns runtime refund state. Legacy tables/models/migrations remain for audit and rollback, but runtime paths no longer read or write them. A canonical verifier and guarded staging cleanup command enforce the boundary.

**Tech Stack:** Laravel 13, PHP 8.3, MySQL, PHPUnit/Pest project tests, Artisan, GitHub Actions, Hostinger SSH.

## Global Constraints

- Staging is the only database target for cleanup.
- Production data and production schema are not touched.
- Legacy schema, models, and migrations remain in repository.
- `PaymentAttempt` is the runtime payment source of truth.
- `RefundObligation` is the runtime refund source of truth.
- `PAYMENTS_LEGACY_WRITES_ENABLED` must resolve to `false`.
- `PAYMENT_CUTOVER_AT` is not required by canonical verification.
- Destructive cleanup requires `APP_ENV=staging`, matching staging database identity, and explicit `--confirm-staging`.
- Do not add dependencies.

---

### Task 1: Add failing canonical-runtime tests

**Files:**
- Modify: `tests/Feature/DokuPaymentTest.php`
- Modify: `tests/Feature/PaymentProductionInvariantTest.php`
- Create or modify: `tests/Feature/CanonicalPaymentVerifierTest.php`

**Interfaces:**
- Tests establish expected behavior for `DokuService`, `VerifyPaymentCutover`, and canonical payment data.

- [ ] **Step 1: Write tests proving checkout does not create legacy rows, webhook/status sync operate from `PaymentAttempt`, and verifier works without `PAYMENT_CUTOVER_AT`.**

Use existing factories/fixtures and assert `payment_attempts` changes while `payment_transactions` remains empty. Set config `doku.payment_cutover_at` to `null`; assert canonical verifier succeeds when canonical data is valid and legacy writes are disabled.

- [ ] **Step 2: Run targeted tests and verify expected failures.**

Run:
```bash
php artisan test tests/Feature/DokuPaymentTest.php tests/Feature/PaymentProductionInvariantTest.php tests/Feature/CanonicalPaymentVerifierTest.php
```
Expected: failures identify legacy runtime dependency or missing canonical verifier behavior.

- [ ] **Step 3: Commit tests only.**

```bash
git add tests/Feature/DokuPaymentTest.php tests/Feature/PaymentProductionInvariantTest.php tests/Feature/CanonicalPaymentVerifierTest.php
git commit -m "test: define canonical payment runtime"
```

---

### Task 2: Remove legacy payment runtime dependency

**Files:**
- Modify: `app/Services/DokuService.php`
- Modify: `config/doku.php` only if obsolete runtime flags need removal
- Test: targeted tests from Task 1

**Interfaces:**
- Existing public DOKU methods retain signatures.
- Checkout persists only `PaymentAttempt`.
- Webhook resolves by `PaymentAttempt::invoice_number` and rejects missing canonical attempt with webhook evidence.
- Status sync applies transitions through `CanonicalPaymentTransitionService`.

- [ ] **Step 1: Remove the `PaymentTransaction::firstOrCreate` write branch from checkout.**

Keep legacy model imports only where maintenance commands need them; remove unused `DokuService` import and references.

- [ ] **Step 2: Remove webhook lookup/warning paths based on `PaymentTransaction`.**

Keep the existing canonical mismatch and `canonical_attempt_missing` logging behavior. Do not fall back to order payment fields for canonical webhook processing.

- [ ] **Step 3: Keep late-payment handling canonical.**

Ensure `markOrderPaid` and refund initiation operate from the supplied `PaymentAttempt` and `RefundObligation` flow; do not load `paymentTransactions`.

- [ ] **Step 4: Run targeted tests.**

```bash
php artisan test tests/Feature/DokuPaymentTest.php tests/Feature/PaymentProductionInvariantTest.php tests/Feature/PaymentRetryTest.php
```
Expected: PASS.

- [ ] **Step 5: Commit runtime change.**

```bash
git add app/Services/DokuService.php config/doku.php
git commit -m "refactor: make doku runtime canonical"
```

---

### Task 3: Replace cutover parity verifier with canonical verifier

**Files:**
- Modify: `app/Console/Commands/VerifyPaymentCutover.php`
- Modify: `tests/Feature/CanonicalPaymentVerifierTest.php`
- Search-only review: `app/Console/Commands/BackfillPaymentAttempts.php`

**Interfaces:**
- Artisan command remains `payments:verify-cutover` for operational compatibility.
- Command checks disabled legacy writes, valid `PaymentAttempt` ownership/state, and valid `RefundObligation` references.
- Command never queries `PaymentTransaction` and never requires `PAYMENT_CUTOVER_AT`.

- [ ] **Step 1: Extend failing tests for invalid attempt/order/refund-obligation state and missing legacy config evidence.**

- [ ] **Step 2: Run verifier tests and confirm failures.**

```bash
php artisan test tests/Feature/CanonicalPaymentVerifierTest.php
```

- [ ] **Step 3: Implement canonical checks with actionable errors.**

Accept `PAYMENTS_LEGACY_WRITES_DEPLOYMENT_EVIDENCE=false` when present; do not make cutover timestamp mandatory. Preserve nonzero exit on invalid state.

- [ ] **Step 4: Run verifier tests and command manually.**

```bash
php artisan test tests/Feature/CanonicalPaymentVerifierTest.php
php artisan payments:verify-cutover
```
Expected: PASS and `READY` output on canonical fixture/database.

- [ ] **Step 5: Commit verifier change.**

```bash
git add app/Console/Commands/VerifyPaymentCutover.php tests/Feature/CanonicalPaymentVerifierTest.php
git commit -m "refactor: verify canonical payment state"
```

---

### Task 4: Add guarded staging legacy-data cleanup command

**Files:**
- Create: `app/Console/Commands/CleanupStagingLegacyPayments.php`
- Create: `tests/Feature/CleanupStagingLegacyPaymentsTest.php`
- Modify: `routes/console.php` or command registration only if project requires explicit registration

**Interfaces:**
- Command: `payments:cleanup-staging-legacy --confirm-staging`
- Refuses unless `app()->environment('staging')` is true.
- Refuses unless configured MySQL database name matches staging identity, defaulting to a configured exact name rather than a loose production-like pattern.
- Without confirmation, prints refusal and performs no writes.
- With confirmation, prints counts, deletes legacy transaction rows and explicitly approved legacy order payment fields, never drops tables.

- [ ] **Step 1: Write tests for refusal in testing/production, refusal without confirmation, and successful deletion in staging.**

Use database transactions/refresh database fixtures. Assert schema remains and canonical `payment_attempts`/`refund_obligations` remain.

- [ ] **Step 2: Run cleanup tests and verify failures.**

```bash
php artisan test tests/Feature/CleanupStagingLegacyPaymentsTest.php
```

- [ ] **Step 3: Implement guards before any query that mutates data.**

Require exact staging database identity from `config('database.connections.mysql.database')` versus `env('STAGING_DATABASE_NAME')`; reject missing/mismatched identity. Use `DB::transaction`, report counts first, then delete only approved legacy rows/fields.

- [ ] **Step 4: Run cleanup tests and dry run.**

```bash
php artisan test tests/Feature/CleanupStagingLegacyPaymentsTest.php
php artisan payments:cleanup-staging-legacy
```
Expected: refusal and zero mutations without `--confirm-staging`.

- [ ] **Step 5: Commit command.**

```bash
git add app/Console/Commands/CleanupStagingLegacyPayments.php tests/Feature/CleanupStagingLegacyPaymentsTest.php
 git commit -m "feat: guard staging legacy payment cleanup"
```

---

### Task 5: Run local quality and migration gates

**Files:**
- No production changes expected.

- [ ] **Step 1: Run PHP tests.**

```bash
php artisan test
```
Expected: PASS.

- [ ] **Step 2: Run frontend checks.**

```bash
npm run format:check
npm run build
```
Run repository-defined typecheck/lint commands from `package.json`; record exact command/output.

- [ ] **Step 3: Run migration parity/disposable database check.**

Use the existing project migration parity command/script. Confirm all migrations run from empty schema and canonical tables exist; do not point it at staging.

- [ ] **Step 4: Run diff and status checks.**

```bash
git diff --check
git status --short
```
Keep unrelated untracked files out of commits.

- [ ] **Step 5: Commit any test/config corrections separately.**

Use a focused Conventional Commit only when required by failed gates.

---

### Task 6: Deploy develop and verify staging metadata

**Files:**
- Modify: `.github/workflows/deploy-staging.yml` only if quality/configuration requires it.

- [ ] **Step 1: Push reviewed commits to `develop`.**

```bash
git push origin develop
```

- [ ] **Step 2: Wait for `Deploy Staging` quality and deploy jobs.**

```bash
gh run list --workflow deploy-staging.yml --limit 3
gh run watch <run-id> --exit-status
```
Expected: quality, deploy, asset upload, and health checks PASS.

- [ ] **Step 3: Run diagnostic workflow.**

```bash
gh workflow run diagnose-staging.yml --ref develop
gh run watch <run-id> --exit-status
```
Confirm `APP_ENV=staging`, staging database identity, legacy writes disabled, and deployed SHA matches expected commit.

---

### Task 7: Clean staging legacy data and smoke-test canonical flow

**Files:**
- No source changes expected unless verification exposes a concrete defect.

- [ ] **Step 1: Run canonical verifier on staging.**

Run through SSH/workflow:
```bash
php artisan payments:verify-cutover
```
Expected: success before cleanup.

- [ ] **Step 2: Execute guarded staging cleanup only on confirmed staging.**

```bash
php artisan payments:cleanup-staging-legacy --confirm-staging
```
Record pre/post counts. Do not run on production or local shared databases.

- [ ] **Step 3: Re-run canonical verifier.**

```bash
php artisan payments:verify-cutover
```
Expected: success with zero legacy transaction rows and valid canonical rows.

- [ ] **Step 4: Run staging smoke test.**

Verify checkout creates one `PaymentAttempt`, webhook/status path transitions it, no `payment_transactions` row is created, and refund path creates/updates `RefundObligation`.

- [ ] **Step 5: Record deployment/cleanup evidence.**

Save run IDs, deployed SHA, database identifier (masked), row counts, verifier output, and smoke-test result in the deployment record. Do not include credentials.
