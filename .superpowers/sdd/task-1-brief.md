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

### Final audit report

- Updated `OrderService` confirmation timeout fallback to null-safe config access.
- Normalized order timing environment values to positive integers; invalid, empty, zero, and negative values retain defaults `30/15/24`.
- Added config coverage for invalid environment values.
- PHP lint and `git diff --check` pass.
- `graphify update .` pass; generated graph outputs remain ignored.
- Focused PHPUnit unavailable: `vendor/bin/phpunit` missing; `php artisan test` command unavailable.

### Final finding audit

- Filtered expiry sweep to unknown attempts with non-null `metadata->reconciliation_deadline_at` already at or before current time before applying batch limit.
- Added regression coverage proving undated unknown attempts cannot starve due attempts.
- PHP lint and `git diff --check` pass; focused PHPUnit unavailable.
- `graphify update .` pass.
