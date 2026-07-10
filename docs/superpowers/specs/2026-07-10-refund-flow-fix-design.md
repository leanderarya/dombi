# Refund Flow Fix — Design Spec

**Date:** 2026-07-10
**Status:** Approved
**Scope:** Fix refund logic across all order cancellation/expiry/rejection scenarios

---

## Problem Statement

Saat ini ada 6 gap dalam alur refund yang menyebabkan uang customer bisa hilang:

1. **Expired order + paid = tidak refund** — `handleSideEffects` tidak refund untuk `expired`
2. **Refund hanya ke credit, bukan ke sumber bayar** — QRIS/card refund hanya ke credit balance
3. **Tidak ada DOKU refund API** — Tidak ada cara reverse charge QRIS/card
4. **`payment_status` tidak update setelah refund** — Tetap `paid`, tidak ada dedup protection
5. **Race condition cancel vs DOKU webhook** — Webhook datang setelah order di-cancel
6. **Partial credit refund salah** — Refund full amount, bukan net amount

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Refund destination | Credit balance | Standar industri food delivery, uang tetap di ekosistem |
| Expired + paid | Auto refund ke credit | Customer tidak kehilangan uang |
| Race condition | Bayar dulu, auto-refund | Payment tetap dicatat, refund langsung jalan |
| Payment status | Tambah `refunded` | Tracking jelas, dedup protection |
| Partial credit | Refund net amount | `order.total - credit_applied` |
| Notification | Kirim ke customer | Customer tahu uangnya kembali |
| Tracking | Tambah kolom di orders | Audit trail jelas |

---

## Payment Status State Machine

```
null → pending → paid → refunded
                  ↓
              expired / failed
```

- `null` — Order created, no payment attempted
- `pending` — DOKU session created, awaiting payment
- `paid` — Payment confirmed
- `refunded` — Refund ke credit balance (terminal)
- `expired` — DOKU session timed out
- `failed` — DOKU payment rejected

---

## Refund Formula

```
refund_amount = order.total - COALESCE(order.credit_applied, 0)
```

| Scenario | Order Total | Credit Applied | Refund Amount |
|----------|-------------|----------------|---------------|
| Full DOKU | Rp 50.000 | Rp 0 | Rp 50.000 |
| Partial credit | Rp 50.000 | Rp 20.000 | Rp 30.000 |
| Full credit | Rp 50.000 | Rp 50.000 | Rp 0 (no refund needed) |

---

## Trigger Points

### Refund Triggered

| Event | Condition | Action |
|-------|-----------|--------|
| `cancelled_by_customer` | `payment_status = paid` | Refund net amount ke credit |
| `cancelled_by_outlet` | `payment_status = paid` | Refund net amount ke credit |
| `rejected_by_outlet` | `payment_status = paid` | Refund net amount ke credit |
| `expired` | `payment_status = paid` | Refund net amount ke credit |
| `failed_delivery` → `cancelled_and_released` | `payment_status = paid` | Refund net amount ke credit |
| DOKU webhook → order terminal | `payment_status` baru `paid` | Mark paid + auto-refund |

### Refund NOT Triggered

| Event | Reason |
|-------|--------|
| `expired` + `payment_status = null/pending/failed` | Belum ada uang masuk |
| `cancelled_by_customer` + `payment_status = null/pending` | Belum ada uang masuk |
| `failed_delivery` (belum resolve) | Order masih aktif, stok di-hold |

---

## Race Condition Handling

### Scenario: Cancel → DOKU Webhook

```
1. Customer cancel order (payment_status = pending)
2. Order → cancelled_by_customer, stock released
3. DOKU webhook datang (payment confirmed)
4. Mark order: payment_status = paid, paid_at = now()
5. Cek: order status terminal? → Ya
6. Auto-refund: refund_amount ke credit, payment_status = refunded
7. Notifikasi customer: "Refund Rp X masuk ke credit"
```

### Scenario: Expire → DOKU Webhook

```
1. ExpirePendingOrders jalan, order expired
2. Cek payment_status = paid? → Tidak (pending)
3. Order → expired, stock released
4. DOKU webhook datang (payment confirmed)
5. Mark order: payment_status = paid
6. Cek: order status terminal? → Ya
7. Auto-refund: refund_amount ke credit, payment_status = refunded
8. Notifikasi customer
```

### Scenario: Already Refunded → Duplicate Webhook

```
1. Order sudah payment_status = refunded
2. DOKU webhook datang lagi (duplicate)
3. Cek: payment_status = refunded → Skip, log warning
```

---

## Database Changes

### Migration: Add refund columns to orders table

```php
Schema::table('orders', function (Blueprint $table) {
    $table->timestamp('refunded_at')->nullable()->after('paid_at');
    $table->decimal('refund_amount', 12, 2)->nullable()->after('refunded_at');
    $table->string('refund_reason')->nullable()->after('refund_amount');
});
```

### Migration: Add 'refunded' to payment_status enum

```php
// MySQL: ALTER TABLE orders MODIFY payment_status ENUM(..., 'refunded')
// SQLite: no enum constraint, just update code validation
```

---

## Code Changes

### 1. OrderStatusService — handleSideEffects()

**File:** `app/Services/OrderStatusService.php`

```php
private function handleSideEffects(Order $order, string $from, string $to, array $ctx): void
{
    // Stock release on cancellation/expiration/rejection
    if (in_array($to, ['cancelled_by_customer', 'cancelled_by_outlet', 'rejected_by_outlet', 'expired', 'failed_delivery'], true)) {
        $this->inventoryService->releaseReservedStock($order);
    }

    // Refund on cancellation/expiration/rejection (if paid)
    if (in_array($to, ['cancelled_by_customer', 'cancelled_by_outlet', 'rejected_by_outlet', 'expired'], true)) {
        if ($order->payment_status === 'paid') {
            $this->refundToCredit($order, $to);
        }
    }

    // Settlement on completion
    if ($to === Order::STATUS_COMPLETED) {
        $this->inventoryService->completeOrderStock($order);
        $this->settlementService->recordSale($order);
        if ($order->outlet_id) {
            $outlet = Outlet::find($order->outlet_id);
            if ($outlet) {
                $this->settlementGeneratorService->generateForOutlet($outlet, now());
            }
        }
    }
}
```

### 2. OrderStatusService — refundToCredit()

**New method:**

```php
private function refundToCredit(Order $order, string $reason): void
{
    $refundAmount = $order->total - ($order->credit_applied ?? 0);

    if ($refundAmount <= 0) {
        // Fully paid by credit, already handled by credit reversal
        return;
    }

    // Idempotency check
    if ($order->payment_status === 'refunded') {
        return;
    }

    // Add credit to customer
    $customer = $order->customer;
    if ($customer) {
        app(CustomerCreditService::class)->addCredit(
            $customer,
            $refundAmount,
            "Refund order #{$order->order_code}"
        );
    }

    // Update order
    $order->update([
        'payment_status' => 'refunded',
        'refunded_at' => now(),
        'refund_amount' => $refundAmount,
        'refund_reason' => $reason,
    ]);

    // Notify customer
    app(NotificationService::class)->notifyRefundProcessed($order, $refundAmount);
}
```

### 3. CustomerCreditService — addCredit()

**New method** (separate from `refund()` yang existing):

```php
public function addCredit(Customer $customer, float $amount, string $description): void
{
    $customer->increment('credit_balance', $amount);

    $customer->creditTransactions()->create([
        'type' => 'refund',
        'amount' => $amount,
        'balance_after' => $customer->fresh()->credit_balance,
        'description' => $description,
    ]);
}
```

### 4. DokuService — markOrderPaid() Race Condition Fix

**File:** `app/Services/DokuService.php`

```php
private function markOrderPaid(Order $order): void
{
    // Atomic update — only one concurrent request can succeed
    $updated = Order::where('id', $order->id)
        ->where('payment_status', '!=', 'paid')
        ->where('payment_status', '!=', 'refunded')
        ->update([
            'paid_at' => now(),
            'payment_status' => 'paid',
        ]);

    if ($updated === 0) {
        return; // Already paid or refunded by concurrent request
    }

    // Reload to get fresh state
    $order->refresh();

    // Check if order is in terminal state (race condition)
    $terminalStatuses = [
        Order::STATUS_CANCELLED_BY_CUSTOMER,
        Order::STATUS_CANCELLED_BY_OUTLET,
        Order::STATUS_REJECTED_BY_OUTLET,
        Order::STATUS_EXPIRED,
    ];

    if (in_array($order->status, $terminalStatuses, true)) {
        // Payment arrived after cancellation/expiry — auto-refund
        $this->refundToCredit($order, 'Race condition: payment after ' . $order->status);
        return;
    }

    // Normal flow: transition order status
    if ($order->status === Order::STATUS_PENDING_CONFIRMATION) {
        try {
            app(OrderStatusService::class)->updateStatus($order, Order::STATUS_CONFIRMED);
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::info('Order status transition skipped', [
                'order_id' => $order->id,
                'current_status' => $order->fresh()->status,
            ]);
        }
    }

    // Notify outlet
    app(NotificationService::class)->notifyOrderCreated($order);

    Cache::forget("outlet:{$order->outlet_id}:pending_orders");
    Cache::forget('owner:pending_counts');
    Cache::forget('owner:order_stats');
}
```

### 5. ExpirePendingOrders — Refund Before Expire

**File:** `app/Console/Commands/ExpirePendingOrders.php`

```php
// Before marking expired, check if paid
if ($order->payment_status === 'paid') {
    // Refund first, then expire
    $this->orderStatusService->expireOrder($order, 'Confirmation timeout');
    // expireOrder → transition → handleSideEffects → refundToCredit
} else {
    $this->orderStatusService->expireOrder($order, 'Confirmation timeout');
}
```

### 6. DokuService — Add Refunded Check

**File:** `app/Services/DokuService.php`

```php
// In processPaymentStatusChange() or wherever payment status is checked
if ($order->payment_status === 'refunded') {
    Log::warning('Attempted to process payment for refunded order', [
        'order_id' => $order->id,
    ]);
    return;
}
```

### 7. NotificationService — notifyRefundProcessed()

**New method:**

```php
public function notifyRefundProcessed(Order $order, float $amount): void
{
    // Push notification to customer
    $this->sendPushNotification(
        $order->customer_id,
        'Refund Diproses',
        "Refund " . number_format($amount, 0, ',', '.') . " masuk ke credit balance Anda. Order #{$order->order_code} dibatalkan.",
        ['order_id' => $order->id]
    );

    // Also notify via WhatsApp if available
    if ($order->customer_phone) {
        $this->sendWhatsApp(
            $order->customer_phone,
            "Refund Rp " . number_format($amount, 0, ',', '.') . " telah masuk ke credit balance Dombi Anda. Gunakan untuk order berikutnya!"
        );
    }
}
```

---

## Order Model Changes

**File:** `app/Models/Order.php`

```php
protected $fillable = [
    // ... existing fields ...
    'refunded_at',
    'refund_amount',
    'refund_reason',
];

protected function casts(): array
{
    return [
        // ... existing casts ...
        'refunded_at' => 'datetime',
        'refund_amount' => 'decimal:2',
    ];
}
```

---

## Affected Scenarios Matrix

| Scenario | payment_status before | payment_status after | Credit Change | Notification |
|----------|----------------------|---------------------|---------------|--------------|
| Cancel unpaid | null/pending | null/pending | 0 | No |
| Cancel paid (no credit) | paid | refunded | +order.total | Yes |
| Cancel paid (partial credit) | paid | refunded | +(total - credit_applied) | Yes |
| Cancel paid (full credit) | paid | paid | 0 | No |
| Expire unpaid | null/pending | null/pending | 0 | No |
| Expire paid | paid | refunded | +refund_amount | Yes |
| Reject paid | paid | refunded | +refund_amount | Yes |
| Delivery fail → cancel paid | paid | refunded | +refund_amount | Yes |
| DOKU webhook after cancel | paid | refunded | +refund_amount | Yes |
| DOKU webhook after refund | refunded | refunded | 0 (skip) | No |

---

## Testing Strategy

### Unit Tests

1. `refundToCredit()` — calculates correct net amount
2. `refundToCredit()` — idempotent (payment_status = refunded → skip)
3. `refundToCredit()` — full credit → no refund
4. `markOrderPaid()` — terminal state → auto-refund
5. `markOrderPaid()` — already refunded → skip

### Integration Tests

1. Customer cancel paid order → refund + notification
2. Outlet cancel paid order → refund + notification
3. Expire paid order → refund + notification
4. DOKU webhook after cancel → auto-refund
5. Duplicate webhook → skip
6. Partial credit cancel → correct refund amount

---

## Implementation Order

1. Migration: add refund columns + refunded enum
2. Order model: add fillable/casts
3. CustomerCreditService: add `addCredit()` method
4. OrderStatusService: add `refundToCredit()` + update `handleSideEffects()`
5. DokuService: fix `markOrderPaid()` race condition
6. ExpirePendingOrders: ensure refund triggers
7. NotificationService: add `notifyRefundProcessed()`
8. Tests

---

## Files to Modify

| File | Change |
|------|--------|
| `database/migrations/xxx_add_refund_columns_to_orders.php` | New migration |
| `app/Models/Order.php` | Add fillable, casts |
| `app/Services/CustomerCreditService.php` | Add `addCredit()` method |
| `app/Services/OrderStatusService.php` | Add `refundToCredit()`, update `handleSideEffects()` |
| `app/Services/DokuService.php` | Fix `markOrderPaid()` race condition |
| `app/Console/Commands/ExpirePendingOrders.php` | Ensure refund triggers |
| `app/Services/NotificationService.php` | Add `notifyRefundProcessed()` |
| `tests/Feature/RefundFlowTest.php` | New test file |
