# Order Expired Timing and DOKU Coordination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make order expiration timing configurable and keep Dombi order lifecycle safely coordinated with DOKU payment reconciliation.

**Architecture:** Dombi remains source of truth for order confirmation expiry; `PaymentAttempt` remains source of truth for payment state; `RefundObligation` remains source of truth for refunds. Centralize timeout values in `config/order.php`, preserve terminal-order guards, and add regression coverage for expiry, retry, reconciliation, and late callbacks.

**Tech Stack:** Laravel, PHP, PHPUnit, Laravel Scheduler, DOKU Checkout integration.

## Global Constraints

- Order confirmation timeout default: `30` minutes.
- Payment retry window default: `15` minutes.
- DOKU reconciliation deadline default: `24` hours.
- Outlet-specific `confirmation_timeout_minutes` overrides global config.
- DOKU callbacks must not revive terminal orders.
- Refunds use `RefundObligation`; payment state uses `PaymentAttempt`.
- Do not change DOKU payment methods or production secrets.

---

### Task 1: Centralize timeout configuration

**Files:**
- Modify: `config/order.php`
- Modify: `app/Services/OrderService.php:167`
- Modify: `app/Services/DokuService.php:149,228`
- Test: existing relevant feature/unit test files discovered during implementation.

**Interfaces:**
- `config('order.confirmation_timeout_minutes')` returns integer default `30`.
- `config('order.payment_retry_window_minutes')` remains integer default `15`.
- `config('order.doku_reconciliation_deadline_hours')` returns integer default `24`.

- [ ] **Step 1: Add failing configuration assertions**

Add tests asserting default values and environment/config override behavior using existing project test conventions.

- [ ] **Step 2: Run focused tests and confirm failure**

```bash
php artisan test --filter='Order|Doku|Reconciliation'
```

Expected: new assertions fail until code uses centralized values.

- [ ] **Step 3: Add DOKU deadline config**

Add:

```php
'doku_reconciliation_deadline_hours' => env(
    'DOKU_RECONCILIATION_DEADLINE_HOURS',
    24,
),
```

- [ ] **Step 4: Replace order timeout fallback**

Change the order creation fallback from hardcoded `15` to:

```php
$outlet->confirmation_timeout_minutes
    ?? (int) config('order.confirmation_timeout_minutes', 30)
```

- [ ] **Step 5: Replace DOKU reconciliation hardcode**

Change each `now()->addHours(24)` used for reconciliation deadlines to:

```php
now()->addHours(
    (int) config('order.doku_reconciliation_deadline_hours', 24)
)
```

- [ ] **Step 6: Run checks**

```bash
php -l config/order.php
php -l app/Services/OrderService.php
php -l app/Services/DokuService.php
npm run types:check
npm run lint:check
npm run format:check
```

- [ ] **Step 7: Commit**

```bash
git add config/order.php app/Services/OrderService.php app/Services/DokuService.php tests
 git commit -m "fix: centralize order expiry timing"
```

---

### Task 2: Verify order expiration and payment retry invariants

**Files:**
- Modify/Create: relevant tests under `tests/Feature` and `tests/Unit`.
- Read/modify only if required: `app/Console/Commands/ExpirePendingOrders.php`, `app/Services/CanonicalPaymentTransitionService.php`, `app/Services/OrderStatusService.php`.

- [ ] **Step 1: Add tests**

Cover:

```text
no outlet override → 30-minute confirmation expiry
outlet override → outlet value wins
failed/expired payment → retry window is 15 minutes
retry window does not bypass pending_confirmation rules
scheduler expiration → pending_confirmation becomes expired only after confirmation_expires_at
```

Assert `expired_at`, `expired_reason`, status history, and stock release where existing helpers support it.

- [ ] **Step 2: Run focused tests**

```bash
php artisan test --filter='ExpirePending|CanonicalPayment|OrderStatus'
```

- [ ] **Step 3: Commit**

```bash
git add tests app/Console/Commands/ExpirePendingOrders.php app/Services/CanonicalPaymentTransitionService.php app/Services/OrderStatusService.php
 git commit -m "test: cover order expiry invariants"
```

---

### Task 3: Verify DOKU reconciliation and late callback behavior

**Files:**
- Modify/Create: relevant tests under `tests/Feature` and `tests/Unit`.
- Read/modify only if required: `app/Services/DokuService.php`, `app/Services/CanonicalPaymentTransitionService.php`.

- [ ] **Step 1: Add tests**

Cover:

```text
unknown payment gets 24-hour reconciliation deadline
unknown payment past deadline becomes failed
past deadline expires non-terminal order
already expired order is not transitioned again
late DOKU success cannot revive expired order
settled late payment creates/retains one RefundObligation
```

Use existing payment factories/helpers and assert canonical `PaymentAttempt` and `RefundObligation` state.

- [ ] **Step 2: Run focused tests**

```bash
php artisan test --filter='Doku|Reconciliation|CanonicalPayment|Refund'
```

- [ ] **Step 3: Commit**

```bash
git add tests app/Services/DokuService.php app/Services/CanonicalPaymentTransitionService.php
 git commit -m "test: protect DOKU expiry coordination"
```

---

### Task 4: Final verification and staging readiness

**Files:**
- No production secrets or payment method configuration changes.

- [ ] **Step 1: Run complete available checks**

```bash
php artisan test
npm run types:check
npm run lint:check
npm run format:check
git diff --check
```

If PHPUnit is unavailable, record exact environment limitation; do not claim PHP tests passed.

- [ ] **Step 2: Manually verify staging configuration**

Confirm without exposing secret values:

```text
ORDER_CONFIRMATION_TIMEOUT_MINUTES=30 or unset with config default 30
ORDER_PAYMENT_RETRY_WINDOW_MINUTES=15 or unset with config default 15
DOKU_RECONCILIATION_DEADLINE_HOURS=24 or unset with config default 24
DOKU_IS_SANDBOX=true on staging
```

- [ ] **Step 3: Verify scheduler entries**

Confirm these run every minute and retain `withoutOverlapping()` and `onOneServer()`:

```text
orders:expire-pending
payments:expire-unknown
payments:reconcile-doku
```

- [ ] **Step 4: Commit only if verification documentation changed**

Do not create a no-op commit. Keep unrelated files untouched.
