# Refund Feature Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete and harden one-full-refund lifecycle for Owner, registered Customer, Outlet, and guest tracking with immutable history, race-safe transitions, private proof access, role-safe payloads, and complete payment/order entry coverage.

**Architecture:** Keep current refund snapshot on `orders`, add `refund_destination_status`, and append immutable `refund_status_histories` within the same database transaction as every lifecycle transition. Centralize mutations in `RefundService`, role-aware serialization in `RefundPayloadService`, and event-idempotent notifications in existing `NotificationService`; controllers authorize before mutation and expose explicit DTOs rather than serialized `Order` models.

**Tech Stack:** PHP 8.3, Laravel 13.7, Eloquent, FormRequests, PHPUnit 12, Inertia 3, React 19, TypeScript 5.7, Vitest 4 where an existing pure-function pattern applies, Tailwind CSS 4, Laravel `local`/`public` storage disks.

## Global Constraints

- Maximum two tracked files per task; verification-only tasks touch zero files.
- No new Composer or npm dependency.
- One full refund per order; no partial refund and no multiple refund aggregate.
- No DOKU refund API or automatic money movement.
- Refund amount is server-snapshotted from positive paid `order.total` when requested and never overwritten during completion.
- Current snapshot remains on `orders`; immutable lifecycle events live in `refund_status_histories` with no `updated_at`.
- `refund_destination_status` canonical values are `missing`, `valid`, and `invalid`; UI-only queue states never become payment statuses.
- Canonical guest check is `order.customer.user_id === null`, regardless of `customers.is_registered`.
- Every successful lifecycle event writes exactly one history row in the same DB transaction; failed/stale transitions write no success history or notification.
- History metadata may contain destination type, rollback mode, refund amount, source entry point, proof presence, and transfer-reference presence; it must never contain full destination values, proof paths, raw DOKU payloads, secrets, or tokens.
- Owner alone may start, reject, rollback, complete, or enter/edit guest destination.
- Registered Customer alone may enter/edit destination for their own registered-customer order before processing or after eligible correction.
- Guest cannot cancel, request refund, submit destination, view destination, view proof, or mutate lifecycle.
- Outlet cannot progress unpaid orders or mutate refund lifecycle and never receives destination, proof, or transfer reference.
- New proofs use Laravel `local` disk path `refund-proofs/{order_id}/...` persisted as `private:<path>`; unprefixed legacy paths resolve on `public` disk only through the authorized stream endpoint.
- Canonical stock-unavailable business copy is `Stok Tidak Tersedia`; historical free text is not migrated, while exact legacy `Stok Habis` is normalized at display time.
- Owner/customer action controls and filter tabs have minimum 44px targets; selected filters expose `aria-current`; form errors use associated text and `role="alert"`; dialogs have labels, focusable controls, and keyboard close behavior.
- Existing routes remain backward-compatible only where approved: `/owner/refunds` redirects to finance refund tab; no guest cancellation compatibility mutation remains.
- Each backend behavior task follows red-green TDD and ends with its focused passing command.
- Each frontend task runs `npm run types:check` and `npm run build`; React component Vitest is omitted because project has no React component-test harness, while existing Vitest pure-function pattern is used for stock-copy normalization.

---

## Stable Interfaces Used by Later Tasks

### PHP lifecycle API

```php
final class RefundService
{
    public function request(
        Order $order,
        string $source,
        string $actorType,
        ?int $actorId = null,
    ): ?RefundStatusHistory;

    /** @param array{destination_type:'bank'|'ewallet',bank_name?:string,account_number?:string,account_holder?:string,ewallet_provider?:string,ewallet_number?:string,ewallet_holder?:string} $destination */
    public function submitDestination(
        Order $order,
        array $destination,
        string $actorType,
        ?int $actorId,
    ): RefundStatusHistory;

    public function start(Order $order, int $ownerId): RefundStatusHistory;

    public function reject(
        Order $order,
        int $ownerId,
        RefundRejectionReason $reason,
        ?string $note,
        bool $legacyRepair = false,
    ): RefundStatusHistory;

    public function rollback(
        Order $order,
        int $ownerId,
        string $mode,
        string $reason,
    ): RefundStatusHistory;

    public function complete(
        Order $order,
        int $ownerId,
        string $proofPath,
        ?string $transferReference,
        ?string $transferNote,
    ): RefundStatusHistory;
}
```

`request()` returns `null` for a duplicate trigger already in any refund workflow status. Other methods throw `ValidationException` with exact actionable messages specified in their tasks. Successful methods return the one persisted history row.

### PHP payload API

```php
final class RefundPayloadService
{
    public const QUEUES = [
        'awaiting_customer',
        'awaiting_guest',
        'ready',
        'in_progress',
        'action_required',
        'completed',
        'rejected',
    ];

    public function queueState(Order $order): ?string;
    public function forOwner(Order $order): ?array;
    public function forCustomer(Order $order): ?array;
    public function forGuest(Order $order): ?array;
    public function forOutlet(Order $order): ?array;
    public function normalizeStockReason(?string $reason): ?string;
}
```

### HTTP API

```text
PATCH /customer/orders/{order}/refund-destination
POST  /owner/refunds/{order}/destination
POST  /owner/refunds/{order}/start
POST  /owner/refunds/{order}/reject
POST  /owner/refunds/{order}/rollback
POST  /owner/refunds/{order}/complete
GET   /refunds/{order}/proof
GET   /owner/finance?tab=refund&filter={queue}
GET   /owner/refunds -> 302 /owner/finance?tab=refund&filter=ready
```

### TypeScript API

`resources/js/types/refund.ts` exports `RefundPaymentStatus`, `RefundDestinationStatus`, `RefundQueue`, `RefundHistoryItem`, `CustomerRefundPayload`, `GuestRefundPayload`, `OutletRefundPayload`, `OwnerRefundPayload`, `RefundPagination`, and `RefundQueueCounts`. Exact shapes appear in Task 34 and are the only refund types imported by role pages/components.

---

### Task 1: Add lifecycle schema and deterministic backfill

**Files:**
- Create: `database/migrations/2026_07_24_010000_add_refund_lifecycle_hardening.php`
- Create: `tests/Feature/RefundLifecycleSchemaTest.php`

**Interfaces:**
- Consumes: existing manual-refund columns on `orders`.
- Produces: `orders.refund_destination_status`; `refund_status_histories` schema and indexes.

- [ ] **Step 1: Add failing schema/backfill cases**

Create test methods with exact assertions:

```php
public function test_lifecycle_columns_and_history_table_exist(): void
{
    $this->assertTrue(Schema::hasColumn('orders', 'refund_destination_status'));
    foreach (['id', 'order_id', 'from_status', 'to_status', 'event', 'actor_type', 'actor_id', 'reason_code', 'note', 'metadata', 'created_at'] as $column) {
        $this->assertTrue(Schema::hasColumn('refund_status_histories', $column));
    }
    $this->assertFalse(Schema::hasColumn('refund_status_histories', 'updated_at'));
}

public function test_existing_destination_rows_backfill_valid_and_missing(): void
{
    $this->artisan('migrate:fresh', [
        '--path' => 'database/migrations',
        '--realpath' => false,
    ])->assertSuccessful();

    Schema::table('orders', function (Blueprint $table): void {
        $table->dropColumn('refund_destination_status');
    });
    Schema::dropIfExists('refund_status_histories');
    DB::table('migrations')
        ->where('migration', '2026_07_24_010000_add_refund_lifecycle_hardening')
        ->delete();

    $base = Order::factory()->raw(['payment_status' => 'refund_pending']);
    $validId = DB::table('orders')->insertGetId(array_merge($base, [
        'refund_destination_type' => 'bank',
        'refund_destination_submitted_at' => now(),
    ]));
    $missingId = DB::table('orders')->insertGetId(array_merge($base, [
        'order_code' => $base['order_code'].'-M',
        'refund_destination_type' => null,
        'refund_destination_submitted_at' => null,
    ]));

    $this->artisan('migrate', [
        '--path' => 'database/migrations/2026_07_24_010000_add_refund_lifecycle_hardening.php',
    ])->assertSuccessful();

    $this->assertSame('valid', DB::table('orders')->find($validId)->refund_destination_status);
    $this->assertSame('missing', DB::table('orders')->find($missingId)->refund_destination_status);
}
```

The test must preserve inserted rows while applying only the new migration. If test database setup already migrated the new file, remove that migration's schema and migrations-table row before inserting fixtures exactly as shown.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/RefundLifecycleSchemaTest.php`

Expected: FAIL because `refund_destination_status` and `refund_status_histories` do not exist.

- [ ] **Step 3: Implement exact migration**

```php
Schema::table('orders', function (Blueprint $table): void {
    $table->string('refund_destination_status')->nullable()->after('refund_destination_submitted_at');
    $table->index(['payment_status', 'refund_destination_status'], 'orders_refund_queue_index');
});

DB::table('orders')
    ->whereIn('payment_status', ['refund_pending', 'refund_in_progress', 'refunded', 'refund_rejected', 'refund_failed'])
    ->update([
        'refund_destination_status' => DB::raw(
            "CASE WHEN refund_destination_submitted_at IS NOT NULL AND refund_destination_type IN ('bank','ewallet') THEN 'valid' ELSE 'missing' END"
        ),
    ]);

Schema::create('refund_status_histories', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('order_id')->constrained()->cascadeOnDelete();
    $table->string('from_status')->nullable();
    $table->string('to_status');
    $table->string('event');
    $table->string('actor_type');
    $table->unsignedBigInteger('actor_id')->nullable();
    $table->string('reason_code')->nullable();
    $table->text('note')->nullable();
    $table->json('metadata')->nullable();
    $table->timestamp('created_at')->useCurrent();
    $table->index(['order_id', 'created_at', 'id'], 'refund_history_order_timeline_index');
    $table->index(['event', 'order_id'], 'refund_history_event_order_index');
});
```

`down()` drops `refund_status_histories`, drops `orders_refund_queue_index`, then drops `refund_destination_status`. Use driver-specific `CASE` expression quoting only if SQLite test execution requires it; both branches must implement the exact same valid/missing rule.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/RefundLifecycleSchemaTest.php`

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_07_24_010000_add_refund_lifecycle_hardening.php tests/Feature/RefundLifecycleSchemaTest.php
git commit -m "feat: add refund lifecycle history schema"
```

---

### Task 2: Add immutable refund history model

**Files:**
- Create: `app/Models/RefundStatusHistory.php`
- Create: `tests/Unit/RefundStatusHistoryTest.php`

**Interfaces:**
- Produces: immutable model constants and `order(): BelongsTo`.

- [ ] **Step 1: Add failing model cases**

Assert `UPDATED_AT === null`, metadata casts to array, `created_at` casts to datetime, order relation resolves, and mass assignment accepts every history column. Persist a row, then assert `$history->update([...])`, `$history->save()` after mutation, and `$history->delete()` each throw `LogicException('Refund history is immutable.')`; assert deleting the parent order still cascade-deletes history at database level. Assert exact event constants:

```php
RefundStatusHistory::EVENT_REFUND_REQUESTED;
RefundStatusHistory::EVENT_DESTINATION_SUBMITTED;
RefundStatusHistory::EVENT_DESTINATION_UPDATED;
RefundStatusHistory::EVENT_GUEST_DESTINATION_SUBMITTED_BY_OWNER;
RefundStatusHistory::EVENT_GUEST_DESTINATION_UPDATED_BY_OWNER;
RefundStatusHistory::EVENT_PROCESSING_STARTED;
RefundStatusHistory::EVENT_PROCESSING_ROLLED_BACK;
RefundStatusHistory::EVENT_REFUND_REJECTED;
RefundStatusHistory::EVENT_REFUND_REOPENED;
RefundStatusHistory::EVENT_REFUND_COMPLETED;
RefundStatusHistory::EVENT_REFUND_FAILED;
```

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Unit/RefundStatusHistoryTest.php`

Expected: FAIL with missing `App\Models\RefundStatusHistory`.

- [ ] **Step 3: Implement model**

```php
final class RefundStatusHistory extends Model
{
    public const UPDATED_AT = null;
    public const EVENT_REFUND_REQUESTED = 'refund_requested';
    public const EVENT_DESTINATION_SUBMITTED = 'destination_submitted';
    public const EVENT_DESTINATION_UPDATED = 'destination_updated';
    public const EVENT_GUEST_DESTINATION_SUBMITTED_BY_OWNER = 'guest_destination_submitted_by_owner';
    public const EVENT_GUEST_DESTINATION_UPDATED_BY_OWNER = 'guest_destination_updated_by_owner';
    public const EVENT_PROCESSING_STARTED = 'processing_started';
    public const EVENT_PROCESSING_ROLLED_BACK = 'processing_rolled_back';
    public const EVENT_REFUND_REJECTED = 'refund_rejected';
    public const EVENT_REFUND_REOPENED = 'refund_reopened';
    public const EVENT_REFUND_COMPLETED = 'refund_completed';
    public const EVENT_REFUND_FAILED = 'refund_failed';

    protected $fillable = ['order_id', 'from_status', 'to_status', 'event', 'actor_type', 'actor_id', 'reason_code', 'note', 'metadata', 'created_at'];

    protected function casts(): array
    {
        return ['metadata' => 'array', 'created_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Refund history is immutable.'));
        static::deleting(fn () => throw new LogicException('Refund history is immutable.'));
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
```

Do not define an `updated_at` fillable field or mutator. Database-level FK cascade remains valid because it does not invoke model delete events.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Unit/RefundStatusHistoryTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Models/RefundStatusHistory.php tests/Unit/RefundStatusHistoryTest.php
git commit -m "feat: model immutable refund history"
```

---

### Task 3: Harden Order refund model and canonical guest identity

**Files:**
- Modify: `app/Models/Order.php`
- Modify: `tests/Unit/OrderPaymentStatusTest.php`

**Interfaces:**
- Produces: `refundStatusHistories(): HasMany`, `isGuestCustomer(): bool`, destination status constants, and `refundable()` including legacy failure.

- [ ] **Step 1: Add failing exact cases**

Add assertions that:

```php
$this->assertTrue($orderWithCustomerUserNull->isGuestCustomer());
$this->assertFalse($orderWithLinkedCustomerUser->isGuestCustomer());
$this->assertSame('valid', Order::REFUND_DESTINATION_VALID);
$this->assertCount(1, $order->refundStatusHistories);
```

Create refundable fixtures for `refund_pending`, `refund_in_progress`, `refunded`, `refund_rejected`, `refund_failed`, and `paid`; assert first five included and `paid` excluded. Assert raw DB destination ciphertext differs from plaintext while model values decrypt.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Unit/OrderPaymentStatusTest.php`

Expected: FAIL on missing destination constants/relation/helper and absent `refund_failed` scope membership.

- [ ] **Step 3: Implement exact model surface**

```php
public const REFUND_DESTINATION_MISSING = 'missing';
public const REFUND_DESTINATION_VALID = 'valid';
public const REFUND_DESTINATION_INVALID = 'invalid';

public function refundStatusHistories(): HasMany
{
    return $this->hasMany(RefundStatusHistory::class)->orderBy('created_at')->orderBy('id');
}

public function isGuestCustomer(): bool
{
    return $this->relationLoaded('customer')
        ? $this->customer?->user_id === null
        : ! $this->customer()->whereNotNull('user_id')->exists();
}
```

Add `refund_destination_status` to `$fillable`; retain encrypted casts and `TEXT` storage; add `PaymentStatus::RefundFailed` to `scopeRefundable()`. Do not append refund fields globally to JSON.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Unit/OrderPaymentStatusTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Models/Order.php tests/Unit/OrderPaymentStatusTest.php
git commit -m "feat: harden order refund model"
```

---

### Task 4: Align Customer guest helpers with `user_id`

**Files:**
- Modify: `app/Models/Customer.php`
- Create: `tests/Unit/CustomerGuestIdentityTest.php`

**Interfaces:**
- Produces: canonical `isGuest()`, `isRegistered()`, `scopeGuest()`, and `scopeRegistered()`.

- [ ] **Step 1: Add failing contradictory-flag cases**

Create customers with `(user_id=null,is_registered=true)` and `(user_id=<id>,is_registered=false)`. Assert the first is guest and appears only in `guest()`; second is registered and appears only in `registered()`.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Unit/CustomerGuestIdentityTest.php`

Expected: FAIL because current helpers use `is_registered`.

- [ ] **Step 3: Implement canonical checks**

```php
public function isGuest(): bool { return $this->user_id === null; }
public function isRegistered(): bool { return $this->user_id !== null; }
public function scopeGuest($query) { return $query->whereNull('user_id'); }
public function scopeRegistered($query) { return $query->whereNotNull('user_id'); }
```

Keep `is_registered` only for legacy compatibility; never use it for refund authorization or queues.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Unit/CustomerGuestIdentityTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Models/Customer.php tests/Unit/CustomerGuestIdentityTest.php
git commit -m "fix: canonicalize guest identity"
```

---

### Task 5: Add settled enum compatibility

**Files:**
- Modify: `app/Enums/PaymentStatus.php`
- Modify: `tests/Unit/PaymentStatusTest.php`

**Interfaces:**
- Produces: `PaymentStatus::Settled` and total DB-enum parsing coverage.

- [ ] **Step 1: Add failing enum cases**

```php
$this->assertSame('settled', PaymentStatus::Settled->value);
foreach (['pending','paid','settled','expired','failed','refund_pending','refund_in_progress','refunded','refund_rejected','refund_failed'] as $value) {
    $this->assertSame($value, PaymentStatus::from($value)->value);
}
$this->assertTrue(PaymentStatus::Settled->isTerminal());
```

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Unit/PaymentStatusTest.php`

Expected: FAIL with undefined enum case `Settled`.

- [ ] **Step 3: Add exact case**

Add `case Settled = 'settled';` after `Paid`; include it in `isTerminal()`. Do not include it in refund workflow statuses.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Unit/PaymentStatusTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Enums/PaymentStatus.php tests/Unit/PaymentStatusTest.php
git commit -m "fix: parse settled payment status"
```

---

### Task 6: Permit verified expired-to-paid transition only

**Files:**
- Modify: `app/Services/PaymentStatusService.php`
- Modify: `tests/Unit/PaymentStatusServiceTest.php`

**Interfaces:**
- Produces: CAS-safe `expired -> paid`; refund lifecycle mutation moves to `RefundService` in later tasks.

- [ ] **Step 1: Add failing matrix assertions**

Assert `pending -> paid`, `failed -> paid`, and `expired -> paid` succeed; `settled -> paid`, `refunded -> paid`, and same-state transitions fail. Assert a lost CAS returns false.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Unit/PaymentStatusServiceTest.php`

Expected: FAIL for `expired -> paid`.

- [ ] **Step 3: Change exact transition map**

```php
private const VALID_TRANSITIONS = [
    'pending' => ['paid', 'failed', 'expired'],
    'failed' => ['paid', 'expired'],
    'expired' => ['paid'],
];
```

Remove refund transitions and `reopenRefund()` after all callers migrate in Tasks 10, 12, 24, and 25; until then retain them with a deprecation comment and remove in Task 26. `Settled` has no outgoing transition.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Unit/PaymentStatusServiceTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Services/PaymentStatusService.php tests/Unit/PaymentStatusServiceTest.php
git commit -m "fix: accept verified late paid status"
```

---

### Task 7: Implement atomic refund request and destination transitions

**Files:**
- Create: `app/Services/RefundService.php`
- Create: `tests/Feature/RefundServiceTest.php`

**Interfaces:**
- Produces: `request()` and `submitDestination()` signatures from stable API.

- [ ] **Step 1: Add failing lifecycle cases**

Add exact methods covering:

```text
test_request_snapshots_positive_total_and_writes_one_safe_history
test_request_rejects_zero_total
test_request_rejects_total_above_successful_payment_amount
test_request_allows_legacy_paid_at_row_without_payment_transaction
test_request_accepts_settled_collection_and_records_settled_from_status
test_duplicate_request_returns_null_without_second_history
test_registered_customer_submits_bank_and_clears_ewallet_fields
test_registered_customer_submits_ewallet_and_clears_bank_fields
test_customer_cannot_submit_for_guest_order
test_owner_can_submit_only_for_guest_order
test_pending_destination_update_uses_destination_updated_event
test_eligible_rejected_correction_uses_refund_reopened_event_and_preserves_old_rejection_history
test_final_rejected_destination_update_fails_without_mutation
test_history_failure_rolls_back_order_mutation
test_destination_metadata_contains_only_destination_type
```

For rollback-on-history-failure, attach a temporary `RefundStatusHistory::creating` listener throwing `RuntimeException`, invoke service, then assert original payment/destination fields remain unchanged.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/RefundServiceTest.php --filter='request|destination|reopen'`

Expected: FAIL with missing `RefundService`.

- [ ] **Step 3: Implement exact rules**

`request()` accepts actor types only `customer`, `guest`, `outlet`, `owner`, `system` and sources only:

```php
private const REQUEST_SOURCES = [
    'customer_cancellation',
    'outlet_rejection',
    'outlet_cancellation',
    'expiry',
    'late_payment',
    'manual_mark_paid',
];
```

Inside `DB::transaction()`, lock order with `paymentTransactions`, return `null` when payment status is any refund status, and require current status `paid` or `settled`. Preserve the actual collection state as history `from_status`. Compute trusted paid amount from the maximum transaction amount whose status is `paid` or `settled`; for legacy paid rows without a successful transaction, allow `order.total` only when `paid_at` is non-null. Require positive `order.total`, positive trusted paid amount, and `order.total <= trusted paid amount`; otherwise throw `Refund amount melebihi pembayaran terverifikasi.` Update to `refund_pending`, snapshot `refund_amount=(float) order.total`, set `refund_requested_at`, `refund_reason=$source`, and `refund_destination_status='missing'`, then create history:

```php
[
    'from_status' => $locked->payment_status,
    'to_status' => 'refund_pending',
    'event' => RefundStatusHistory::EVENT_REFUND_REQUESTED,
    'actor_type' => $actorType,
    'actor_id' => $actorId,
    'metadata' => ['refund_amount' => (float) $locked->total, 'source_entry_point' => $source],
]
```

`submitDestination()` locks the order, loads `customer`, enforces actor/customer class, validates complete selected fields, clears all unselected fields, sets status `valid`, and creates exactly one event. For eligible rejection (`invalid_destination` or `incomplete_destination`), atomically set `payment_status='refund_pending'`, set `refund_destination_status='valid'`, clear current rejection snapshot, and create only `refund_reopened` with `from_status='refund_rejected'` and `to_status='refund_pending'`; prior rejection history remains untouched. Pending first submission uses role-specific submitted event; pending replacement uses role-specific updated event. Exact failure message: `Tujuan refund tidak dapat diubah pada status ini.`

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/RefundServiceTest.php --filter='request|destination|reopen'`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Services/RefundService.php tests/Feature/RefundServiceTest.php
git commit -m "feat: add atomic refund request and destination"
```

---

### Task 8: Implement atomic start and rejection transitions

**Files:**
- Modify: `app/Services/RefundService.php`
- Modify: `tests/Feature/RefundServiceTest.php`

**Interfaces:**
- Produces: `start()` and `reject()` signatures from stable API.

- [ ] **Step 1: Add failing exact cases**

Cover valid start; missing/invalid/incomplete destination; stale duplicate start; pending rejection; in-progress rejection forbidden; `other` without note; rejection before destination forbidden; eligible rejection marks destination invalid; final rejection retains valid destination; and legacy repair accepted only when `legacyRepair=true` and `refund_requested_at < Carbon::create(2026, 7, 24, 1, 0, 0, config('app.timezone'))`.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/RefundServiceTest.php --filter='start|reject'`

Expected: FAIL because methods are absent or rules fail.

- [ ] **Step 3: Implement start**

Within one locked transaction require `refund_pending`, destination status `valid`, complete selected destination fields, and positive existing `refund_amount`; update status to `refund_in_progress`, set `refund_started_at=now()` and owner ID; create `processing_started` with owner actor and metadata `['destination_type' => $type]`. Exact messages: `Order ini tidak dalam antrean refund.` and `Tujuan refund belum lengkap atau tidak valid.`

- [ ] **Step 4: Implement reject**

Require `refund_pending`; require destination status `valid` except exact legacy gate; require note for `other`; set rejection snapshot and status `refund_rejected`; set destination status `invalid` only for invalid/incomplete reasons; create `refund_rejected` history with reason code and note, no destination values. Direct in-progress rejection always throws `Refund yang sedang diproses harus diselesaikan atau di-rollback.`

- [ ] **Step 5: Verify green**

Run: `php artisan test tests/Feature/RefundServiceTest.php --filter='start|reject'`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/Services/RefundService.php tests/Feature/RefundServiceTest.php
git commit -m "feat: add refund start and rejection"
```

---

### Task 9: Implement rollback and snapshot-preserving completion

**Files:**
- Modify: `app/Services/RefundService.php`
- Modify: `tests/Feature/RefundServiceTest.php`

**Interfaces:**
- Produces: `rollback()` and `complete()` signatures from stable API.

- [ ] **Step 1: Add failing exact cases**

Cover:

```text
retry rollback -> refund_pending + valid + clears started fields
fix_destination rollback -> refund_pending + invalid + clears started fields
rollback mode outside retry/fix_destination rejected
blank or >500 reason rejected
rollback after refunded rejected with no history
complete from in-progress writes refunded and one history
complete from pending rejected
completion keeps refund_amount after order.total changes
completion accepts only private:refund-proofs/{order_id}/ path
completion metadata records proof_present/reference_present booleans only
lost completion CAS creates no history
```

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/RefundServiceTest.php --filter='rollback|complete|snapshot'`

Expected: FAIL because methods are absent.

- [ ] **Step 3: Implement rollback**

Validate mode and trimmed reason before transaction. Lock order, require `refund_in_progress`, update status to `refund_pending`, clear `refund_started_at` and `refund_started_by`, set destination status to `valid` for `retry` or `invalid` for `fix_destination`, then create `processing_rolled_back` with note and metadata `['rollback_mode' => $mode]`.

- [ ] **Step 4: Implement completion**

Require proof path prefix exactly `private:refund-proofs/{$order->id}/`; lock order; require `refund_in_progress`; require existing positive `refund_amount`; atomically set `payment_status='refunded'`, proof, reference, note, actor, and `refunded_at` without assigning `refund_amount`; create `refund_completed` history with `from_status='refund_in_progress'`, `to_status='refunded'`, and booleans only. Exact stale message: `Refund sudah tidak dalam status diproses.`

- [ ] **Step 5: Verify green**

Run: `php artisan test tests/Feature/RefundServiceTest.php --filter='rollback|complete|snapshot'`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/Services/RefundService.php tests/Feature/RefundServiceTest.php
git commit -m "feat: add refund rollback and completion"
```

---

### Task 10: Build role-aware refund payload service

**Files:**
- Create: `app/Services/RefundPayloadService.php`
- Create: `tests/Feature/RefundPayloadPrivacyTest.php`

**Interfaces:**
- Produces: stable payload API, seven queue states, labels, safe timeline, and privacy boundary.

- [ ] **Step 1: Add failing role matrix**

Assert every role payload for each status `refund_pending`, `refund_in_progress`, `refunded`, `refund_rejected`, `refund_failed`. Exact privacy assertions:

```php
$this->assertStringContainsString('1234567890', json_encode($owner));
$this->assertStringNotContainsString('1234567890', json_encode($customer));
$this->assertStringNotContainsString('1234567890', json_encode($guest));
$this->assertStringNotContainsString('1234567890', json_encode($outlet));
$this->assertArrayNotHasKey('destination', $guest);
$this->assertArrayNotHasKey('proof_url', $guest);
$this->assertArrayNotHasKey('destination', $outlet);
$this->assertArrayNotHasKey('proof_url', $outlet);
$this->assertArrayNotHasKey('transfer_reference', $outlet);
```

Assert queue classification at exactly 24 hours using `Carbon::setTestNow`: newer in-progress is `in_progress`; equal/older is `action_required`; `refund_failed` is `action_required`. Assert registered/guest awaiting separation uses `customer.user_id`, counts all seven queue keys, and timeline excludes forbidden metadata keys.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/RefundPayloadPrivacyTest.php`

Expected: FAIL with missing service.

- [ ] **Step 3: Implement exact queue derivation**

```php
return match (true) {
    $status === 'refund_pending' && $order->isGuestCustomer() && $destination !== 'valid' => 'awaiting_guest',
    $status === 'refund_pending' && ! $order->isGuestCustomer() && $destination !== 'valid' => 'awaiting_customer',
    $status === 'refund_pending' && $destination === 'valid' => 'ready',
    $status === 'refund_in_progress' && $order->refund_started_at?->gt(now()->subHours(24)) => 'in_progress',
    $status === 'refund_in_progress', $status === 'refund_failed' => 'action_required',
    $status === 'refunded' => 'completed',
    $status === 'refund_rejected' => 'rejected',
    default => null,
};
```

Base payload fields: `order_id`, `payment_status`, `destination_status`, `queue_state`, `status_label`, numeric `amount` from `refund_amount`, ISO timestamps, translated rejection `{code,label,note,can_resubmit}`, and timeline items `{id,event,from_status,to_status,actor_type,reason_code,note,metadata,created_at}` after allow-listing metadata keys.

Owner adds full destination, customer kind/name/phone, proof URL only when completed, transfer reference/note, action booleans, and `can_legacy_repair=true` only when payment status is `refund_pending`, destination is not valid, and `refund_requested_at < Carbon::create(2026, 7, 24, 1, 0, 0, config('app.timezone'))`. Customer adds masked destination, correction booleans, proof URL only when completed. Guest adds exact guidance `Tim Dombi akan menghubungi nomor pesanan untuk konfirmasi tujuan refund.` Outlet adds no sensitive fields. `normalizeStockReason('Stok Habis')` returns `Stok Tidak Tersedia`; other strings unchanged.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/RefundPayloadPrivacyTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Services/RefundPayloadService.php tests/Feature/RefundPayloadPrivacyTest.php
git commit -m "feat: add role-safe refund payloads"
```

---

### Task 11: Make lifecycle notifications history-idempotent

**Files:**
- Modify: `app/Services/NotificationService.php`
- Modify: `tests/Feature/RefundNotificationTest.php`

**Interfaces:**
- Produces: `notifyRefundEvent(Order $order, RefundStatusHistory $history): void`.

- [ ] **Step 1: Add failing event/recipient cases**

Assert each lifecycle notification data contains integer `refund_history_id`, `order_id`, `order_code`, and role-specific `url`; calling method twice and concurrently with the same history creates one row per recipient. Assert queued push payload uses that exact role-specific URL rather than generic order URL. Assert owner receives request, registered destination-ready, reopened, and guest-contact events. Assert registered customer notifications use `customer_id`; guest Customer with null `user_id` receives none. Assert no destination number, proof path, or raw metadata appears in title/message/data.

Use this exact event matrix:

| History event | Notification type | Registered customer | Owner | URL/filter |
|---|---|---:|---:|---|
| `refund_requested` registered | `order.refund_requested` | yes | yes | customer detail; owner `awaiting_customer` |
| `refund_requested` guest | `order.refund_requested` | no | yes | owner `awaiting_guest` |
| `destination_submitted` / `destination_updated` | `order.refund_destination_submitted` | yes | yes | customer detail; owner `ready` |
| `guest_destination_submitted_by_owner` / updated | `order.refund_destination_submitted` | no | no | no notification; owner initiated action |
| `refund_reopened` registered | `order.refund_destination_submitted` | yes | yes | customer detail; owner `ready` |
| `processing_started` | `order.refund_processing_started` | yes | no | customer detail |
| `processing_rolled_back` registered | `order.refund_rolled_back` | yes | no | customer detail |
| `processing_rolled_back` guest | `order.refund_rolled_back` | no | no | guest tracks read-only; owner initiated action |
| `refund_rejected` registered | `order.refund_rejected` | yes | no | customer detail |
| `refund_rejected` guest | `order.refund_rejected` | no | no | guest tracks read-only |
| `refund_completed` registered | `order.refund_processed` | yes | no | customer detail |
| `refund_completed` guest | `order.refund_processed` | no | no | guest tracks read-only |
| `refund_failed` | `order.refund_failed` | registered customer only | yes | customer detail; owner `action_required` |

Customer detail URL is `/customer/orders/{order_id}`. Owner URL is `/owner/finance?tab=refund&filter={queue}`. Recipient `no` means no database notification row or push for that role.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/RefundNotificationTest.php`

Expected: FAIL because notifications lack history IDs, owner recipients, and idempotency.

- [ ] **Step 3: Implement one event entry point**

```php
public function notifyRefundEvent(Order $order, RefundStatusHistory $history): void
```

Use `customer.user_id !== null` for customer recipients. Add private `createRefundOnce(...)` that runs in `DB::transaction()`, locks the referenced `refund_status_histories` row with `lockForUpdate()`, checks existing notification by `type`, `entity_type='order'`, `entity_id`, recipient columns, and `data->refund_history_id`, then calls existing `create()` only when absent. The history-row lock serializes concurrent notification attempts for the same event. Build messages from history event and safe order snapshot only. Push payload URL must prefer validated notification `data['url']`; it must not call generic `getPushUrl('order', ...)` for refund events. Keep existing public refund notification methods temporarily as wrappers only until Task 26 removes callers.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/RefundNotificationTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Services/NotificationService.php tests/Feature/RefundNotificationTest.php
git commit -m "feat: make refund notifications event-idempotent"
```

---

### Task 12: Dispatch notifications only after successful transaction

**Files:**
- Modify: `app/Services/RefundService.php`
- Modify: `tests/Feature/RefundServiceTest.php`

**Interfaces:**
- Consumes: `NotificationService::notifyRefundEvent()`.
- Produces: post-commit notifications for all successful methods.

- [ ] **Step 1: Add failing transaction-boundary cases**

Assert one notification set per successful request/destination/start/reject/rollback/complete, no notification for duplicate request, no notification after validation failure, and no notification when history insert throws.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/RefundServiceTest.php --filter=notification`

Expected: FAIL because service does not dispatch lifecycle notifications.

- [ ] **Step 3: Inject and dispatch**

Inject `NotificationService` in constructor. Inside the same lifecycle transaction, after the history row is persisted, register `DB::afterCommit(fn () => $this->notifications->notifyRefundEvent($history->order->loadMissing('customer'), $history))`. This callback runs only after the outermost transaction commits, including when `RefundService` is called inside `OrderStatusService` transactions. `request()` registers no callback when result is `null`. Tests must wrap a service call in an outer transaction, roll it back, and assert no notification was created.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/RefundServiceTest.php --filter=notification`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Services/RefundService.php tests/Feature/RefundServiceTest.php
git commit -m "feat: notify committed refund events"
```

---

### Task 13: Route all order entry points through RefundService

**Files:**
- Modify: `app/Services/OrderStatusService.php`
- Create: `tests/Feature/RefundEntryMatrixTest.php`

**Interfaces:**
- Consumes: `RefundService::request()`.
- Produces: paid/settled/unpaid cancellation, rejection, cancellation, and expiry matrix; canonical stock reason; non-HTTP service guard against unpaid operational progression.

- [ ] **Step 1: Add failing matrix cases**

Use data providers for exact combinations:

```text
registered customer cancellation: paid/settled => refund_pending; pending => unchanged
outlet rejection: paid/settled => refund_pending; pending => unchanged
outlet cancellation from accepted status: paid/settled => refund_pending; unpaid setup is rejected by service guard
expiry: paid/settled => refund_pending; pending/failed/expired => unchanged
non-HTTP `transition()` and `completePickup()` calls: paid/settled operational progression allowed; null/pending/failed/expired/refund states rejected before order/history mutation
```

For each eligible row assert one `refund_requested` history and one owner/customer notification set after duplicate invocation attempts. Assert source metadata equals `customer_cancellation`, `outlet_rejection`, `outlet_cancellation`, or `expiry`. Assert `outletCancellationReasons()` contains `Stok Tidak Tersedia` and excludes `Stok Habis`.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/RefundEntryMatrixTest.php`

Expected: FAIL because current private `processRefund()` bypasses history and destination status.

- [ ] **Step 3: Replace entry mutation**

Inject `RefundService`; replace `processRefund()` internals with `request()`. Pass actor type/id from transition context and source mapping. In `rejectOrder()`, avoid the current second refund path after `handleSideEffects`; ensure one invocation. Treat `paid` and `settled` as verified collection states. Add a locked service-level guard in `transition()` and `completePickup()` that allows forward operational transitions only for `paid` or `settled`; retain unpaid rejection/expiry paths that terminate without fulfillment. Replace outlet cancellation reason string exactly.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/RefundEntryMatrixTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Services/OrderStatusService.php tests/Feature/RefundEntryMatrixTest.php
git commit -m "fix: unify refund entry matrix"
```

---

### Task 14: Normalize legacy stock copy in role displays

**Files:**
- Create: `resources/js/lib/order-reasons.ts`
- Create: `tests/js/lib/order-reasons.test.ts`

**Interfaces:**
- Produces: `normalizeOrderReason(reason: string | null | undefined): string | null`.

- [ ] **Step 1: Add failing Vitest cases**

```ts
expect(normalizeOrderReason('Stok Habis')).toBe('Stok Tidak Tersedia');
expect(normalizeOrderReason('Stok Tidak Tersedia')).toBe('Stok Tidak Tersedia');
expect(normalizeOrderReason('Produk Rusak')).toBe('Produk Rusak');
expect(normalizeOrderReason(null)).toBeNull();
expect(normalizeOrderReason(undefined)).toBeNull();
```

- [ ] **Step 2: Verify red**

Run: `npm test -- tests/js/lib/order-reasons.test.ts`

Expected: FAIL because module is missing.

- [ ] **Step 3: Implement one pure function**

```ts
export function normalizeOrderReason(reason: string | null | undefined): string | null {
    if (!reason) return null;
    return reason === 'Stok Habis' ? 'Stok Tidak Tersedia' : reason;
}
```

- [ ] **Step 4: Verify green**

Run: `npm test -- tests/js/lib/order-reasons.test.ts`

Expected: PASS, 5 assertions.

- [ ] **Step 5: Commit**

```bash
git add resources/js/lib/order-reasons.ts tests/js/lib/order-reasons.test.ts
git commit -m "fix: normalize stock-unavailable copy"
```

---

### Task 15: Harden late paid transitions including expired

**Files:**
- Modify: `app/Services/DokuService.php`
- Modify: `tests/Feature/DokuPaymentAtomicTest.php`

**Interfaces:**
- Consumes: `PaymentStatusService::transition(...Paid)` and `RefundService::request(...'late_payment'...)`.
- Produces: one verified late-payment refund after every terminal order status.

- [ ] **Step 1: Add failing matrix**

Cross previous payment status `pending`, `failed`, `expired` with order status `cancelled_by_customer`, `cancelled_by_outlet`, `rejected_by_outlet`, `expired`. For all 12 rows call verified `processPaymentStatusChange($order, 'paid')`; assert paid transition and refund request commit together, final `refund_pending`, one history, one notification set, source `late_payment`, and snapshotted amount. Add duplicate webhook/redirect call assertion. Force refund-history creation failure and assert payment status, paid timestamp, payment transaction, refund snapshot, history, and notifications all remain unchanged.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/DokuPaymentAtomicTest.php --filter=late`

Expected: FAIL for expired previous status and history/idempotency assertions.

- [ ] **Step 3: Replace late refund path**

In `processPaymentStatusChange()`, wrap payment-transaction update, `PaymentStatusService::transition(...Paid)`, paid timestamp, and terminal-order `RefundService::request($order, 'late_payment', 'system')` in one outer `DB::transaction()`. Lock order and matching payment transaction before mutation. For terminal orders, require non-null refund history; if request/history creation throws or returns null unexpectedly, throw so the entire paid transition and transaction update roll back. For non-terminal orders, commit paid normally. Remove direct `refund_pending` mutation and direct notification. Keep all four terminal order statuses exact.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/DokuPaymentAtomicTest.php --filter=late`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Services/DokuService.php tests/Feature/DokuPaymentAtomicTest.php
git commit -m "fix: refund every verified late payment"
```

---

### Task 16: Make manual mark-paid use shared payment flow

**Files:**
- Modify: `app/Console/Commands/DokuMarkPaid.php`
- Create: `tests/Feature/DokuMarkPaidCommandTest.php`

**Interfaces:**
- Consumes: `DokuService::processPaymentStatusChange()`.
- Produces: command cannot overwrite terminal/refund payment status directly.

- [ ] **Step 1: Add failing command cases**

Assert pending terminal-order command reaches `refund_pending` with history; expired terminal-order command does too; existing `refund_pending`, `refund_in_progress`, `refunded`, `refund_rejected`, `refund_failed`, and `settled` remain unchanged and command exits failure with `Payment status tidak dapat ditandai paid.` Assert transaction status and order/refund history commit together only when shared flow succeeds; on any shared-flow failure, outer rollback preserves original transaction and order statuses.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/DokuMarkPaidCommandTest.php`

Expected: FAIL because command directly updates order before shared flow.

- [ ] **Step 3: Use one outer transaction and shared flow**

Wrap command work in `DB::transaction()`. Lock the order and its latest pending/failed payment transaction. Reject current refund/settled states before any mutation. Require a transaction with positive amount; set that transaction status to `paid` first so `RefundService::request()` can verify paid amount, then call `processPaymentStatusChange($lockedOrder, 'paid')`. Refresh and require resulting status `paid` or `refund_pending`; otherwise throw so the outer transaction rolls back the transaction-status update. Never assign order `payment_status` or `paid_at` directly in the command. Return `self::FAILURE` with `Payment status tidak dapat ditandai paid.` when validation fails.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/DokuMarkPaidCommandTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Console/Commands/DokuMarkPaid.php tests/Feature/DokuMarkPaidCommandTest.php
git commit -m "fix: share manual paid transition flow"
```

---

### Task 17: Remove unsigned DOKU redirect success fallback

**Files:**
- Modify: `app/Http/Controllers/DokuPaymentController.php`
- Modify: `tests/Feature/DokuPaymentTest.php`

**Interfaces:**
- Produces: redirect query state is non-authoritative.

- [ ] **Step 1: Add failing security cases**

Forge `GET /payment/doku/redirect?invoice_number={code}&status=SUCCESS` while mocked status API throws; assert order remains pending and redirect carries `error=Status pembayaran belum dapat diverifikasi.` Forge `FAILED` similarly and assert no mutation. Mock verified status API success and assert shared flow marks paid/refund pending.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/DokuPaymentTest.php --filter=redirect`

Expected: FAIL because unsigned `SUCCESS` currently calls `processPaymentStatusChange()`.

- [ ] **Step 3: Delete fallback mutation**

Keep order lookup and three verified API attempts. On all failures, log query status for diagnostics only and redirect to confirmation with session error. Never call `mapStatus()` or `processPaymentStatusChange()` from query value.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/DokuPaymentTest.php --filter=redirect`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/DokuPaymentController.php tests/Feature/DokuPaymentTest.php
git commit -m "fix: reject unsigned DOKU redirect state"
```

---

### Task 18: Authorize payment before any mutation

**Files:**
- Modify: `app/Http/Controllers/Customer/OrderController.php`
- Create: `tests/Feature/PaymentAuthorizationMutationTest.php`

**Interfaces:**
- Produces: shared controller helper `authorizePaymentAccess(Request $request, Order $order): void`.

- [ ] **Step 1: Add failing mutation-proof cases**

For unrelated registered user and unauthenticated guest without bound recovery, POST pay with another payment method and assert 403 plus unchanged `payment_method`, `payment_status`, `doku_order_id`, payment transactions, and DOKU create call count zero. Repeat GET poll and assert no sync call. Create a one-minute-old guest order without recovery and prove age alone still returns 403. Bind `guest_recovery.customer_id` and `order_ids`, then prove pay and poll reach DOKU service.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/PaymentAuthorizationMutationTest.php`

Expected: FAIL because payment method changes before authorization and fresh age grants access.

- [ ] **Step 3: Implement authorization-first flow**

Call helper as first executable line after route binding in `pay()` and `paymentStatus()`. Authenticated customer must own order; owner may access; guest must have exact session binding. Remove the 30-minute age branch. Only after helper returns may validation-driven method update, transaction cleanup, sync, or session creation occur.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/PaymentAuthorizationMutationTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Customer/OrderController.php tests/Feature/PaymentAuthorizationMutationTest.php
git commit -m "fix: authorize payment before mutation"
```

---

### Task 19: Block unpaid outlet progression in request layer

**Files:**
- Modify: `app/Http/Requests/Outlet/UpdateOrderStatusRequest.php`
- Create: `tests/Feature/UnpaidOutletProgressionTest.php`

**Interfaces:**
- Produces: validation guard for all outlet progression endpoint calls.

- [ ] **Step 1: Add failing status matrix**

For payment statuses `null`, `pending`, `failed`, and `expired`, attempt `confirmed`, `preparing`, `ready_for_pickup`, and `cancelled_by_outlet` where order transition would otherwise be legal. Assert 302 validation error `payment_status` and no order/history mutation. Assert `paid` and `settled` permit legal progression. Assert existing refund statuses cannot progress.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/UnpaidOutletProgressionTest.php`

Expected: FAIL because request checks only order-status transition.

- [ ] **Step 3: Add exact after-validation guard**

```php
if ($order && ! in_array($order->payment_status, [
    PaymentStatus::Paid->value,
    PaymentStatus::Settled->value,
], true)) {
    $this->validator->errors()->add('payment_status', 'Pesanan belum dibayar dan tidak dapat diproses outlet.');
}
```

Apply before service invocation for every allowed outlet status, including cancellation.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/UnpaidOutletProgressionTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Requests/Outlet/UpdateOrderStatusRequest.php tests/Feature/UnpaidOutletProgressionTest.php
git commit -m "fix: block unpaid outlet progression"
```

---

### Task 20: Remove guest cancellation routes

**Files:**
- Modify: `routes/web.php`
- Create: `tests/Feature/GuestCancellationRouteTest.php`

**Interfaces:**
- Produces: no named or public guest cancellation route.

- [ ] **Step 1: Add failing route assertions**

Assert `Route::has('guest.orders.cancel-page')` and `Route::has('guest.orders.cancel')` are false; GET/POST old URLs return 404. Assert registered customer cancellation route remains.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/GuestCancellationRouteTest.php`

Expected: FAIL because guest routes exist.

- [ ] **Step 3: Remove exact route group**

Delete both `/guest/orders/{order}/cancel/{token}` declarations and their throttle group. Do not add aliases.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/GuestCancellationRouteTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add routes/web.php tests/Feature/GuestCancellationRouteTest.php
git commit -m "fix: remove guest cancellation routes"
```

---

### Task 21: Retain controller-level guest cancellation denial

**Files:**
- Modify: `app/Http/Controllers/Customer/GuestOrderController.php`
- Modify: `tests/Feature/GuestCancellationRouteTest.php`

**Interfaces:**
- Produces: stale direct action calls fail 403 without mutation.

- [ ] **Step 1: Add failing direct-action proof**

Instantiate controller through container and invoke `cancel()` with a valid guest order/request; expect `HttpException` status 403 and unchanged order/history. Invoke `showCancelPage()` and expect 404.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/GuestCancellationRouteTest.php --filter=action`

Expected: FAIL because action currently cancels.

- [ ] **Step 3: Replace action bodies**

```php
public function showCancelPage(): never { abort(404); }
public function cancel(): never { abort(403, 'Guest tidak dapat membatalkan pesanan.'); }
```

Remove unused request/service imports.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/GuestCancellationRouteTest.php --filter=action`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Customer/GuestOrderController.php tests/Feature/GuestCancellationRouteTest.php
git commit -m "fix: deny stale guest cancel actions"
```

---

### Task 22: Validate customer and owner guest destinations

**Files:**
- Modify: `app/Http/Requests/Customer/UpdateRefundDestinationRequest.php`
- Modify: `tests/Feature/RefundDestinationRequestTest.php`

**Interfaces:**
- Produces: one shared validation/authorization request for registered customer and owner guest paths.

- [ ] **Step 1: Add failing authorization matrix**

Assert registered customer owns order and `customer.user_id` matches auth ID; registered customer cannot submit guest destination; owner can submit only guest destination; owner cannot submit registered destination; other roles denied. Assert exact bank/e-wallet required/prohibited rules and max lengths. Assert mixed payload fails and existing valid database destination remains unchanged after validation failure.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/RefundDestinationRequestTest.php`

Expected: FAIL for canonical guest and owner cases.

- [ ] **Step 3: Implement authorize matrix**

Load route order customer. Customer authorization requires role customer, linked `customer.user_id === user.id`, and order customer ID match. Owner authorization requires role owner and `order.customer.user_id === null`. Keep exact existing field rules. Add method:

```php
public function actorType(): string
{
    return $this->user()->isOwner() ? 'owner' : 'customer';
}
```

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/RefundDestinationRequestTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Requests/Customer/UpdateRefundDestinationRequest.php tests/Feature/RefundDestinationRequestTest.php
git commit -m "feat: authorize refund destinations by role"
```

---

### Task 23: Tighten refund rejection validation

**Files:**
- Modify: `app/Http/Requests/Owner/RejectRefundRequest.php`
- Modify: `tests/Feature/RejectRefundRequestTest.php`

**Interfaces:**
- Produces: exact note and legacy-repair validation.

- [ ] **Step 1: Add failing cases**

Assert five enum reasons accepted; invalid reason rejected; `other` requires nonblank note; note max 500; `legacy_repair` nullable boolean; non-owner denied.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/RejectRefundRequestTest.php`

Expected: FAIL because `other` note and legacy flag rules are absent.

- [ ] **Step 3: Implement exact rules**

```php
'reason' => ['required', Rule::enum(RefundRejectionReason::class)],
'note' => ['nullable', 'string', 'max:500', 'required_if:reason,other'],
'legacy_repair' => ['sometimes', 'boolean'],
```

Trim note in `prepareForValidation()`; whitespace-only `other` must fail.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/RejectRefundRequestTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Requests/Owner/RejectRefundRequest.php tests/Feature/RejectRefundRequestTest.php
git commit -m "fix: validate refund rejection details"
```

---

### Task 24: Add rollback request contract

**Files:**
- Create: `app/Http/Requests/Owner/RollbackRefundRequest.php`
- Create: `tests/Feature/RollbackRefundRequestTest.php`

**Interfaces:**
- Produces: owner-only rollback validation.

- [ ] **Step 1: Add failing request cases**

Assert owner authorized; customer/outlet denied; mode required and only `retry`/`fix_destination`; reason required nonblank string max 500.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/RollbackRefundRequestTest.php`

Expected: FAIL with missing request class.

- [ ] **Step 3: Implement request**

```php
public function authorize(): bool { return $this->user()?->isOwner() ?? false; }
public function rules(): array
{
    return [
        'mode' => ['required', Rule::in(['retry', 'fix_destination'])],
        'reason' => ['required', 'string', 'max:500'],
    ];
}
protected function prepareForValidation(): void
{
    $this->merge(['reason' => trim((string) $this->input('reason'))]);
}
```

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/RollbackRefundRequestTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Requests/Owner/RollbackRefundRequest.php tests/Feature/RollbackRefundRequestTest.php
git commit -m "feat: validate refund rollback"
```

---

### Task 25: Register complete refund routes

**Files:**
- Modify: `routes/web.php`
- Create: `tests/Feature/RefundRouteContractTest.php`

**Interfaces:**
- Produces: exact HTTP API from stable interfaces.

- [ ] **Step 1: Add failing route contract**

Assert methods, URIs, names, and middleware for customer destination; owner destination/start/reject/rollback/complete; authenticated proof stream; finance tab; and owner compatibility route. Assert guest mutation routes absent.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/RefundRouteContractTest.php`

Expected: FAIL for owner destination, rollback, and proof routes.

- [ ] **Step 3: Add exact declarations**

Inside owner group add destination and rollback. Add proof route inside common authenticated group:

```php
Route::get('/refunds/{order}/proof', RefundProofController::class)->name('refunds.proof');
```

Retain `/owner/refunds` name `owner.refunds.index`; controller redirects in Task 26.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/RefundRouteContractTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add routes/web.php tests/Feature/RefundRouteContractTest.php
git commit -m "feat: register refund lifecycle routes"
```

---

### Task 26: Connect registered-customer destination action

**Files:**
- Modify: `app/Http/Controllers/Customer/OrderController.php`
- Modify: `tests/Feature/CustomerRefundDestinationTest.php`

**Interfaces:**
- Consumes: `RefundService::submitDestination()`.
- Produces: customer destination endpoint without controller-owned transaction logic.

- [ ] **Step 1: Add failing endpoint cases**

Cover actual own registered order, guest denial, other-customer denial, valid bank/e-wallet, mixed invalid payload preserving existing values, edit before processing, blocked after start, eligible reopen, final rejection block, and actionable `flash.error` on stale state.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/CustomerRefundDestinationTest.php`

Expected: FAIL because current controller directly mutates and uses old service.

- [ ] **Step 3: Replace method implementation**

Exact signature:

```php
public function updateRefundDestination(
    UpdateRefundDestinationRequest $request,
    Order $order,
    RefundService $refunds,
): RedirectResponse
```

Call `submitDestination($order, $request->validated(), 'customer', $request->user()->id)`. Return success copy `Tujuan refund berhasil disimpan.` Convert `ValidationException` naturally to field/session errors; stale service message appears through shared error flow. Remove private refund mutation and old `PaymentStatusService` dependency.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/CustomerRefundDestinationTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Customer/OrderController.php tests/Feature/CustomerRefundDestinationTest.php
git commit -m "feat: connect customer refund destination"
```

---

### Task 27: Connect owner destination and lifecycle actions

**Files:**
- Modify: `app/Http/Controllers/Owner/RefundController.php`
- Modify: `tests/Feature/OwnerManualRefundTest.php`

**Interfaces:**
- Consumes: `RefundService`, destination/reject/rollback/complete requests.
- Produces: owner mutations and `/owner/refunds` redirect.

- [ ] **Step 1: Add failing endpoint matrix**

Assert owner-only destination for guest with required `phone_verified=true`; registered order denied; start/reject/rollback/complete authorization; action state rules; legacy repair cutoff; `other` note; rollback modes; completion snapshot; stale error; and `/owner/refunds?filter=rejected` redirects to `/owner/finance?tab=refund&filter=rejected` while absent/invalid legacy filter maps to `ready`.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/OwnerManualRefundTest.php`

Expected: FAIL for destination/rollback/redirect and direct old mutations.

- [ ] **Step 3: Implement exact controller actions**

```php
public function index(Request $request): RedirectResponse;
public function destination(UpdateRefundDestinationRequest $request, Order $order, RefundService $refunds): RedirectResponse;
public function start(Order $order, RefundService $refunds): RedirectResponse;
public function reject(Order $order, RejectRefundRequest $request, RefundService $refunds): RedirectResponse;
public function rollback(Order $order, RollbackRefundRequest $request, RefundService $refunds): RedirectResponse;
public function complete(Order $order, CompleteManualRefundRequest $request, RefundService $refunds): RedirectResponse;
```

For destination, validate `phone_verified => accepted` in controller before service and pass owner actor. For complete, store on local disk before service:

```php
$relative = $request->file('proof')->store("refund-proofs/{$order->id}", 'local');
$persisted = "private:{$relative}";
```

If storage returns false, do not transition. If service throws after upload, delete local relative path and return exact stale error. Never pass amount or current total. Success copies identify destination saved, processing started, rejected, rolled back, or completed.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/OwnerManualRefundTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Owner/RefundController.php tests/Feature/OwnerManualRefundTest.php
git commit -m "feat: connect owner refund operations"
```

---

### Task 28: Protect private and legacy proof streaming

**Files:**
- Create: `app/Http/Controllers/RefundProofController.php`
- Create: `tests/Feature/RefundProofAccessTest.php`

**Interfaces:**
- Produces: invokable authorized stream endpoint resolving path from order only.

- [ ] **Step 1: Add failing access/storage matrix**

Using `Storage::fake('local')` and `Storage::fake('public')`, assert owner can stream any `private:` proof; registered customer can stream own; other customer gets 403/404; outlet/guest get 403; missing proof gets 404; unprefixed legacy path streams from public; no response includes storage path; query `?path=...` is ignored. Assert completion test stores only local and direct public URL is absent.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/RefundProofAccessTest.php`

Expected: FAIL with missing controller.

- [ ] **Step 3: Implement resolver and authorization**

```php
public function __invoke(Request $request, Order $order): StreamedResponse
```

Owner passes. Customer passes only when `order.customer.user_id === request.user.id`. All other roles abort 403. Require `payment_status === refunded` and proof path. Strip `private:` and stream from `local`; otherwise stream exact persisted legacy path from `public`. Use disk `response($path)` with a safe filename `refund-{order_code}.{extension}` and `Content-Disposition: inline`; never accept request path.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/RefundProofAccessTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/RefundProofController.php tests/Feature/RefundProofAccessTest.php
git commit -m "feat: authorize refund proof streaming"
```

---

### Task 29: Expose explicit customer order/refund DTOs

**Files:**
- Modify: `app/Http/Controllers/Customer/OrderController.php`
- Create: `tests/Feature/CustomerRefundExperienceTest.php`

**Interfaces:**
- Consumes: `RefundPayloadService::forCustomer()`.
- Produces: customer detail/history props with real order ID and no sensitive serialization.

- [ ] **Step 1: Add failing Inertia/privacy cases**

Assert detail `order` is explicit and `refund.order_id` equals real order ID, all seven display statuses including `refund_failed`, masked destination, timeline, timestamps, rejection details, authorized proof URL, transfer reference/note. Assert page JSON omits full destination fields and raw proof path. Assert history cards include compact `refund` badge DTO and terminal cards retain detail URL.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/CustomerRefundExperienceTest.php`

Expected: FAIL because current detail serializes full Order and history lacks refund DTO.

- [ ] **Step 3: Build explicit props**

Select/order-map only fields consumed by page; load relations explicitly. Add `refund => $payloads->forCustomer($order)` in detail and each history item. Proof URL is route URL, never disk URL. Remove private `refundPayload()` and `maskRefundNumber()` from controller. Ensure refund guidance prop precedes generic terminal guidance in page contract.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/CustomerRefundExperienceTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Customer/OrderController.php tests/Feature/CustomerRefundExperienceTest.php
git commit -m "feat: expose safe customer refund DTOs"
```

---

### Task 30: Expose guest read-only refund tracking

**Files:**
- Modify: `app/Http/Controllers/TrackController.php`
- Create: `tests/Feature/GuestRefundExperienceTest.php`

**Interfaces:**
- Consumes: `RefundPayloadService::forGuest()`.
- Produces: recovery-token status/amount/timeline only, with cancellation disabled.

- [ ] **Step 1: Add failing guest cases**

For each lifecycle status assert `order.refund` has amount, translated status, safe timeline, and exact contact guidance. Assert JSON lacks destination, proof URL/path, transfer reference/note, and action booleans. Assert `canCancel=false` for guest even when authenticated user does not own linked customer; direct `cancel()` action returns 403 before lookup/mutation.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/GuestRefundExperienceTest.php`

Expected: FAIL because tracking lacks refund payload and retains cancel action implementation.

- [ ] **Step 3: Add explicit guest payload**

Load `customer` and `refundStatusHistories`; add `refund` inside explicit order DTO. Set `canCancel` only for linked registered owner and never for canonical guest; remove cancellation reasons for guest tracking. Replace `TrackController::cancel()` body with `abort(403, 'Guest tidak dapat membatalkan pesanan.')` or remove route-bound usage while retaining guard.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/GuestRefundExperienceTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/TrackController.php tests/Feature/GuestRefundExperienceTest.php
git commit -m "feat: add read-only guest refund tracking"
```

---

### Task 31: Expose outlet-safe refund tracking and trigger feedback

**Files:**
- Modify: `app/Http/Controllers/Outlet/OrderController.php`
- Create: `tests/Feature/OutletRefundExperienceTest.php`

**Interfaces:**
- Consumes: `RefundPayloadService::forOutlet()`.
- Produces: safe list/detail DTO and paid/unpaid success feedback.

- [ ] **Step 1: Add failing outlet cases**

Assert history list and detail include translated badge/panel for pending missing, pending valid, in-progress, stale/action-required, refunded, rejected, and failed. Assert amount/timeline present; destination/proof/reference absent from full Inertia JSON. Assert paid reject/cancel success says `Refund otomatis masuk antrean owner.`; unpaid reject says `Tidak ada refund yang diperlukan.`; unpaid accepted progression remains blocked.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/OutletRefundExperienceTest.php`

Expected: FAIL because controller serializes full Order and lacks refund DTO/copy.

- [ ] **Step 3: Build explicit outlet DTOs**

Map list/detail fields and `refund => forOutlet($order)`. Do not return model-level refund fields. After reject/cancel, refresh and choose exact success suffix by resulting refund presence. Keep outlet lifecycle read-only; add no refund routes/actions.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/OutletRefundExperienceTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Outlet/OrderController.php tests/Feature/OutletRefundExperienceTest.php
git commit -m "feat: expose outlet-safe refund tracking"
```

---

### Task 32: Add seven owner queues, counts, pagination, and finance props

**Files:**
- Modify: `app/Http/Controllers/Owner/FinanceSettlementController.php`
- Create: `tests/Feature/OwnerRefundWorkspaceTest.php`

**Interfaces:**
- Consumes: `RefundPayloadService::QUEUES`, `queueState()`, `forOwner()`.
- Produces: `refunds`, `refundCounts`, `refundFilter`, and finance `activeTab` props.

- [ ] **Step 1: Add failing queue cases**

Freeze time and create one order per seven queue conditions, including stale exactly 24 hours and `refund_failed`. Request every filter and assert membership, seven counts independent of active filter, default `ready`, page size 20, page links preserve `tab=refund&filter=<key>`, order code/detail URL, snapshot amount after total mutation, translated rejection, timeline, and full owner destination only.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/OwnerRefundWorkspaceTest.php`

Expected: FAIL because finance dashboard has no refund props.

- [ ] **Step 3: Add exact dashboard branch**

Validate `tab` against `tagihan,pembayaran,rekening,refund`; validate `filter` against seven queue keys. Build database query using exact status/destination/customer-user/time conditions, eager-load customer/outlet/history, paginate 20 with query string, then transform collection with `forOwner()`. Compute each count with independent cloned query conditions. Return existing finance props unchanged for backward compatibility plus:

```php
'activeTab' => $tab,
'refunds' => $refunds,
'refundCounts' => $counts,
'refundFilter' => $filter,
```

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/OwnerRefundWorkspaceTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Owner/FinanceSettlementController.php tests/Feature/OwnerRefundWorkspaceTest.php
git commit -m "feat: add owner refund queues"
```

---

### Task 33: Share `flash.error` through default Inertia middleware

**Files:**
- Modify: `app/Http/Middleware/HandleInertiaRequests.php`
- Create: `tests/Feature/InertiaFlashErrorTest.php`

**Interfaces:**
- Produces: default internal/customer page prop `flash.error` consistent with specialized roots.

- [ ] **Step 1: Add failing shared-prop case**

Create a test route under middleware, seed session error, request Inertia, and assert `flash.error` exact value. Assert success remains.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/InertiaFlashErrorTest.php`

Expected: FAIL because default middleware omits error.

- [ ] **Step 3: Add one lazy prop**

```php
'error' => fn () => $request->session()->get('error'),
```

Do not alter `InternalInertiaRoot` or `CustomerInertiaRoot`; they already expose it.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/InertiaFlashErrorTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Middleware/HandleInertiaRequests.php tests/Feature/InertiaFlashErrorTest.php
git commit -m "fix: share Inertia error flash"
```

---

### Task 34: Retrieve customer notifications by customer ID

**Files:**
- Modify: `app/Http/Controllers/NotificationController.php`
- Create: `tests/Feature/RefundNotificationNavigationTest.php`

**Interfaces:**
- Produces: role-aware notification query and ownership checks.

- [ ] **Step 1: Add failing retrieval cases**

Create registered customer notification with `customer_id` and null `user_id`; assert index/unread count return it. Assert another customer's notification absent and cannot mark read. Owner still queries `user_id`. Assert refund data exposes exact role URL generated in Task 11.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Feature/RefundNotificationNavigationTest.php`

Expected: FAIL because controller queries only user ID.

- [ ] **Step 3: Add recipient query helper**

```php
private function recipientQuery(Request $request): Builder
```

For role customer, require `$request->user()->customer` and query `user_type='customer'` plus `customer_id`; all other roles query existing role/user ID. Use helper in index, unread, mark one ownership, and mark all.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Feature/RefundNotificationNavigationTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/NotificationController.php tests/Feature/RefundNotificationNavigationTest.php
git commit -m "fix: retrieve customer refund notifications"
```

---

### Task 35: Remove obsolete payment-status refund mutations

**Files:**
- Modify: `app/Services/PaymentStatusService.php`
- Modify: `tests/Unit/PaymentStatusServiceTest.php`

**Interfaces:**
- Produces: payment-only transition service; all refund mutations now use `RefundService`.

- [ ] **Step 1: Add failing API boundary case**

Assert reflection shows no public `reopenRefund`; assert `refund_pending -> refund_in_progress`, `refund_pending -> refund_rejected`, and `refund_in_progress -> refunded` all return false through `PaymentStatusService`.

- [ ] **Step 2: Verify red**

Run: `php artisan test tests/Unit/PaymentStatusServiceTest.php --filter=refund`

Expected: FAIL while old refund map/method remains.

- [ ] **Step 3: Delete refund ownership**

Remove `RefundRejectionReason` import, `reopenRefund()`, and refund entries from transition map. Keep only payment collection transitions from Task 6.

- [ ] **Step 4: Verify green**

Run: `php artisan test tests/Unit/PaymentStatusServiceTest.php`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Services/PaymentStatusService.php tests/Unit/PaymentStatusServiceTest.php
git commit -m "refactor: isolate refund lifecycle service"
```

---

### Task 36: Define stable TypeScript refund contracts

**Files:**
- Create: `resources/js/types/refund.ts`

**Interfaces:**
- Produces: exact frontend types consumed by Tasks 37–45.

- [ ] **Step 1: Add exact unions and interfaces**

```ts
export type RefundPaymentStatus =
    | 'refund_pending'
    | 'refund_in_progress'
    | 'refunded'
    | 'refund_rejected'
    | 'refund_failed';
export type RefundDestinationStatus = 'missing' | 'valid' | 'invalid';
export type RefundQueue =
    | 'awaiting_customer' | 'awaiting_guest' | 'ready' | 'in_progress'
    | 'action_required' | 'completed' | 'rejected';
export type RefundDestinationType = 'bank' | 'ewallet';

export interface RefundHistoryItem {
    id: number;
    event: string;
    from_status: string | null;
    to_status: string;
    actor_type: 'customer' | 'guest' | 'outlet' | 'owner' | 'system';
    reason_code: string | null;
    note: string | null;
    metadata: Record<string, string | number | boolean | null>;
    created_at: string;
}

export interface MaskedRefundDestination {
    type: RefundDestinationType;
    label: string;
    holder: string;
    masked_number: string;
}
export interface FullRefundDestination {
    type: RefundDestinationType;
    label: string;
    holder: string;
    number: string;
}
export interface RefundRejection {
    code: string;
    label: string;
    note: string | null;
    can_resubmit: boolean;
}
export interface RefundBase {
    order_id: number;
    payment_status: RefundPaymentStatus;
    destination_status: RefundDestinationStatus | null;
    queue_state: RefundQueue;
    status_label: string;
    amount: number;
    requested_at: string | null;
    submitted_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    rejection: RefundRejection | null;
    timeline: RefundHistoryItem[];
}
export interface CustomerRefundPayload extends RefundBase {
    role: 'customer';
    destination: MaskedRefundDestination | null;
    can_edit_destination: boolean;
    can_resubmit: boolean;
    proof_url: string | null;
    transfer_reference: string | null;
    transfer_note: string | null;
}
export interface GuestRefundPayload extends RefundBase {
    role: 'guest';
    guidance: string;
}
export interface OutletRefundPayload extends RefundBase { role: 'outlet'; }
export interface OwnerRefundPayload extends RefundBase {
    role: 'owner';
    order_code: string;
    order_url: string;
    customer_kind: 'registered' | 'guest';
    customer_name: string;
    customer_phone: string;
    destination: FullRefundDestination | null;
    proof_url: string | null;
    transfer_reference: string | null;
    transfer_note: string | null;
    can_enter_destination: boolean;
    can_legacy_repair: boolean;
    can_start: boolean;
    can_reject: boolean;
    can_rollback: boolean;
    can_complete: boolean;
}
export type RefundQueueCounts = Record<RefundQueue, number>;
export interface RefundPagination {
    data: OwnerRefundPayload[];
    links: { url: string | null; label: string; active: boolean }[];
    current_page: number;
    last_page: number;
    total: number;
}
```

- [ ] **Step 2: Verify compile/build**

Run: `npm run types:check && npm run build`

Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add resources/js/types/refund.ts
git commit -m "feat: define refund UI contracts"
```

---

### Task 37: Fix customer destination form state and Select API

**Files:**
- Modify: `resources/js/components/customer/order/refund-destination-form.tsx`

**Interfaces:**
- Consumes: `RefundDestinationType`, real `orderId`.
- Produces: accessible bank/e-wallet form with selected type in submitted state.

- [ ] **Step 1: Replace props and form state exactly**

```ts
interface Props {
    orderId: number;
    initialType?: RefundDestinationType;
    initialLabel?: string;
    initialHolder?: string;
    onSaved?: () => void;
}
interface DestinationFormData {
    destination_type: RefundDestinationType;
    bank_name: string;
    account_number: string;
    account_holder: string;
    ewallet_provider: string;
    ewallet_number: string;
    ewallet_holder: string;
}
```

Initialize selected label into bank name or e-wallet provider and holder into matching holder field. On type change, call `form.setData()` with `destination_type` and clear all fields belonging to unselected type. Number always starts empty, including edit, and remains required.

- [ ] **Step 2: Use existing Select contract**

Use `<Select options={[...]} value={form.data.ewallet_provider} onChange={(event) => ...} placeholder="Pilih provider" />`; do not use `onValueChange` or child `<option>` elements. Associate labels/errors, set `aria-live="polite"` on submission result, and make type controls and submit minimum `min-h-11`.

- [ ] **Step 3: Submit exact API**

PATCH `/customer/orders/${orderId}/refund-destination`; payload already contains selected type before request starts. Preserve scroll; display server `flash.error`/field errors; never submit masked number.

- [ ] **Step 4: Verify**

Run: `npm run types:check && npm run build`

Expected: both exit 0; no Select prop error.

- [ ] **Step 5: Commit**

```bash
git add resources/js/components/customer/order/refund-destination-form.tsx
git commit -m "fix: submit customer refund destination"
```

---

### Task 38: Render complete registered-customer refund card

**Files:**
- Modify: `resources/js/components/customer/order/refund-status-card.tsx`

**Interfaces:**
- Consumes: `CustomerRefundPayload` and Task 37 form.
- Produces: seven safe display states with timeline.

- [ ] **Step 1: Replace local types/props**

```ts
interface Props { refund: CustomerRefundPayload; }
```

Pass `refund.order_id` to every destination form; remove every `orderId={0}`. Render pending missing/invalid with form; pending valid with masked summary/edit; in-progress locked; completed proof/reference/note; rejected correctable with correction form; rejected final read-only; failed with `Perlu Tindakan` and support guidance.

- [ ] **Step 2: Add full status content**

Every state displays snapshot amount, translated status, available timestamps, rejection label/note, and ordered timeline. Completed proof anchor uses `refund.proof_url`, descriptive label `Lihat bukti refund order ini`, and no storage URL. Refund guidance is visually first within card.

- [ ] **Step 3: Apply accessibility**

Use semantic heading, timeline list, `time dateTime`, `role="status"` for state copy, `role="alert"` for failed/rejected corrective warning, descriptive button labels, and minimum 44px controls.

- [ ] **Step 4: Verify**

Run: `npm run types:check && npm run build`

Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add resources/js/components/customer/order/refund-status-card.tsx
git commit -m "feat: complete customer refund card"
```

---

### Task 39: Make customer terminal history clickable with refund badges

**Files:**
- Modify: `resources/js/pages/customer/orders/show.tsx`
- Modify: `resources/js/components/customer/order-history-card.tsx`

**Interfaces:**
- Consumes: `CustomerRefundPayload` and compact history refund prop.
- Produces: detail precedence and clickable terminal cards.

- [ ] **Step 1: Type and render detail refund**

Type `refund: CustomerRefundPayload | null`; render card before generic terminal guidance and hide generic terminal guidance whenever refund exists. Pass no order-derived fallback ID.

- [ ] **Step 2: Update history card contract**

Add `payment_status` and `refund: Pick<CustomerRefundPayload,'payment_status'|'status_label'|'queue_state'> | null`. Pass `clickable` to `OrderCardShell` whenever refund exists or status is terminal. Render refund badge independently from order status. Normalize displayed rejection/cancellation reason with `normalizeOrderReason()`.

- [ ] **Step 3: Verify**

Run: `npm run types:check && npm run build`

Expected: both exit 0; terminal card retains link and refund badge.

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/customer/orders/show.tsx resources/js/components/customer/order-history-card.tsx
git commit -m "feat: link customer refund history"
```

---

### Task 40: Render outlet read-only refund badges and panel

**Files:**
- Modify: `resources/js/pages/outlet/orders/index.tsx`
- Modify: `resources/js/pages/outlet/orders/show.tsx`

**Interfaces:**
- Consumes: `OutletRefundPayload`.
- Produces: list badge and detail panel without mutation/sensitive data.

- [ ] **Step 1: Type outlet refund props**

List orders accept `refund: OutletRefundPayload | null`; show order does likewise. Render badge labels from payload: `Menunggu Data Refund`, `Siap Diproses`, `Sedang Diproses`, `Perlu Tindakan`, `Selesai`, `Ditolak`.

- [ ] **Step 2: Add detail panel**

Render snapshot amount, status label, timestamps, and safe timeline. Do not reference destination, proof, or transfer reference. Do not add actions. Normalize legacy stock reason in rejection/cancellation display.

- [ ] **Step 3: Accessibility and verification**

Badge includes visible text, panel uses heading/list/time elements, and links/actions retain 44px targets.

Run: `npm run types:check && npm run build`

Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/outlet/orders/index.tsx resources/js/pages/outlet/orders/show.tsx
git commit -m "feat: show outlet refund tracking"
```

---

### Task 41: Render guest read-only tracking and remove cancellation UI

**Files:**
- Modify: `resources/js/pages/track.tsx`

**Interfaces:**
- Consumes: `GuestRefundPayload`.
- Produces: read-only refund card with no cancel/login-to-cancel actions.

- [ ] **Step 1: Extend TrackOrder safely**

Add `refund?: GuestRefundPayload | null`. Render snapshot amount, translated status, exact owner-contact guidance, timestamps, and safe timeline. Do not define destination/proof/reference/action props.

- [ ] **Step 2: Remove mutation UI/code**

Delete cancellation state, fetch handler, cancel button, login-to-cancel prompt, verification-to-cancel prompt, and cancellation dialog. Keep order recovery/read tracking. Normalize legacy stock reason in displayed cancellation/rejection copy.

- [ ] **Step 3: Apply accessibility and verify**

Use semantic status heading, timeline list, `time`, and `role="status"`; maintain minimum 44px remaining controls.

Run: `npm run types:check && npm run build`

Expected: both exit 0; no `/cancel` request string remains in file.

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/track.tsx
git commit -m "feat: show guest refund tracking read-only"
```

---

### Task 42: Add owner guest-destination and rollback dialogs

**Files:**
- Create: `resources/js/components/owner/finance/refund-operations-dialogs.tsx`

**Interfaces:**
- Consumes: `OwnerRefundPayload`, destination API, rollback API.
- Produces: `GuestRefundDestinationDialog` and `RefundRollbackDialog`.

- [ ] **Step 1: Implement guest destination dialog**

Props: `{ refund: OwnerRefundPayload | null; open: boolean; onClose(): void }`. Show customer name/phone, exact hint `Gunakan hanya untuk proses refund order ini.`, required checkbox `Saya sudah memverifikasi tujuan refund melalui nomor pesanan`, bank/e-wallet fields and existing Select API. POST `/owner/refunds/${orderId}/destination` with `phone_verified: true`; full number is editable and displayed with `break-all`; copy button aria-label states whether account/e-wallet number was copied.

- [ ] **Step 2: Implement rollback dialog**

Props use same open/refund/onClose shape. Mode options exact `retry` and `fix_destination`; required reason max 500 with counter. POST `/owner/refunds/${orderId}/rollback`. Explain retry retains valid destination and fix destination invalidates it.

- [ ] **Step 3: Apply accessibility and verify**

Each dialog has title/description, labeled controls, initial focus, Escape close via existing Dialog behavior, `role="alert"` errors, and 44px actions.

Run: `npm run types:check && npm run build`

Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add resources/js/components/owner/finance/refund-operations-dialogs.tsx
git commit -m "feat: add owner refund operation dialogs"
```

---

### Task 43: Harden owner completion and rejection dialogs

**Files:**
- Modify: `resources/js/components/owner/finance/refund-completion-modal.tsx`
- Modify: `resources/js/components/owner/finance/refund-rejection-modal.tsx`

**Interfaces:**
- Consumes: exact owner action URLs and validation limits.
- Produces: safe proof completion and standards-based rejection.

- [ ] **Step 1: Update completion**

Require image max 2 MB client hint and server errors; reference max 255; note max 500; show snapshot amount read-only and never append amount to `FormData`; POST exact complete URL with `forceFormData`. Accept no SVG in file input (`image/jpeg,image/png,image/webp`).

- [ ] **Step 2: Update rejection**

Keep five exact reason values/translated labels; require note when `other`; expose legacy-repair checkbox only when owner payload marks `can_legacy_repair`; POST exact reject URL. Never include destination in toast/log.

- [ ] **Step 3: Accessibility and verification**

Use associated labels/error IDs, `role="alert"`, focus handling, and 44px actions.

Run: `npm run types:check && npm run build`

Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add resources/js/components/owner/finance/refund-completion-modal.tsx resources/js/components/owner/finance/refund-rejection-modal.tsx
git commit -m "fix: harden owner refund dialogs"
```

---

### Task 44: Rebuild owner seven-queue refund workspace

**Files:**
- Modify: `resources/js/pages/owner/finance/refund-tab.tsx`

**Interfaces:**
- Consumes: `RefundPagination`, `RefundQueueCounts`, Task 42/43 dialogs.
- Produces: all queue cards, actions, counts, pagination, and sensitive-data treatment.

- [ ] **Step 1: Replace local model serialization types**

Props are `{ refunds: RefundPagination; refundCounts: RefundQueueCounts; refundFilter: RefundQueue }`. Define exact seven Indonesian labels in stable queue order. Filter links use `/owner/finance?tab=refund&filter=${queue}`, preserve page only through paginator links, and selected filter has `aria-current="page"`.

- [ ] **Step 2: Render operational cards**

Order code links to `order_url`; show status badge, snapshot amount only, timeline summary, translated rejection, customer/guest identity, and pagination. Owner full destination appears only here with `break-all`, labeled copy action, and hint `Gunakan hanya untuk proses refund order ini.`

- [ ] **Step 3: Render exact action matrix**

```text
awaiting_customer: monitor only
awaiting_guest: enter destination
ready registered: Start or Reject
ready guest: edit destination, Start, or Reject
in_progress/action_required from in-progress: Complete or Rollback
completed: authorized proof, reference, note, timeline
rejected: translated reason, note, timeline; guest correction via owner only when eligible
refund_failed/action_required: visible read-only escalation state; no unsupported transition button
```

Start posts exact URL after confirmation. Integrate dialogs. All buttons minimum 44px; responsive single-column cards below medium breakpoint.

- [ ] **Step 4: Verify**

Run: `npm run types:check && npm run build`

Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/owner/finance/refund-tab.tsx
git commit -m "feat: rebuild owner refund workspace"
```

---

### Task 45: Integrate refund under finance and active navigation

**Files:**
- Modify: `resources/js/pages/owner/finance/index.tsx`
- Modify: `resources/js/layouts/owner-layout.tsx`

**Interfaces:**
- Consumes: finance `activeTab`, refund props, `RefundTab`.
- Produces: fourth finance tab and active Keuangan nav for compatibility route.

- [ ] **Step 1: Add finance tab**

Add `{ key:'refund', label:'Refund', description:'Proses refund customer dan guest' }`; initialize from server `activeTab` then URL; render `RefundTab` when selected. Tab buttons use `role=tab`, `aria-selected`, 44px target, and current panel is associated with tab.

- [ ] **Step 2: Preserve backward compatibility navigation**

Keuangan `isActive` returns true for `/owner/finance` and `/owner/refunds`; link target remains `/owner/finance`. Ensure refund notification URL opens refund tab/filter without client rewriting it.

- [ ] **Step 3: Verify**

Run: `npm run types:check && npm run build`

Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/finance/index.tsx resources/js/layouts/owner-layout.tsx
git commit -m "feat: integrate refunds into finance"
```

---

### Task 46: Navigate refund notifications by recipient role

**Files:**
- Modify: `resources/js/components/shared/notification-sheet.tsx`

**Interfaces:**
- Consumes: notification `data.url` emitted in Task 11.
- Produces: marked-read refund navigation.

- [ ] **Step 1: Add refund icons and URL navigation**

Add all `order.refund_*` types to icon map. After successful or failed mark-read request, if `data.url` is a string beginning with `/`, close sheet and call `router.visit(data.url)`. Customer URL opens detail; owner URL opens finance queue. Do not derive route from role in frontend.

- [ ] **Step 2: Apply accessibility**

Notification buttons remain 44px minimum, unread state has text/screen-reader indicator in addition to color, and sheet title is associated with dialog container.

- [ ] **Step 3: Verify**

Run: `npm run types:check && npm run build`

Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add resources/js/components/shared/notification-sheet.tsx
git commit -m "feat: navigate refund notifications"
```

---

### Task 47: Run focused refund and security verification

**Files:** none.

**Interfaces:** verifies Tasks 1–46 without changing tracked files.

- [ ] Run focused lifecycle tests:

```bash
php artisan test \
  tests/Feature/RefundLifecycleSchemaTest.php \
  tests/Unit/RefundStatusHistoryTest.php \
  tests/Feature/RefundServiceTest.php \
  tests/Feature/RefundPayloadPrivacyTest.php \
  tests/Feature/RefundNotificationTest.php
```

Expected: exit 0; no failure/error.

- [ ] Run entry/payment/security tests:

```bash
php artisan test \
  tests/Feature/RefundEntryMatrixTest.php \
  tests/Feature/DokuPaymentAtomicTest.php \
  tests/Feature/DokuMarkPaidCommandTest.php \
  tests/Feature/DokuPaymentTest.php \
  tests/Feature/PaymentAuthorizationMutationTest.php \
  tests/Feature/UnpaidOutletProgressionTest.php \
  tests/Feature/GuestCancellationRouteTest.php \
  tests/Feature/RefundProofAccessTest.php
```

Expected: exit 0.

- [ ] Run role experience tests:

```bash
php artisan test \
  tests/Feature/CustomerRefundDestinationTest.php \
  tests/Feature/CustomerRefundExperienceTest.php \
  tests/Feature/GuestRefundExperienceTest.php \
  tests/Feature/OutletRefundExperienceTest.php \
  tests/Feature/OwnerManualRefundTest.php \
  tests/Feature/OwnerRefundWorkspaceTest.php \
  tests/Feature/RefundNotificationNavigationTest.php
```

Expected: exit 0.

- [ ] Run pure frontend test:

```bash
npm test -- tests/js/lib/order-reasons.test.ts
```

Expected: exit 0.

---

### Task 48: Run full project verification

**Files:** none.

- [ ] Run PHP formatting check:

```bash
vendor/bin/pint --test
```

Expected: exit 0.

- [ ] Run complete PHP suite:

```bash
php artisan test
```

Expected: exit 0; no failed tests.

- [ ] Run TypeScript check:

```bash
npm run types:check
```

Expected: exit 0.

- [ ] Run frontend production build:

```bash
npm run build
```

Expected: exit 0 and Vite production assets generated.

- [ ] Run frontend tests:

```bash
npm test
```

Expected: exit 0.

---

### Task 49: Perform final privacy, accessibility, and diff review

**Files:** none.

- [ ] Inspect route surface:

```bash
php artisan route:list --name=refund
```

Expected: customer destination, owner destination/start/reject/rollback/complete, owner index compatibility, and authenticated proof routes; no guest cancellation route.

- [ ] Search built page contracts and source for forbidden exposure:

```bash
rg "refund_(account_number|ewallet_number|proof_image)" app/Http/Controllers resources/js/pages
```

Expected: no customer/guest/outlet page serialization; owner DTO and storage controller references only where explicitly authorized.

- [ ] Search lifecycle ownership:

```bash
rg "payment_status.*refund_|refund_pending.*update|reopenRefund" app --glob '*.php'
```

Expected: lifecycle writes in `RefundService`; read-only comparisons elsewhere; no `PaymentStatusService::reopenRefund`.

- [ ] Inspect `git diff --check` and `git diff --stat`; expected no whitespace errors and only approved implementation files.

- [ ] Review rendered Owner, Customer, Outlet, and guest flows at 320px and desktop widths. Verify keyboard-only dialog/filter/form use, visible focus, descriptive proof/copy controls, minimum 44px action targets, `aria-current` selected owner queue, no color-only status meaning, and no guest/outlet sensitive fields in Inertia network payload.

- [ ] Dispatch whole-branch reviewer against merge-base diff. Critical or Important findings become additional red-green tasks, each capped at two tracked files, before repeating Tasks 47–49.

---

## Final Self-Review Matrix

| Approved spec section / item | Task(s) | Result |
|---|---:|---|
| Lifecycle schema and `refund_status_histories` | 1–3 | Destination status, immutable history, relations, indexes, and backfill defined. |
| Destination status missing/valid/invalid and backfill | 1, 3, 7–10 | Exact values and transition rules consistent. |
| Canonical guest by `customer.user_id` null | 3, 4, 7, 10–13, 22, 28–32 | Authorization, queues, notifications, and payloads use one definition. |
| `settled` enum/accessor compatibility | 5, 6 | Every DB enum value parses; settled cannot enter refund workflow. |
| Atomic request/destination/start/reject/rollback/complete | 7–9, 12 | Each status write and one history insert share transaction; failure rollback covered. |
| Refund snapshot rules and completion preservation | 7, 9, 15, 27 | Positive request snapshot; completion never reads current total. |
| Stock copy | 13, 14, 39–41 | New reasons canonical; exact legacy display normalized; historical data unchanged. |
| Full entry matrix | 13, 15, 16, 19 | Paid/unpaid cancellation, outlet rejection/cancellation, expiry, manual and late payment covered. |
| Late paid, including expired-to-paid | 6, 15 | 12-case matrix and duplicate proof defined. |
| DOKU unsigned redirect | 17 | Query state never mutates payment. |
| Payment authorization before mutation and guest recovery proof | 18 | Unauthorized method/status/transaction state remains unchanged; age bypass removed. |
| Unpaid outlet progression | 19, 31 | Request guard and role regression defined. |
| Guest cancellation route/action/UI block | 20, 21, 30, 41 | Routes absent; stale actions forbidden; UI removed. |
| Customer versus guest destination authorization | 7, 22, 26 | Canonical owner/customer matrix and service defense both defined. |
| Owner guest destination and rollback requests/actions | 22–27, 42, 44 | Phone verification acknowledgement, exact APIs, modes, reasons, and UI defined. |
| Private proof storage, stream, legacy public compatibility | 9, 27, 28, 38, 43 | Local storage, `private:` prefix, authorization matrix, and legacy lookup defined. |
| Role-aware Owner/Customer/Guest/Outlet payloads | 10, 29–32, 36 | Stable PHP/TS contracts and negative privacy assertions defined. |
| Owner seven queues/counts/pagination/finance/backward compatibility | 10, 27, 32, 44, 45 | Exact keys, 24h boundary, counts, pagination, tab, old URL redirect defined. |
| Customer real ID/form Select/history/full status card | 29, 36–39 | No zero ID, correct Select API, edit re-entry, terminal links, badges, seven states defined. |
| Outlet read-only badges/panel/no destination/proof | 31, 40 | Explicit DTO and UI boundary defined. |
| Guest read-only tracking/no cancel | 20, 21, 30, 41 | Status/amount/timeline/contact guidance only. |
| Notifications history-idempotent, owner operational, customer ID retrieval, navigation | 11, 12, 34, 46 | History key, recipient query, safe URLs, and UI navigation defined. |
| `flash.error` | 26, 27, 33 | Default and specialized Inertia roots aligned. |
| Stale 24h queue | 10, 32, 44 | Exact greater-than versus equal/older boundary defined; no automatic mutation. |
| `refund_failed` visibility | 3, 10, 29–32, 38, 40, 44 | Owner action-required and customer/outlet safe displays defined. |
| Exact privacy boundaries | 10, 11, 28–32, 38, 40, 41, 44, 49 | Positive owner access and negative role/page JSON assertions defined. |
| Accessibility requirements | 37–46, 49 | Labels, errors, focus, semantic status/timeline, 44px targets, `aria-current`, non-color meaning defined. |
| Focused/full PHP tests, types, build, final review | 47–49 | Exact commands and expected exit conditions defined. |

### Placeholder and type consistency result

- No undefined lifecycle method, route, queue key, event name, status value, destination value, notification key, or frontend refund type remains.
- PHP methods in Tasks 7–12 match controller consumers in Tasks 26–32.
- Payload fields in Task 10 match TypeScript declarations in Task 36 and component consumers in Tasks 37–46.
- Proof path prefix, proof URL, role authorization, and storage disk names match Tasks 9, 27, 28, 38, and 43.
- Queue keys and URLs match Tasks 10, 11, 27, 32, 36, 44, 45, and 46.
- Backend changes always pair implementation with a focused failing test and exact red/green commands.
- Every implementation task lists no more than two tracked files.

### Deliberate omissions

- No separate `refunds` aggregate: add only when partial or multiple refunds become approved requirements.
- No proof bulk migration: unprefixed legacy public records remain authorized-stream compatible; move them in a separately approved migration.
- No automatic stale rollback/rejection: 24-hour staleness changes queue placement only.
- No bank/e-wallet account verification integration: owner phone verification acknowledgement remains manual.
- No automatic handling action for legacy `refund_failed`: it remains visible as `Perlu Tindakan` without inventing an unapproved transition.
- No React component-test dependency or harness: project currently has Vitest only for pure TypeScript; critical role UI behavior is guarded by PHP Inertia payload tests, TypeScript compilation, production build, and manual accessibility review.
- No historical `Stok Habis` data rewrite: display normalization preserves audit text at rest.
