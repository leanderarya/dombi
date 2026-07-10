# Refund Flow Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement DOKU refund API integration and remove credit system

**Architecture:** DokuService gets new `refund()` method that calls DOKU API. OrderStatusService triggers refund on cancellation/expiry. Failed refunds go to manual review queue. Credit system removed entirely.

**Tech Stack:** Laravel 13, React 19, Inertia.js, DOKU API

---

## File Structure

### Files to DELETE
| File | Reason |
|------|--------|
| `app/Services/CustomerCreditService.php` | Credit system removed |
| `app/Models/CustomerCredit.php` | Credit system removed |
| `database/migrations/2026_07_06_000001_create_customer_credits_table.php` | Credit system removed |

### Files to CREATE
| File | Purpose |
|------|---------|
| `database/migrations/2026_07_10_140000_add_refund_columns_to_orders_table.php` | Refund tracking columns |
| `database/migrations/2026_07_10_140100_remove_credit_system.php` | Drop credit tables/columns |
| `app/Http/Controllers/Owner/RefundController.php` | Manual refund queue |
| `resources/js/pages/owner/finance/refund-tab.tsx` | Refund queue UI |
| `tests/Feature/RefundFlowTest.php` | Refund tests |

### Files to MODIFY
| File | Change |
|------|--------|
| `app/Models/Order.php` | Add refund fillable/casts, remove credit_applied |
| `app/Models/Customer.php` | Remove credit_balance |
| `app/Services/DokuService.php` | Add `refund()`, fix `markOrderPaid()` |
| `app/Services/OrderStatusService.php` | Update `handleSideEffects()`, remove credit refs |
| `app/Services/OrderService.php` | Remove credit application logic |
| `app/Http/Controllers/Customer/CheckoutController.php` | Remove use_credit |
| `app/Services/NotificationService.php` | Add `notifyRefundProcessed()` |
| `resources/js/pages/customer/checkout/payment.tsx` | Remove credit toggle |
| `resources/js/pages/customer/orders/show.tsx` | Remove credit_applied display |
| `routes/web.php` | Add refund routes |

---

## Task 1: Migration — Add Refund Columns

**Files:**
- Create: `database/migrations/2026_07_10_140000_add_refund_columns_to_orders_table.php`

- [ ] **Step 1: Create migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('refunded_at')->nullable()->after('paid_at');
            $table->decimal('refund_amount', 12, 2)->nullable()->after('refunded_at');
            $table->string('refund_reason')->nullable()->after('refund_amount');
            $table->string('doku_refund_id')->nullable()->after('refund_reason');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['refunded_at', 'refund_amount', 'refund_reason', 'doku_refund_id']);
        });
    }
};
```

- [ ] **Step 2: Run migration**

Run: `php artisan migrate`
Expected: Migration ran successfully

- [ ] **Step 3: Commit**

```bash
git add database/migrations/2026_07_10_140000_add_refund_columns_to_orders_table.php
git commit -m "feat: add refund columns to orders table"
```

---

## Task 2: Migration — Remove Credit System

**Files:**
- Create: `database/migrations/2026_07_10_140100_remove_credit_system.php`

- [ ] **Step 1: Create migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('customer_credits');

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('credit_applied');
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('credit_balance');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->decimal('credit_balance', 12, 2)->default(0)->after('phone');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('credit_applied', 12, 2)->nullable()->after('total');
        });

        Schema::create('customer_credits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->string('type');
            $table->decimal('amount', 12, 2);
            $table->decimal('balance_after', 12, 2);
            $table->string('description')->nullable();
            $table->timestamps();
        });
    }
};
```

- [ ] **Step 2: Run migration**

Run: `php artisan migrate`
Expected: Migration ran successfully

- [ ] **Step 3: Commit**

```bash
git add database/migrations/2026_07_10_140100_remove_credit_system.php
git commit -m "feat: remove credit system tables and columns"
```

---

## Task 3: Update Order Model

**Files:**
- Modify: `app/Models/Order.php`

- [ ] **Step 1: Update $fillable — add refund columns, remove credit_applied**

Replace line 104:
```php
'completed_at', 'credit_applied',
```
With:
```php
'completed_at', 'refunded_at', 'refund_amount', 'refund_reason', 'doku_refund_id',
```

- [ ] **Step 2: Update casts — add refund casts, remove credit_applied**

Replace line 143:
```php
'credit_applied' => 'decimal:2',
```
With:
```php
'refunded_at' => 'datetime',
'refund_amount' => 'decimal:2',
```

- [ ] **Step 3: Run syntax check**

Run: `php -l app/Models/Order.php`
Expected: No syntax errors

- [ ] **Step 4: Commit**

```bash
git add app/Models/Order.php
git commit -m "feat: update Order model for refund tracking"
```

---

## Task 4: Update Customer Model

**Files:**
- Modify: `app/Models/Customer.php`

- [ ] **Step 1: Remove credit_balance from $fillable**

Remove `'credit_balance',` from `$fillable` array (line 21).

- [ ] **Step 2: Remove credit_balance from casts**

Remove `'credit_balance' => 'decimal:2',` from `casts()` (line 29).

- [ ] **Step 3: Run syntax check**

Run: `php -l app/Models/Customer.php`
Expected: No syntax errors

- [ ] **Step 4: Commit**

```bash
git add app/Models/Customer.php
git commit -m "feat: remove credit_balance from Customer model"
```

---

## Task 5: DokuService — Add Refund Methods

**Files:**
- Modify: `app/Services/DokuService.php`

- [ ] **Step 1: Add refund() public method**

Add after `syncStatusFromDoku()` method:

```php
/**
 * Process refund via DOKU API.
 * Returns ['status' => 'success'|'failed'|'already_refunded'|'skipped', ...]
 */
public function refund(Order $order, string $reason = 'Order cancelled'): array
{
    if ($order->payment_status === 'refunded') {
        return ['status' => 'already_refunded'];
    }

    if ($order->payment_status !== 'paid') {
        return ['status' => 'skipped', 'reason' => 'Order not paid'];
    }

    if ($order->payment_method === 'cash') {
        return ['status' => 'skipped', 'reason' => 'Cash payment'];
    }

    $refundNo = 'REF-' . $order->order_code . '-' . time();
    $amount = (int) $order->total;

    if ($order->payment_method === 'credit_card') {
        return $this->refundCreditCard($order, $refundNo, $amount, $reason);
    }

    return $this->refundDirectDebit($order, $refundNo, $amount, $reason);
}
```

- [ ] **Step 2: Add refundCreditCard() private method**

```php
private function refundCreditCard(Order $order, string $refundNo, int $amount, string $reason): array
{
    $requestId = $refundNo;
    $timestamp = now('UTC')->format('Y-m-d\TH:i:s\Z');
    $endpoint = '/v1/refund';

    $body = [
        'order' => [
            'invoice_number' => $order->order_code,
        ],
        'payment' => [
            'original_request_id' => $order->doku_order_id,
        ],
        'refund' => [
            'amount' => $amount,
            'type' => 'FULL_REFUND',
        ],
    ];

    $headers = $this->generateHeaders($requestId, $timestamp, $endpoint, json_encode($body));

    try {
        $response = Http::withHeaders($headers)
            ->withBody(json_encode($body), 'application/json')
            ->post($this->baseUrl . $endpoint);

        return $this->handleRefundResponse($order, $response->json(), $refundNo);
    } catch (\Exception $e) {
        Log::error('DOKU credit card refund failed', [
            'order_id' => $order->id,
            'error' => $e->getMessage(),
        ]);

        $order->update([
            'payment_status' => 'refund_failed',
            'refund_reason' => $e->getMessage(),
        ]);

        return ['status' => 'failed', 'error' => $e->getMessage()];
    }
}
```

- [ ] **Step 3: Add refundDirectDebit() private method**

```php
private function refundDirectDebit(Order $order, string $refundNo, int $amount, string $reason): array
{
    $requestId = $refundNo;
    $timestamp = now('UTC')->format('Y-m-d\TH:i:s\Z');
    $endpoint = '/direct-debit/core/v1/debit/refund';

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

    $headers = $this->generateHeaders($requestId, $timestamp, $endpoint, json_encode($body));

    try {
        $response = Http::withHeaders($headers)
            ->withBody(json_encode($body), 'application/json')
            ->post($this->baseUrl . $endpoint);

        return $this->handleRefundResponse($order, $response->json(), $refundNo);
    } catch (\Exception $e) {
        Log::error('DOKU direct debit refund failed', [
            'order_id' => $order->id,
            'error' => $e->getMessage(),
        ]);

        $order->update([
            'payment_status' => 'refund_failed',
            'refund_reason' => $e->getMessage(),
        ]);

        return ['status' => 'failed', 'error' => $e->getMessage()];
    }
}
```

- [ ] **Step 4: Add handleRefundResponse() private method**

```php
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

        return ['status' => 'success', 'refund_id' => $refundNo];
    }

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

- [ ] **Step 5: Run syntax check**

Run: `php -l app/Services/DokuService.php`
Expected: No syntax errors

- [ ] **Step 6: Commit**

```bash
git add app/Services/DokuService.php
git commit -m "feat: add DOKU refund API integration"
```

---

## Task 6: DokuService — Fix markOrderPaid() Race Condition

**Files:**
- Modify: `app/Services/DokuService.php`

- [ ] **Step 1: Update markOrderPaid() atomic check**

Replace the `markOrderPaid()` method:

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

- [ ] **Step 2: Run syntax check**

Run: `php -l app/Services/DokuService.php`
Expected: No syntax errors

- [ ] **Step 3: Commit**

```bash
git add app/Services/DokuService.php
git commit -m "fix: markOrderPaid race condition with refund"
```

---

## Task 7: OrderStatusService — Update handleSideEffects()

**Files:**
- Modify: `app/Services/OrderStatusService.php`

- [ ] **Step 1: Update handleSideEffects()**

Replace the `handleSideEffects()` method:

```php
private function handleSideEffects(Order $order, string $from, string $to, array $ctx): void
{
    // Stock release on cancellation/expiration/rejection
    if (in_array($to, ['cancelled_by_customer', 'cancelled_by_outlet', 'rejected_by_outlet', 'expired', 'failed_delivery'], true)) {
        $this->inventoryService->releaseReservedStock($order);
    }

    // Refund on cancellation/expiration/rejection (if paid via DOKU)
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
```

- [ ] **Step 2: Add processRefund() private method**

```php
private function processRefund(Order $order, string $reason): void
{
    if (in_array($order->payment_status, ['refunded', 'refund_failed'], true)) {
        return;
    }

    try {
        $result = app(DokuService::class)->refund($order, $reason);

        if ($result['status'] === 'failed') {
            Log::warning('Refund failed, queued for manual review', [
                'order_id' => $order->id,
                'error' => $result['error'] ?? 'Unknown',
            ]);
        } elseif ($result['status'] === 'success') {
            app(NotificationService::class)->notifyRefundProcessed($order, (float) $order->total);
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

- [ ] **Step 3: Remove credit refund from updateStatus()**

In `updateStatus()` method, remove the credit refund block (lines 81-87):

```php
// REMOVE THIS BLOCK:
if (in_array($status, ['cancelled_by_outlet', 'cancelled_by_customer', 'rejected_by_outlet'], true)) {
    $this->inventoryService->releaseReservedStock($order);

    if ($status === 'cancelled_by_outlet' && $order->payment_status === 'paid') {
        app(CustomerCreditService::class)->refund($order);
    }
}
```

Replace with:
```php
if (in_array($status, ['cancelled_by_outlet', 'cancelled_by_customer', 'rejected_by_outlet'], true)) {
    $this->inventoryService->releaseReservedStock($order);
}
```

- [ ] **Step 4: Remove credit refund from rejectOrder()**

In `rejectOrder()` method, remove the credit refund block (lines 170-177):

```php
// REMOVE THIS BLOCK:
if ($order->payment_status === 'paid') {
    app(CustomerCreditService::class)->refund($order);
}
```

- [ ] **Step 5: Remove CustomerCreditService import**

Remove `use App\Services\CustomerCreditService;` if present.

- [ ] **Step 6: Run syntax check**

Run: `php -l app/Services/OrderStatusService.php`
Expected: No syntax errors

- [ ] **Step 7: Commit**

```bash
git add app/Services/OrderStatusService.php
git commit -m "feat: integrate DOKU refund into order status transitions"
```

---

## Task 8: OrderService — Remove Credit Logic

**Files:**
- Modify: `app/Services/OrderService.php`

- [ ] **Step 1: Remove credit application block**

Remove lines 126-141 (the credit application logic):

```php
// REMOVE THIS BLOCK:
if ($validated['use_credit'] ?? false) {
    $customer = $request->user()->getCustomerOrCreate();
    $creditBalance = (float) $customer->credit_balance;
    $creditToApply = min($creditBalance, $subtotal + $deliveryFee + $paymentFee);

    if ($creditToApply > 0) {
        $customer->decrement('credit_balance', $creditToApply);
        $orderData['credit_applied'] = $creditToApply;
        $orderData['payment_method'] = 'credit';
        $orderData['payment_status'] = 'paid';
        $orderData['paid_at'] = now();
    }
}
```

- [ ] **Step 2: Run syntax check**

Run: `php -l app/Services/OrderService.php`
Expected: No syntax errors

- [ ] **Step 3: Commit**

```bash
git add app/Services/OrderService.php
git commit -m "feat: remove credit logic from OrderService"
```

---

## Task 9: CheckoutController — Remove use_credit

**Files:**
- Modify: `app/Http/Controllers/Customer/CheckoutController.php`

- [ ] **Step 1: Remove use_credit validation**

Remove line 513:
```php
'use_credit' => ['boolean'],
```

- [ ] **Step 2: Remove use_credit from order payload**

Remove line 562:
```php
'use_credit' => $validated['use_credit'] ?? false,
```

- [ ] **Step 3: Run syntax check**

Run: `php -l app/Http/Controllers/Customer/CheckoutController.php`
Expected: No syntax errors

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/Customer/CheckoutController.php
git commit -m "feat: remove use_credit from checkout"
```

---

## Task 10: NotificationService — Add notifyRefundProcessed()

**Files:**
- Modify: `app/Services/NotificationService.php`

- [ ] **Step 1: Add notifyRefundProcessed() method**

```php
public function notifyRefundProcessed(Order $order, float $amount): void
{
    $formattedAmount = 'Rp ' . number_format($amount, 0, ',', '.');

    // Push notification
    $this->notify(
        $order->customer_id,
        'Refund Berhasil',
        "{$formattedAmount} telah dikembalikan ke metode pembayaran Anda. Order #{$order->order_code} dibatalkan.",
        ['order_id' => $order->id]
    );

    // WhatsApp
    if ($order->customer_phone) {
        $this->sendWhatsApp(
            $order->customer_phone,
            "Refund {$formattedAmount} telah diproses untuk order #{$order->order_code}. Dana akan kembali dalam 1-3 hari kerja."
        );
    }
}
```

- [ ] **Step 2: Run syntax check**

Run: `php -l app/Services/NotificationService.php`
Expected: No syntax errors

- [ ] **Step 3: Commit**

```bash
git add app/Services/NotificationService.php
git commit -m "feat: add refund notification"
```

---

## Task 11: RefundController — Owner Manual Refund Queue

**Files:**
- Create: `app/Http/Controllers/Owner/RefundController.php`

- [ ] **Step 1: Create controller**

```php
<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\DokuService;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RefundController extends Controller
{
    public function index(): Response
    {
        $orders = Order::where('payment_status', 'refund_failed')
            ->with(['outlet', 'customer'])
            ->orderByDesc('updated_at')
            ->paginate(20);

        return Inertia::render('owner/finance/refund-tab', [
            'refunds' => $orders,
        ]);
    }

    public function retry(Order $order): \Illuminate\Http\RedirectResponse
    {
        if ($order->payment_status !== 'refund_failed') {
            return redirect()->back()->with('error', 'Order ini tidak dalam status refund_failed.');
        }

        $result = app(DokuService::class)->refund($order, $order->refund_reason ?? 'Manual retry');

        if ($result['status'] === 'success') {
            app(NotificationService::class)->notifyRefundProcessed($order, (float) $order->total);
            return redirect()->back()->with('success', 'Refund berhasil diproses.');
        }

        return redirect()->back()->with('error', 'Refund gagal: ' . ($result['error'] ?? 'Unknown error'));
    }

    public function resolve(Order $order): \Illuminate\Http\RedirectResponse
    {
        if ($order->payment_status !== 'refund_failed') {
            return redirect()->back()->with('error', 'Order ini tidak dalam status refund_failed.');
        }

        $order->update([
            'refund_reason' => '[Manual] ' . ($order->refund_reason ?? 'Resolved by owner'),
        ]);

        return redirect()->back()->with('success', 'Refund ditandai selesai.');
    }
}
```

- [ ] **Step 2: Run syntax check**

Run: `php -l app/Http/Controllers/Owner/RefundController.php`
Expected: No syntax errors

- [ ] **Step 3: Commit**

```bash
git add app/Http/Controllers/Owner/RefundController.php
git commit -m "feat: add RefundController for manual refund queue"
```

---

## Task 12: Routes — Add Refund Routes

**Files:**
- Modify: `routes/web.php`

- [ ] **Step 1: Add refund routes**

Add in the owner routes group:

```php
Route::get('/owner/refunds', [RefundController::class, 'index'])->name('owner.refunds.index');
Route::post('/owner/refunds/{order}/retry', [RefundController::class, 'retry'])->name('owner.refunds.retry');
Route::post('/owner/refunds/{order}/resolve', [RefundController::class, 'resolve'])->name('owner.refunds.resolve');
```

Add import:
```php
use App\Http\Controllers\Owner\RefundController;
```

- [ ] **Step 2: Run route check**

Run: `php artisan route:list --name=refund`
Expected: 3 refund routes listed

- [ ] **Step 3: Commit**

```bash
git add routes/web.php
git commit -m "feat: add refund routes"
```

---

## Task 13: Frontend — Remove Credit from Checkout

**Files:**
- Modify: `resources/js/pages/customer/checkout/payment.tsx`

- [ ] **Step 1: Remove credit-related state and props**

Remove:
- `creditBalance = 0` prop (line 14)
- `useCredit` state (line 26)
- `creditApplied` / `total` calculation (lines 30-32)
- `use_credit` in fetch body (lines 86, 153)
- Credit toggle UI block (lines 353-365)
- Credit applied summary row (line 377)

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add resources/js/pages/customer/checkout/payment.tsx
git commit -m "feat: remove credit toggle from checkout"
```

---

## Task 14: Frontend — Remove Credit from Order Show

**Files:**
- Modify: `resources/js/pages/customer/orders/show.tsx`

- [ ] **Step 1: Remove credit_applied display**

Remove the credit_applied summary row (line 315):
```tsx
{Number(order.credit_applied) > 0 && ...}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add resources/js/pages/customer/orders/show.tsx
git commit -m "feat: remove credit_applied from order display"
```

---

## Task 15: Frontend — Refund Queue UI

**Files:**
- Create: `resources/js/pages/owner/finance/refund-tab.tsx`

- [ ] **Step 1: Create refund tab component**

```tsx
import { Head, router } from '@inertiajs/react';
import { RefreshCw, CheckCircle } from 'lucide-react';
import OwnerLayout from '@/layouts/owner-layout';
import { formatCurrency, formatDate } from '@/lib/format';

interface RefundOrder {
    id: number;
    order_code: string;
    total: number;
    refund_reason: string | null;
    updated_at: string;
    outlet: { name: string } | null;
    customer: { name: string } | null;
}

interface Props {
    refunds: {
        data: RefundOrder[];
        current_page: number;
        last_page: number;
    };
}

export default function RefundTab({ refunds }: Props) {
    const handleRetry = (orderId: number) => {
        router.post(`/owner/refunds/${orderId}/retry`);
    };

    const handleResolve = (orderId: number) => {
        router.post(`/owner/refunds/${orderId}/resolve`);
    };

    return (
        <OwnerLayout title="Refund Queue">
            <div className="space-y-4">
                {refunds.data.length === 0 ? (
                    <div className="rounded-xl border border-border bg-white p-8 text-center">
                        <CheckCircle className="mx-auto h-8 w-8 text-emerald-500" />
                        <p className="mt-2 text-sm text-text-muted">Tidak ada refund yang pending</p>
                    </div>
                ) : (
                    refunds.data.map((order) => (
                        <div key={order.id} className="rounded-xl border border-border bg-white p-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-sm font-semibold text-text">{order.order_code}</div>
                                    <div className="mt-0.5 text-xs text-text-muted">
                                        {order.outlet?.name ?? '-'} · {order.customer?.name ?? '-'}
                                    </div>
                                    <div className="mt-1 text-sm font-bold text-text">{formatCurrency(order.total)}</div>
                                    {order.refund_reason && (
                                        <div className="mt-1 text-xs text-red-600">{order.refund_reason}</div>
                                    )}
                                    <div className="mt-1 text-xs text-text-subtle">{formatDate(order.updated_at)}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleRetry(order.id)}
                                        className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white active:opacity-80"
                                    >
                                        <RefreshCw className="h-3.5 w-3.5" /> Retry
                                    </button>
                                    <button
                                        onClick={() => handleResolve(order.id)}
                                        className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-text active:bg-surface-muted"
                                    >
                                        <CheckCircle className="h-3.5 w-3.5" /> Selesai
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </OwnerLayout>
    );
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add resources/js/pages/owner/finance/refund-tab.tsx
git commit -m "feat: add refund queue UI for owner"
```

---

## Task 16: Delete Credit System Files

**Files:**
- Delete: `app/Services/CustomerCreditService.php`
- Delete: `app/Models/CustomerCredit.php`
- Delete: `database/migrations/2026_07_06_000001_create_customer_credits_table.php`

- [ ] **Step 1: Delete files**

```bash
rm app/Services/CustomerCreditService.php
rm app/Models/CustomerCredit.php
rm database/migrations/2026_07_06_000001_create_customer_credits_table.php
```

- [ ] **Step 2: Check for remaining references**

Run: `grep -r "CustomerCredit\|credit_balance\|credit_applied" app/ --include="*.php" | grep -v "credit_card"`
Expected: No matches

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: remove credit system files"
```

---

## Task 17: Tests — Refund Flow

**Files:**
- Create: `tests/Feature/RefundFlowTest.php`

- [ ] **Step 1: Create test file**

```php
<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use App\Services\DokuService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class RefundFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_cancel_paid_order_triggers_refund(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $order = Order::factory()->create([
            'customer_id' => $user->getCustomerOrCreate()->id,
            'status' => 'confirmed',
            'payment_status' => 'paid',
            'payment_method' => 'qris',
            'total' => 50000,
        ]);

        $dokuMock = Mockery::mock(DokuService::class);
        $dokuMock->shouldReceive('refund')
            ->once()
            ->andReturn(['status' => 'success', 'refund_id' => 'REF-001']);
        $this->app->instance(DokuService::class, $dokuMock);

        $this->actingAs($user)
            ->post("/customer/orders/{$order->id}/cancel", [
                'reason' => 'Tidak Jadi Membeli',
            ]);

        $order->refresh();
        $this->assertEquals('refunded', $order->payment_status);
        $this->assertNotNull($order->refunded_at);
        $this->assertEquals(50000, $order->refund_amount);
    }

    public function test_refund_failed_sets_refund_failed_status(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $order = Order::factory()->create([
            'customer_id' => $user->getCustomerOrCreate()->id,
            'status' => 'confirmed',
            'payment_status' => 'paid',
            'payment_method' => 'qris',
            'total' => 50000,
        ]);

        $dokuMock = Mockery::mock(DokuService::class);
        $dokuMock->shouldReceive('refund')
            ->once()
            ->andReturn(['status' => 'failed', 'error' => 'DOKU error']);
        $this->app->instance(DokuService::class, $dokuMock);

        $this->actingAs($user)
            ->post("/customer/orders/{$order->id}/cancel", [
                'reason' => 'Tidak Jadi Membeli',
            ]);

        $order->refresh();
        $this->assertEquals('refund_failed', $order->payment_status);
    }

    public function test_already_refunded_is_idempotent(): void
    {
        $order = Order::factory()->create([
            'payment_status' => 'refunded',
            'payment_method' => 'qris',
        ]);

        $dokuService = app(DokuService::class);
        $result = $dokuService->refund($order, 'test');

        $this->assertEquals('already_refunded', $result['status']);
    }

    public function test_cash_order_skips_refund(): void
    {
        $order = Order::factory()->create([
            'payment_status' => 'paid',
            'payment_method' => 'cash',
        ]);

        $dokuService = app(DokuService::class);
        $result = $dokuService->refund($order, 'test');

        $this->assertEquals('skipped', $result['status']);
    }

    public function test_unpaid_order_skips_refund(): void
    {
        $order = Order::factory()->create([
            'payment_status' => 'pending',
            'payment_method' => 'qris',
        ]);

        $dokuService = app(DokuService::class);
        $result = $dokuService->refund($order, 'test');

        $this->assertEquals('skipped', $result['status']);
    }
}
```

- [ ] **Step 2: Run tests**

Run: `php artisan test --filter=RefundFlowTest`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/Feature/RefundFlowTest.php
git commit -m "test: add refund flow tests"
```

---

## Task 18: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `php artisan test`
Expected: All tests pass

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Check for remaining credit references**

Run: `grep -r "CustomerCredit\|credit_balance\|credit_applied\|use_credit" app/ resources/js/ --include="*.php" --include="*.tsx" | grep -v "credit_card"`
Expected: No matches

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete DOKU refund integration + remove credit system"
```
