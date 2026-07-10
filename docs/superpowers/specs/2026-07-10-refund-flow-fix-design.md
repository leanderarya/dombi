# Refund Flow Fix — Design Spec

**Date:** 2026-07-10  
**Status:** Approved  
**Scope:** Refund via DOKU API + hapus credit system

---

## Problem Statement

Saat ini ada 6 gap dalam alur refund:

1. **Expired order + paid = tidak refund** — `handleSideEffects` tidak refund untuk `expired`
2. **Refund hanya ke credit, bukan ke sumber bayar** — QRIS/card refund hanya ke credit balance
3. **Tidak ada DOKU refund API** — Tidak ada cara reverse charge QRIS/card
4. **`payment_status` tidak update setelah refund** — Tetap `paid`, tidak ada dedup protection
5. **Race condition cancel vs DOKU webhook** — Webhook datang setelah order di-cancel
6. **Credit system security risk** — Credit balance rentan di-abuse

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Refund method | DOKU Refund API | Uang balik ke sumber bayar (QRIS/card), aman |
| Credit system | **Dihapus** | Security risk, tidak dipakai |
| Expired + paid | Auto refund via DOKU | Customer tidak kehilangan uang |
| Race condition | Bayar dulu, auto-refund | Payment tetap dicatat, refund langsung jalan |
| Payment status | Tambah `refunded`, `refund_failed` | Tracking jelas, dedup protection |
| Failed refund | Manual review queue | Owner trigger manual dari dashboard |
| Notification | Kirim ke customer | Customer tahu uangnya kembali |
| Tracking | Tambah kolom di orders | Audit trail jelas |

---

## Payment Status State Machine

```
null → pending → paid → refunded
                  ↓
              refund_failed → (manual refund) → refunded
              expired / failed
```

| Status | Meaning |
|--------|---------|
| `null` | Order created, no payment attempted |
| `pending` | DOKU session created, awaiting payment |
| `paid` | Payment confirmed |
| `refunded` | Refund via DOKU berhasil, uang balik ke customer |
| `refund_failed` | Refund via DOKU gagal, perlu manual review |
| `expired` | DOKU session timed out |
| `failed` | DOKU payment rejected |

---

## Refund Flow

```
Order cancelled/expired/rejected + payment_status = paid
  └─ Call DOKU Refund API
      ├─ Success
      │   ├─ payment_status = refunded
      │   ├─ refunded_at = now()
      │   ├─ refund_amount = order.total
      │   └─ Notifikasi customer
      └─ Failed (error/timeout/rejected)
          ├─ payment_status = refund_failed
          ├─ Masuk refund queue
          └─ Owner trigger manual refund dari dashboard
```

---

## Trigger Points

### Refund Triggered

| Event | Condition | Action |
|-------|-----------|--------|
| `cancelled_by_customer` | `payment_status = paid` | Call DOKU refund |
| `cancelled_by_outlet` | `payment_status = paid` | Call DOKU refund |
| `rejected_by_outlet` | `payment_status = paid` | Call DOKU refund |
| `expired` | `payment_status = paid` | Call DOKU refund |
| `failed_delivery` → `cancelled_and_released` | `payment_status = paid` | Call DOKU refund |
| DOKU webhook → order terminal | `payment_status` baru `paid` | Mark paid + auto-refund |

### Refund NOT Triggered

| Event | Reason |
|-------|--------|
| `expired` + `payment_status = null/pending/failed` | Belum ada uang masuk |
| `cancelled_by_customer` + `payment_status = null/pending` | Belum ada uang masuk |
| `failed_delivery` (belum resolve) | Order masih aktif, stok di-hold |
| `payment_status = refunded` | Sudah di-refund (idempotent) |
| `payment_method = cash` | Bayar di tempat, tidak perlu refund |

---

## Race Condition Handling

### Scenario: Cancel → DOKU Webhook

```
1. Customer cancel order (payment_status = pending)
2. Order → cancelled_by_customer, stock released
3. DOKU webhook datang (payment confirmed)
4. Mark order: payment_status = paid, paid_at = now()
5. Cek: order status terminal? → Ya
6. Auto-refund via DOKU API
7. Success → payment_status = refunded
8. Failed → payment_status = refund_failed, masuk queue
9. Notifikasi customer
```

### Scenario: Expire → DOKU Webhook

```
1. ExpirePendingOrders jalan, order expired
2. Cek payment_status = paid? → Tidak (pending)
3. Order → expired, stock released
4. DOKU webhook datang (payment confirmed)
5. Mark order: payment_status = paid
6. Cek: order status terminal? → Ya
7. Auto-refund via DOKU API
8. Notifikasi customer
```

### Scenario: Already Refunded → Duplicate Webhook

```
1. Order sudah payment_status = refunded
2. DOKU webhook datang lagi (duplicate)
3. Cek: payment_status = refunded → Skip, log warning
```

### Scenario: Refund Failed → Manual Retry

```
1. Auto-refund gagal (DOKU error)
2. payment_status = refund_failed
3. Masuk refund queue di owner dashboard
4. Owner klik "Retry Refund"
5. Call DOKU refund API lagi
6. Success → payment_status = refunded
7. Failed → tetap di queue, owner bisa retry lagi
```

---

## Database Changes

### Migration: Add refund columns to orders table

```php
Schema::table('orders', function (Blueprint $table) {
    $table->timestamp('refunded_at')->nullable()->after('paid_at');
    $table->decimal('refund_amount', 12, 2)->nullable()->after('refunded_at');
    $table->string('refund_reason')->nullable()->after('refund_amount');
    $table->string('doku_refund_id')->nullable()->after('refund_reason');
});
```

### Migration: Remove credit columns from orders table

```php
Schema::table('orders', function (Blueprint $table) {
    $table->dropColumn('credit_applied');
});
```

### Migration: Remove customer_credits table

```php
Schema::dropIfExists('customer_credits');
```

### Migration: Remove credit_balance from customers table

```php
Schema::table('customers', function (Blueprint $table) {
    $table->dropColumn('credit_balance');
});
```

---

## DOKU Refund API Integration

### Credit Card Refund

**Endpoint:** `POST /v1/refund`

```json
{
    "order": {
        "invoice_number": "DOMBI-20260710-0001"
    },
    "payment": {
        "original_request_id": "DMB-123-1689000000"
    },
    "refund": {
        "amount": 50000,
        "type": "FULL_REFUND"
    }
}
```

### QRIS / E-Wallet Refund

**Endpoint:** `POST /direct-debit/core/v1/debit/refund`

```json
{
    "originalPartnerReferenceNo": "DOMBI-20260710-0001",
    "partnerRefundNo": "REF-DOMBI-20260710-0001",
    "refundAmount": {
        "value": "50000.00",
        "currency": "IDR"
    },
    "reason": "Order cancelled by customer"
}
```

### Response Handling

```json
// Success
{
    "refund": {
        "status": "SUCCESS",
        "message": "Approved"
    }
}

// Failed
{
    "refund": {
        "status": "FAILED",
        "reason": "Total Refund amount is Bigger than Original Transaction"
    },
    "error": {
        "code": "PAYMENT_FAILED",
        "message": "..."
    }
}
```

---

## Code Changes

### 1. DokuService — refund()

**New method:**

```php
public function refund(Order $order, string $reason = 'Order cancelled'): array
{
    if ($order->payment_status !== 'paid') {
        throw new \Exception('Cannot refund unpaid order');
    }

    if ($order->payment_status === 'refunded') {
        return ['status' => 'already_refunded'];
    }

    $refundNo = 'REF-' . $order->order_code . '-' . time();
    $amount = (float) $order->total;

    // Determine refund type based on payment method
    if ($order->payment_method === 'credit_card') {
        $result = $this->refundCreditCard($order, $refundNo, $amount, $reason);
    } else {
        // QRIS / e-wallet
        $result = $this->refundDirectDebit($order, $refundNo, $amount, $reason);
    }

    return $result;
}

private function refundCreditCard(Order $order, string $refundNo, float $amount, string $reason): array
{
    $requestId = $refundNo;
    $timestamp = now('UTC')->format('Y-m-d\TH:i:s\Z');

    $body = [
        'order' => [
            'invoice_number' => $order->order_code,
        ],
        'payment' => [
            'original_request_id' => $order->doku_order_id,
        ],
        'refund' => [
            'amount' => (int) $amount,
            'type' => 'FULL_REFUND',
        ],
    ];

    $signature = $this->generateSignature('POST', '/v1/refund', $requestId, $timestamp, json_encode($body));

    $response = Http::withHeaders([
        'Client-Id' => $this->clientId,
        'Request-Id' => $requestId,
        'Request-Timestamp' => $timestamp,
        'Signature' => $signature,
        'Content-Type' => 'application/json',
    ])->post($this->baseUrl . '/v1/refund', $body);

    return $this->handleRefundResponse($order, $response->json(), $refundNo);
}

private function refundDirectDebit(Order $order, string $refundNo, float $amount, string $reason): array
{
    $body = [
        'originalPartnerReferenceNo' => $order->order_code,
        'partnerRefundNo' => $refundNo,
        'refundAmount' => [
            'value' => number_format($amount, 2, '.', ''),
            'currency' => 'IDR',
        ],
        'reason' => $reason,
        'additionalInfo' => [
            'originalExternalId' => $order->doku_order_id,
        ],
    ];

    $response = Http::withHeaders([
        'Content-Type' => 'application/json',
        'Authorization' => $this->generateAuthHeader(),
    ])->post($this->baseUrl . '/direct-debit/core/v1/debit/refund', $body);

    return $this->handleRefundResponse($order, $response->json(), $refundNo);
}

private function handleRefundResponse(Order $order, array $response, string $refundNo): array
{
    $isSuccess = ($response['refund']['status'] ?? '') === 'SUCCESS'
        || ($response['transactionStatus'] ?? '') === 'SUCCESS';

    if ($isSuccess) {
        $order->update([
            'payment_status' => 'refunded',
            'refunded_at' => now(),
            'refund_amount' => $order->total,
            'refund_reason' => $order->refund_reason ?? 'Order cancelled',
            'doku_refund_id' => $refundNo,
        ]);

        app(NotificationService::class)->notifyRefundProcessed($order, (float) $order->total);

        return ['status' => 'success', 'refund_id' => $refundNo];
    }

    // Refund failed
    $errorMessage = $response['error']['message'] ?? $response['refund']['reason'] ?? 'Unknown error';

    $order->update([
        'payment_status' => 'refund_failed',
        'refund_reason' => $errorMessage,
    ]);

    Log::error('DOKU refund failed', [
        'order_id' => $order->id,
        'order_code' => $order->order_code,
        'error' => $errorMessage,
        'response' => $response,
    ]);

    return ['status' => 'failed', 'error' => $errorMessage];
}
```

### 2. OrderStatusService — handleSideEffects()

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
            $this->processRefund($order, $to);
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

private function processRefund(Order $order, string $reason): void
{
    // Idempotency check
    if (in_array($order->payment_status, ['refunded', 'refund_failed'], true)) {
        return;
    }

    // Cash orders don't need refund
    if ($order->payment_method === 'cash') {
        return;
    }

    try {
        $result = app(DokuService::class)->refund($order, $reason);

        if ($result['status'] === 'failed') {
            Log::warning('Refund failed, queued for manual review', [
                'order_id' => $order->id,
                'error' => $result['error'] ?? 'Unknown',
            ]);
        }
    } catch (\Exception $e) {
        Log::error('Refund exception', [
            'order_id' => $order->id,
            'error' => $e->getMessage(),
        ]);

        $order->update([
            'payment_status' => 'refund_failed',
            'refund_reason' => $e->getMessage(),
        ]);
    }
}
```

### 3. DokuService — markOrderPaid() Race Condition Fix

```php
private function markOrderPaid(Order $order): void
{
    $updated = Order::where('id', $order->id)
        ->where('payment_status', '!=', 'paid')
        ->where('payment_status', '!=', 'refunded')
        ->where('payment_status', '!=', 'refund_failed')
        ->update([
            'paid_at' => now(),
            'payment_status' => 'paid',
        ]);

    if ($updated === 0) {
        return;
    }

    $order->refresh();

    // Race condition: payment arrived after order terminal
    $terminalStatuses = [
        Order::STATUS_CANCELLED_BY_CUSTOMER,
        Order::STATUS_CANCELLED_BY_OUTLET,
        Order::STATUS_REJECTED_BY_OUTLET,
        Order::STATUS_EXPIRED,
    ];

    if (in_array($order->status, $terminalStatuses, true)) {
        $this->refund($order, 'Race condition: payment after ' . $order->status);
        return;
    }

    // Normal flow
    if ($order->status === Order::STATUS_PENDING_CONFIRMATION) {
        try {
            app(OrderStatusService::class)->updateStatus($order, Order::STATUS_CONFIRMED);
        } catch (\Exception $e) {
            Log::info('Order status transition skipped', [
                'order_id' => $order->id,
                'current_status' => $order->fresh()->status,
            ]);
        }
    }

    app(NotificationService::class)->notifyOrderCreated($order);

    Cache::forget("outlet:{$order->outlet_id}:pending_orders");
    Cache::forget('owner:pending_counts');
    Cache::forget('owner:order_stats');
}
```

### 4. Owner Dashboard — Refund Queue

**New page:** `resources/js/pages/owner/finance/refund-tab.tsx`

```tsx
// Shows orders with payment_status = 'refund_failed'
// Actions: Retry Refund, Mark as Resolved
```

**New controller:** `app/Http/Controllers/Owner/RefundController.php`

```php
class RefundController extends Controller
{
    public function index() { /* List refund_failed orders */ }
    public function retry(Order $order) { /* Retry DOKU refund */ }
    public function resolve(Order $order) { /* Mark as manually resolved */ }
}
```

### 5. NotificationService — notifyRefundProcessed()

```php
public function notifyRefundProcessed(Order $order, float $amount): void
{
    $formattedAmount = 'Rp ' . number_format($amount, 0, ',', '.');

    $this->sendPushNotification(
        $order->customer_id,
        'Refund Berhasil',
        "{$formattedAmount} telah dikembalikan ke akun DOKU Anda. Order #{$order->order_code} dibatalkan.",
        ['order_id' => $order->id]
    );

    if ($order->customer_phone) {
        $this->sendWhatsApp(
            $order->customer_phone,
            "Refund {$formattedAmount} telah diproses untuk order #{$order->order_code}. Dana akan kembali ke metode pembayaran Anda dalam 1-3 hari kerja."
        );
    }
}
```

---

## Files to Remove (Credit System)

| File | Reason |
|------|--------|
| `app/Services/CustomerCreditService.php` | Tidak dipakai |
| `app/Models/CustomerCredit.php` | Tidak dipakai |
| `database/migrations/*_create_customer_credits_table.php` | Tidak dipakai |
| `app/Http/Controllers/Customer/CreditController.php` | Tidak dipakai (jika ada) |
| `resources/js/pages/customer/credit*` | Tidak dipakai (jika ada) |

---

## Files to Modify

| File | Change |
|------|--------|
| `database/migrations/xxx_add_refund_columns_to_orders.php` | New migration |
| `database/migrations/xxx_remove_credit_system.php` | Drop customer_credits, credit columns |
| `app/Models/Order.php` | Add refund fillable/casts, remove credit_applied |
| `app/Services/DokuService.php` | Add `refund()`, fix `markOrderPaid()` |
| `app/Services/OrderStatusService.php` | Update `handleSideEffects()`, remove credit logic |
| `app/Services/NotificationService.php` | Add `notifyRefundProcessed()` |
| `app/Http/Controllers/Owner/RefundController.php` | New controller for refund queue |
| `resources/js/pages/owner/finance/refund-tab.tsx` | New refund queue UI |
| `routes/web.php` | Add refund routes |
| `tests/Feature/RefundFlowTest.php` | New test file |

---

## Affected Scenarios Matrix

| Scenario | payment_status before | payment_status after | DOKU Refund | Notification |
|----------|----------------------|---------------------|-------------|--------------|
| Cancel unpaid | null/pending | null/pending | No | No |
| Cancel paid (DOKU) | paid | refunded | Yes | Yes |
| Cancel paid (cash) | paid | paid | No (skip) | No |
| Expire unpaid | null/pending | null/pending | No | No |
| Expire paid | paid | refunded | Yes | Yes |
| Reject paid | paid | refunded | Yes | Yes |
| Delivery fail → cancel paid | paid | refunded | Yes | Yes |
| DOKU refund success | paid | refunded | - | Yes |
| DOKU refund failed | paid | refund_failed | Failed | No (queue) |
| DOKU webhook after cancel | paid | refunded | Auto | Yes |
| DOKU webhook after refund | refunded | refunded | Skip | No |
| Manual retry → success | refund_failed | refunded | Retry | Yes |

---

## Testing Strategy

### Unit Tests

1. `DokuService::refund()` — credit card refund success
2. `DokuService::refund()` — QRIS refund success
3. `DokuService::refund()` — refund failed → status = refund_failed
4. `DokuService::refund()` — already refunded → skip
5. `DokuService::refund()` — cash order → skip
6. `markOrderPaid()` — terminal state → auto-refund
7. `markOrderPaid()` — already refunded → skip

### Integration Tests

1. Customer cancel paid order → DOKU refund + notification
2. Outlet cancel paid order → DOKU refund + notification
3. Expire paid order → DOKU refund + notification
4. DOKU webhook after cancel → auto-refund
5. Duplicate webhook → skip
6. Refund failed → queue → manual retry → success

---

## Implementation Order

1. Migration: add refund columns, remove credit columns
2. Order model: update fillable/casts
3. DokuService: add refund methods
4. OrderStatusService: update handleSideEffects()
5. DokuService: fix markOrderPaid() race condition
6. NotificationService: add notifyRefundProcessed()
7. Owner dashboard: refund queue UI
8. Remove credit system files
9. Tests
