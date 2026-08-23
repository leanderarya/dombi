## Task 4: Add canonical refund obligations and idempotent historical backfill

**Files:**
- Create: `database/migrations/*_create_refund_obligations_table.php`
- Create: `app/Models/RefundObligation.php`
- Create: `app/Enums/RefundObligationStatus.php`
- Create: `app/Services/RefundObligationService.php`
- Create: `database/migrations/*_backfill_refund_obligations.php`
- Test: `tests/Feature/RefundObligationTest.php`

**Interfaces:**
- `RefundObligationService::createForAttempt(PaymentAttempt $attempt, string $reason): RefundObligation`.
- `RefundObligationService::transition(RefundObligation $obligation, RefundObligationStatus $to, array $metadata = []): bool`.
- `RefundObligation` always has non-null `payment_attempt_id`.

- [ ] **Step 1: Test canonical lifecycle and uniqueness**

Cover `pending → in_progress → completed`, rejection/rollback, `needs_review`, deterministic duplicate-key race recovery, positive amount, and foreign-key enforcement.

- [ ] **Step 2: Implement table/model/service**

Add unique `(payment_attempt_id, reason)`. Preserve manual destination/proof/reference fields needed by current RefundService.

- [ ] **Step 3: Backfill attempts before refunds**

Map historical refunds to existing attempts, then synthesized legacy attempts where defensible. Stop unmappable rows in an exception report; never create orphan obligations.

- [ ] **Step 4: Run tests**

Run: `php artisan test tests/Feature/RefundObligationTest.php`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Enums app/Models app/Services database/migrations tests/Feature/RefundObligationTest.php
git commit -m "feat: add canonical refund obligations"
```

