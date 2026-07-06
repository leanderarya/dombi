# Order Lifecycle Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 10 gaps in the order lifecycle spec — Customer Credit System (P0), DOKU error fix, outlet timeout, COD removal, delivery/courier retry limits, payment retry limit, return auto-confirm, cancel reason, outlet closed check.

**Architecture:** Phased approach — Phase 1 (credit system foundation), Phase 2 (core fixes), Phase 3 (polish). Each phase produces working, testable software.

**Tech Stack:** Laravel 12, Inertia.js + React, MySQL, DOKU API

---

## Phase 1: Customer Credit System

### Task 1: Migration — customer_credits + credit_applied + credit_balance

**Files:**
- Create: `database/migrations/2026_07_06_000001_create_customer_credits_table.php`
- Modify: `database/migrations/` (new file)

- [ ] **Step 1: Create migration**

```bash
php artisan make:migration create_customer_credits_table
```

- [ ] **Step 2: Write migration content**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_credits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('amount', 15, 2);
            $table->enum('type', ['refund', 'manual_adjustment']);
            $table->decimal('balance_after', 15, 2);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('customer_id');
            $table->index('order_id');
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->decimal('credit_balance', 15, 2)->default(0)->after('is_default');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('credit_applied', 15, 2)->default(0)->after('total');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('credit_applied');
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('credit_balance');
        });

        Schema::dropIfExists('customer_credits');
    }
};
```

- [ ] **Step 3: Run migration**

```bash
php artisan migrate
```

- [ ] **Step 4: Commit**

```bash
git add database/migrations/*_create_customer_credits_table.php
git commit -m "feat: add customer_credits table, credit_balance on customers, credit_applied on orders"
```

---

### Task 2: CustomerCredit Model

**Files:**
- Create: `app/Models/CustomerCredit.php`
- Modify: `app/Models/Customer.php` (add credit_balance to fillable + casts)

- [ ] **Step 1: Create CustomerCredit model**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerCredit extends Model
{
    protected $fillable = [
        'customer_id',
        'order_id',
        'amount',
        'type',
        'balance_after',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'balance_after' => 'decimal:2',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
```

- [ ] **Step 2: Update Customer model**

Add `'credit_balance'` to `$fillable` and casts in `app/Models/Customer.php`.

- [ ] **Step 3: Update Order model**

Add `'credit_applied'` to `$fillable` and casts in `app/Models/Order.php`.

- [ ] **Step 4: Commit**

```bash
git add app/Models/CustomerCredit.php app/Models/Customer.php app/Models/Order.php
git commit -m "feat: add CustomerCredit model, credit_balance on Customer, credit_applied on Order"
```

---

### Task 3: CustomerCreditService

**Files:**
- Create: `app/Services/CustomerCreditService.php`

- [ ] **Step 1: Create service**

```php
<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\CustomerCredit;
use App\Models\Order;
use Illuminate\Support\Facades\DB;

class CustomerCreditService
{
    /**
     * Refund order total to customer credit.
     * Called when paid order is rejected/cancelled.
     */
    public function refund(Order $order): CustomerCredit
    {
        if ($order->payment_status !== 'paid') {
            throw new \InvalidArgumentException('Cannot refund unpaid order');
        }

        return DB::transaction(function () use ($order) {
            $customer = Customer::where('id', $order->customer_id)->lockForUpdate()->first();
            $balanceBefore = (float) $customer->credit_balance;
            $refundAmount = (float) $order->total;

            $customer->update([
                'credit_balance' => $balanceBefore + $refundAmount,
            ]);

            return CustomerCredit::create([
                'customer_id' => $customer->id,
                'order_id' => $order->id,
                'amount' => $refundAmount,
                'type' => 'refund',
                'balance_after' => $customer->fresh()->credit_balance,
                'notes' => "Refund order #{$order->order_code}",
            ]);
        });
    }

    /**
     * Apply credit to an order during checkout.
     * Returns the amount applied.
     */
    public function applyToOrder(Order $order, Customer $customer): float
    {
        return DB::transaction(function () use ($order, $customer) {
            $locked = Customer::where('id', $customer->id)->lockForUpdate()->first();
            $creditBalance = (float) $locked->credit_balance;
            $orderTotal = (float) $order->total;

            if ($creditBalance <= 0) {
                return 0;
            }

            $applied = min($creditBalance, $orderTotal);

            $locked->update([
                'credit_balance' => $creditBalance - $applied,
            ]);

            $order->update([
                'credit_applied' => $applied,
            ]);

            CustomerCredit::create([
                'customer_id' => $locked->id,
                'order_id' => $order->id,
                'amount' => -$applied,
                'type' => 'refund',
                'balance_after' => $locked->fresh()->credit_balance,
                'notes' => "Kredit dipakai untuk order #{$order->order_code}",
            ]);

            return $applied;
        });
    }

    /**
     * Get customer's current credit balance.
     */
    public function getBalance(Customer $customer): float
    {
        return (float) $customer->credit_balance;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/Services/CustomerCreditService.php
git commit -m "feat: add CustomerCreditService — refund and apply credit"
```

---

### Task 4: Integrate refund into OrderStatusService

**Files:**
- Modify: `app/Services/OrderStatusService.php` (rejectOrder, cancelByCustomer)

- [ ] **Step 1: Add credit refund to rejectOrder**

In `app/Services/OrderStatusService.php`, find `rejectOrder()` method. After stock release, add credit refund:

```php
// After releasing stock
if ($order->payment_status === 'paid') {
    app(CustomerCreditService::class)->refund($order);
}
```

- [ ] **Step 2: Add credit refund to cancelByCustomer**

In `cancelByCustomer()` method, after stock release, add same refund logic:

```php
if ($order->payment_status === 'paid') {
    app(CustomerCreditService::class)->refund($order);
}
```

- [ ] **Step 3: Add credit refund to updateStatus (outlet cancel)**

In `updateStatus()` method, when transitioning to `cancelled_by_outlet`, add:

```php
if ($newStatus === Order::STATUS_CANCELLED_BY_OUTLET && $order->payment_status === 'paid') {
    app(CustomerCreditService::class)->refund($order);
}
```

- [ ] **Step 4: Run existing tests**

```bash
php artisan test tests/Feature/OrderStatusTest.php
```

- [ ] **Step 5: Commit**

```bash
git add app/Services/OrderStatusService.php
git commit -m "feat: integrate credit refund on order reject/cancel (paid orders)"
```

---

### Task 5: Integrate refund into DeliveryService (cancel after fail)

**Files:**
- Modify: `app/Services/DeliveryService.php` (handleCancelledAndReleased)

- [ ] **Step 1: Add credit refund to handleCancelledAndReleased**

In `app/Services/DeliveryService.php`, find `handleCancelledAndReleased()` (around line 368). After setting order to `cancelled_by_outlet`, add:

```php
if ($order->payment_status === 'paid') {
    app(CustomerCreditService::class)->refund($order);
}
```

- [ ] **Step 2: Run tests**

```bash
php artisan test tests/Feature/DeliverySafetyTest.php
```

- [ ] **Step 3: Commit**

```bash
git add app/Services/DeliveryService.php
git commit -m "feat: integrate credit refund on delivery cancel (paid orders)"
```

---

### Task 6: Checkout integration — apply credit

**Files:**
- Modify: `app/Http/Controllers/Customer/CheckoutController.php` (submit method)
- Modify: `app/Services/OrderService.php` (createCheckoutOrder)

- [ ] **Step 1: Add credit parameter to checkout request**

In `CheckoutController::submit()`, add validation for `use_credit` boolean parameter.

- [ ] **Step 2: Apply credit after order creation**

In `OrderService::createCheckoutOrder()`, after order is created, if `use_credit` is true:

```php
$creditService = app(CustomerCreditService::class);
$creditApplied = $creditService->applyToOrder($order, $customer);

if ($creditApplied >= (float) $order->total) {
    // Fully paid by credit — skip DOKU
    $order->update([
        'payment_method' => 'credit',
        'payment_status' => 'paid',
        'paid_at' => now(),
        'status' => Order::STATUS_CONFIRMED,
        'confirmed_at' => now(),
    ]);
    // Notify outlet
    app(NotificationService::class)->notifyOrderCreated($order);
    return $order;
}
```

- [ ] **Step 3: Pass credit amount to DOKU if partial**

If credit < total, create DOKU payment with `amount = total - credit_applied`.

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/Customer/CheckoutController.php app/Services/OrderService.php
git commit -m "feat: integrate credit system into checkout flow"
```

---

### Task 7: Frontend — credit balance display + checkout toggle

**Files:**
- Modify: `resources/js/pages/customer/checkout/payment.tsx`
- Modify: `resources/js/pages/customer/orders/show.tsx`

- [ ] **Step 1: Show credit balance on checkout payment page**

In `payment.tsx`, add credit balance display and toggle:

```tsx
{creditBalance > 0 && (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <label className="flex items-center gap-3">
            <input
                type="checkbox"
                checked={useCredit}
                onChange={(e) => setUseCredit(e.target.checked)}
                className="h-5 w-5 rounded border-border text-primary"
            />
            <div>
                <div className="text-sm font-semibold text-text">Pakai Saldo Kredit</div>
                <div className="text-xs text-text-muted">Rp {formatCurrency(creditBalance)}</div>
            </div>
        </label>
    </div>
)}
```

- [ ] **Step 2: Pass use_credit to submit request**

In the submit fetch call, include `use_credit` parameter.

- [ ] **Step 3: Show credit_applied on order detail**

In `orders/show.tsx`, if `order.credit_applied > 0`, show:

```tsx
{order.credit_applied > 0 && (
    <div className="flex justify-between text-sm">
        <span className="text-text-muted">Saldo Kredit</span>
        <span className="font-medium text-emerald-600">-Rp {formatCurrency(order.credit_applied)}</span>
    </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/customer/checkout/payment.tsx resources/js/pages/customer/orders/show.tsx
git commit -m "feat: add credit balance display and checkout toggle"
```

---

## Phase 2: Core Fixes

### Task 8: DOKU API error retry window fix

**Files:**
- Modify: `app/Services/DokuService.php` (createPayment)

- [ ] **Step 1: Reset confirmation_expires_at on DOKU error**

In `DokuService::createPayment()`, when `DokuPaymentException` is caught, reset the expiry:

```php
// In CheckoutController::submit(), after DokuService::createPayment() fails:
catch (DokuPaymentException $e) {
    $order->update([
        'confirmation_expires_at' => now()->addMinutes(
            $order->outlet->confirmation_timeout_minutes ?? 15
        ),
    ]);
    return back()->with('error', 'Pembayaran gagal. Silakan coba lagi.');
}
```

- [ ] **Step 2: Commit**

```bash
git add app/Http/Controllers/Customer/CheckoutController.php
git commit -m "fix: reset confirmation_expires_at on DOKU API error for retry window"
```

---

### Task 9: Outlet timeout configurable

**Files:**
- Modify: `database/migrations/` (add confirmation_timeout_minutes to outlets)
- Modify: `app/Models/Outlet.php` (add to fillable/casts)
- Modify: `app/Console/Commands/ExpirePendingOrders.php` (use outlet config)
- Modify: `app/Services/OrderService.php` (use outlet config at creation)

- [ ] **Step 1: Create migration**

```bash
php artisan make:migration add_confirmation_timeout_to_outlets_table --table=outlets
```

```php
public function up(): void
{
    Schema::table('outlets', function (Blueprint $table) {
        $table->unsignedInteger('confirmation_timeout_minutes')->default(15)->after('is_active');
    });
}
```

- [ ] **Step 2: Run migration**

```bash
php artisan migrate
```

- [ ] **Step 3: Update Outlet model**

Add `'confirmation_timeout_minutes'` to `$fillable` in `app/Models/Outlet.php`.

- [ ] **Step 4: Update OrderService**

In `OrderService::createCheckoutOrder()`, use outlet config:

```php
'confirmation_expires_at' => now()->addMinutes(
    $outlet->confirmation_timeout_minutes ?? 15
),
```

- [ ] **Step 5: Update ExpirePendingOrders**

In `ExpirePendingOrders`, the query already checks `confirmation_expires_at < now()`. No change needed — it's time-based.

- [ ] **Step 6: Commit**

```bash
git add database/migrations/*_add_confirmation_timeout_to_outlets_table.php app/Models/Outlet.php app/Services/OrderService.php
git commit -m "feat: configurable outlet confirmation timeout (default 15m)"
```

---

### Task 10: Hapus COD references

**Files:**
- Modify: `app/Services/OrderService.php` (line 151 — remove COD default)
- Modify: `app/Http/Controllers/Outlet/OrderController.php` (payment gate — remove COD check)
- Modify: `app/Http/Controllers/Outlet/DashboardController.php` (payment gate — remove COD check)
- Modify: `app/Http/Controllers/Customer/OrderController.php` (remove COD payment block)
- Modify: `resources/js/pages/customer/orders/show.tsx` (remove COD display)
- Modify: `resources/js/pages/track.tsx` (remove COD display)

- [ ] **Step 1: Remove COD default in OrderService**

In `app/Services/OrderService.php:151`, change:

```php
// Before:
'payment_method' => $payload['payment_method'] ?? 'cod',

// After:
'payment_method' => $payload['payment_method'],
```

- [ ] **Step 2: Remove COD from payment gate filter**

In `DashboardController.php` and `Outlet/OrderController.php`, remove the `orWhere('payment_method', 'cod')` from the payment gate. Only check `payment_status = 'paid'`:

```php
// Before:
$q->where('payment_status', 'paid')->orWhere('payment_method', 'cod');

// After:
$q->where('payment_status', 'paid');
```

- [ ] **Step 3: Remove COD payment block in Customer/OrderController**

In `app/Http/Controllers/Customer/OrderController.php:228-231`, remove the COD check:

```php
// Remove:
if ($order->payment_method === 'cod') {
    return back()->with('error', 'COD tidak memerlukan pembayaran online.');
}
```

- [ ] **Step 4: Remove COD display from frontend**

In `resources/js/pages/customer/orders/show.tsx` and `track.tsx`, remove:
- `'Bayar di Tempat'` display for COD
- `isPendingUnpaid` COD exclusion
- `StatusBadge` COD skip

- [ ] **Step 5: Update tests**

Remove `payment_method => 'cod'` from all test factories. Change to `'qris'` or `'credit_card'`.

- [ ] **Step 6: Run full test suite**

```bash
php artisan test
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: remove COD payment method — all orders require DOKU payment"
```

---

### Task 11: Delivery retry limit (max 3)

**Files:**
- Create: `app/Exceptions/DeliveryException.php`
- Modify: `app/Services/DeliveryService.php` (resolveFailedDelivery)
- Modify: `config/delivery.php`

- [ ] **Step 1: Create DeliveryException**

```php
<?php

namespace App\Exceptions;

use Exception;

class DeliveryException extends Exception
{
    public function getUserMessage(): string
    {
        return $this->getMessage();
    }
}
```

- [ ] **Step 2: Add max retry check**

In `DeliveryService::resolveFailedDelivery()`, after getting retry count (line 298), add:

```php
$maxRetries = config('delivery.max_retry_attempts', 3);
if ($retryCount >= $maxRetries) {
    throw new \App\Exceptions\DeliveryException(
        "Batas maksimum percobaan pengiriman ({$maxRetries}) telah tercapai. Silakan batalkan pesanan."
    );
}
```

- [ ] **Step 2: Add config**

In `config/delivery.php`, add:

```php
'max_retry_attempts' => env('DELIVERY_MAX_RETRY_ATTEMPTS', 3),
```

- [ ] **Step 3: Update frontend**

In outlet/owner delivery resolution UI, show warning when retry count >= max:

```tsx
{retryCount >= 3 && (
    <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
        Batas percobaan pengiriman tercapai. Silakan batalkan pesanan.
    </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add app/Services/DeliveryService.php config/delivery.php
git commit -m "feat: add max 3 delivery retry limit"
```

---

### Task 12: Courier assign attempt limit (max 3)

**Files:**
- Modify: `app/Services/DeliveryService.php` (assignCourier)

- [ ] **Step 1: Add assign attempt check**

In `DeliveryService::assignCourier()`, before creating delivery, check:

```php
$assignAttempts = Delivery::where('order_id', $order->id)
    ->whereIn('status', ['rejected_by_courier', 'waiting_pickup', 'picked_up', 'delivering'])
    ->count();

$maxAssignAttempts = config('delivery.max_assign_attempts', 3);
if ($assignAttempts >= $maxAssignAttempts) {
    throw new \App\Exceptions\DeliveryException(
        "Batas maksimum percobaan assign kurir ({$maxAssignAttempts}) telah tercapai."
    );
}
```

- [ ] **Step 2: Add config**

In `config/delivery.php`, add:

```php
'max_assign_attempts' => env('DELIVERY_MAX_ASSIGN_ATTEMPTS', 3),
```

- [ ] **Step 3: Commit**

```bash
git add app/Services/DeliveryService.php config/delivery.php
git commit -m "feat: add max 3 courier assign attempt limit"
```

---

### Task 13: Max retry payment limit (max 3)

**Files:**
- Modify: `app/Http/Controllers/Customer/OrderController.php` (pay method)

- [ ] **Step 1: Add retry count check**

In `Customer/OrderController::pay()`, before creating DOKU payment, check:

```php
$paymentAttempts = PaymentTransaction::where('order_id', $order->id)->count();
$maxPaymentAttempts = config('order.max_payment_attempts', 3);

if ($paymentAttempts >= $maxPaymentAttempts) {
    return back()->with('error', 'Batas maksimum percobaan pembayaran tercapai.');
}
```

- [ ] **Step 2: Add config**

In `config/order.php`, add:

```php
'max_payment_attempts' => env('ORDER_MAX_PAYMENT_ATTEMPTS', 3),
```

- [ ] **Step 3: Commit**

```bash
git add app/Http/Controllers/Customer/OrderController.php config/order.php
git commit -m "feat: add max 3 payment retry limit"
```

---

## Phase 3: Polish

### Task 14: Return auto-confirm timeout (24h)

**Files:**
- Create: `app/Console/Commands/AutoConfirmReturn.php`
- Modify: `routes/console.php` (add schedule)

- [ ] **Step 1: Create command**

```bash
php artisan make:command AutoConfirmReturn
```

```php
<?php

namespace App\Console\Commands;

use App\Models\Delivery;
use App\Services\DeliveryService;
use Illuminate\Console\Command;

class AutoConfirmReturn extends Command
{
    protected $signature = 'deliveries:auto-confirm-return';
    protected $description = 'Auto-confirm returns after 24 hours';

    public function handle(DeliveryService $service): int
    {
        $staleReturns = Delivery::where('return_status', 'returning_to_outlet')
            ->where('updated_at', '<', now()->subHours(24))
            ->get();

        foreach ($staleReturns as $delivery) {
            $delivery->update([
                'return_status' => 'returned_to_outlet',
                'return_confirmed_at' => now(),
                'return_notes' => 'Auto-confirm setelah 24 jam',
            ]);
        }

        $this->info("Auto-confirmed {$staleReturns->count()} returns.");
        return 0;
    }
}
```

- [ ] **Step 2: Add to scheduler**

In `routes/console.php`:

```php
Schedule::command('deliveries:auto-confirm-return')
    ->hourly()
    ->withoutOverlapping()
    ->onOneServer();
```

- [ ] **Step 3: Commit**

```bash
git add app/Console/Commands/AutoConfirmReturn.php routes/console.php
git commit -m "feat: auto-confirm return after 24 hours"
```

---

### Task 15: Cancel reason dialog (outlet + customer)

**Files:**
- Modify: `app/Http/Controllers/Outlet/OrderController.php` (updateStatus — require reason for cancel)
- Modify: `app/Http/Controllers/Customer/OrderController.php` (cancel — require reason)
- Modify: `app/Services/OrderStatusService.php` (cancelByCustomer — store reason)
- Modify: `resources/js/pages/outlet/orders/show.tsx` (add cancel reason bottom sheet)
- Modify: `resources/js/pages/customer/orders/show.tsx` (add cancel reason dialog)

- [ ] **Step 1: Add reason validation for outlet cancel**

In `Outlet/OrderController::updateStatus()`, when status is `cancelled_by_outlet`, require a reason:

```php
if ($request->status === 'cancelled_by_outlet') {
    $request->validate([
        'reason' => 'required|string|max:500',
    ]);
}
```

- [ ] **Step 2: Add cancel reason bottom sheet to order detail**

In `resources/js/pages/outlet/orders/show.tsx`, add a cancel reason bottom sheet similar to the reject sheet:

```tsx
const cancelReasons = [
    'Stok habis',
    'Produk rusak',
    'Outlet tutup',
    'Lainnya',
];
```

- [ ] **Step 3: Add reason validation for customer cancel**

In `Customer/OrderController::cancel()`, add reason validation:

```php
$request->validate([
    'reason' => 'required|string|max:500',
]);
```

Pass reason to `OrderStatusService::cancelByCustomer()`.

- [ ] **Step 4: Update cancelByCustomer to store reason**

In `OrderStatusService::cancelByCustomer()`, add `cancelled_reason` to the update:

```php
$order->update([
    'status' => Order::STATUS_CANCELLED_BY_CUSTOMER,
    'cancelled_at' => now(),
    'cancelled_reason' => $reason,
]);
```

- [ ] **Step 5: Add cancel reason dialog to customer order detail**

In `resources/js/pages/customer/orders/show.tsx`, add cancel reason dialog:

```tsx
const cancelReasons = [
    'Berubah pikiran',
    'Salah pesan',
    'Tidak jadi',
    'Lainnya',
];
```

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/Outlet/OrderController.php app/Http/Controllers/Customer/OrderController.php app/Services/OrderStatusService.php resources/js/pages/outlet/orders/show.tsx resources/js/pages/customer/orders/show.tsx
git commit -m "feat: add cancel reason requirement for outlet and customer cancel"
```

---

### Task 16: Outlet closed check during checkout

**Files:**
- Modify: `app/Services/OrderService.php` (outlet assignment check)
- Modify: `app/Services/OutletAssignmentService.php` (filter closed outlets)

- [ ] **Step 1: Add operating hours check**

In `OutletAssignmentService`, when finding candidate outlets, filter out closed ones:

```php
// Check if outlet is currently open
$outlet->operatingHours()->where('is_open', true)
    ->where('day_of_week', now()->dayOfWeek)
    ->where('open_time', '<=', now()->format('H:i'))
    ->where('close_time', '>=', now()->format('H:i'))
    ->exists();
```

Also check holidays:

```php
$outlet->holidays()->whereDate('date', today())->exists();
```

- [ ] **Step 2: Add frontend warning**

In checkout page, if selected outlet is closed, show warning:

```tsx
{outlet.isClosed && (
    <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
        Outlet sedang tutup. Pesanan akan diproses saat outlet buka.
    </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add app/Services/OutletAssignmentService.php
git commit -m "feat: filter closed outlets during checkout"
```

---

## File Summary

| Task | Files Created | Files Modified |
|------|--------------|----------------|
| 1 | 1 migration | — |
| 2 | 1 model | 2 models |
| 3 | 1 service | — |
| 4 | — | 1 service |
| 5 | — | 1 service |
| 6 | — | 2 controllers |
| 7 | — | 2 frontend pages |
| 8 | — | 1 controller |
| 9 | 1 migration | 3 files |
| 10 | — | 6 files + tests |
| 11 | — | 1 service + 1 config |
| 12 | — | 1 service + 1 config |
| 13 | — | 1 controller + 1 config |
| 14 | 1 command | 1 scheduler |
| 15 | — | 2 files |
| 16 | — | 2 files |

**Total: 4 new files created, ~20 files modified**
