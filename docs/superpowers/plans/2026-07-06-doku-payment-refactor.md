# Doku Payment Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 13 issues in Doku payment flow — race conditions, code duplication, frontend crashes, cart safety, and missing edge case handling.

**Architecture:** Extract shared payment status processing into `DokuService::processPaymentStatusChange()`. Add DB locks for concurrent safety. Fix frontend status handling with proper type guards and fallbacks. Move cart cleanup after payment URL success.

**Tech Stack:** Laravel 13, React/Inertia TypeScript, Doku Checkout API

---

## File Map

| File | Changes |
|------|---------|
| `app/Services/DokuService.php` | C1, C2, C4, H1, H2, M1, M2 |
| `app/Http/Controllers/Customer/CheckoutController.php` | H5 |
| `app/Http/Controllers/Customer/OrderController.php` | M4 |
| `resources/js/pages/customer/orders/confirm.tsx` | C3, H4 |
| `resources/js/pages/track.tsx` | M3 |
| `resources/js/hooks/use-countdown.ts` | Verify (already exists) |

---

## Task 1: DokuService — Extract Shared Payment Status Logic (C2)

**Files:**
- Modify: `app/Services/DokuService.php`

**Why:** `handleWebhook()` and `syncStatusFromDoku()` duplicate the same payment status processing logic. Extract into a single `processPaymentStatusChange()` method.

- [ ] **Step 1: Add `processPaymentStatusChange()` method**

```php
/**
 * Process payment status change — shared by webhook and status sync.
 * Handles: paid, failed, expired transitions.
 */
private function processPaymentStatusChange(Order $order, string $status): void
{
    if ($status === 'paid' && $order->payment_status !== 'paid') {
        $this->markOrderPaid($order);
    } elseif (in_array($status, ['failed', 'expired'], true) && $order->payment_status === 'pending') {
        $order->update(['payment_status' => $status]);

        if ($order->status === Order::STATUS_PENDING_CONFIRMATION) {
            app(OrderStatusService::class)->expireOrder($order, reason: "Payment {$status}");
        }
    }
}
```

Add this method after `markOrderPaid()` (around line 318).

- [ ] **Step 2: Refactor `handleWebhook()` to use shared method**

Replace lines 157-166 in `handleWebhook()`:

```php
// Before (duplicated logic):
if ($status === 'paid') {
    $this->markOrderPaid($order);
} elseif (in_array($status, ['failed', 'expired']) && $order->payment_status === 'pending') {
    $order->update(['payment_status' => $status]);
    if ($order->status === Order::STATUS_PENDING_CONFIRMATION) {
        app(OrderStatusService::class)->expireOrder($order, reason: "Payment {$status}");
    }
}

// After (shared method):
$this->processPaymentStatusChange($order, $status);
```

- [ ] **Step 3: Refactor `syncStatusFromDoku()` to use shared method**

Replace lines 259-267 in `syncStatusFromDoku()`:

```php
// Before (duplicated logic):
if ($status === 'paid' && $order->payment_status !== 'paid') {
    $this->markOrderPaid($order);
} elseif (in_array($status, ['failed', 'expired']) && $order->payment_status === 'pending') {
    $order->update(['payment_status' => $status]);
    if ($order->status === Order::STATUS_PENDING_CONFIRMATION) {
        app(OrderStatusService::class)->expireOrder($order, reason: "Payment {$status}");
    }
}

// After (shared method):
$this->processPaymentStatusChange($order, $status);
```

- [ ] **Step 4: Run tests**

```bash
php artisan test tests/Feature/PaymentScenarioTest.php
```

Expected: 26 passed.

- [ ] **Step 5: Commit**

```bash
git add app/Services/DokuService.php
git commit -m "refactor: extract shared processPaymentStatusChange in DokuService"
```

---

## Task 2: DokuService — Race Condition Fix (C1)

**Files:**
- Modify: `app/Services/DokuService.php`

**Why:** Concurrent webhook + redirect can both trigger `markOrderPaid()`, causing double notifications.

- [ ] **Step 1: Add DB lock to `markOrderPaid()`**

Replace the entire `markOrderPaid()` method:

```php
private function markOrderPaid(Order $order): void
{
    // Atomic update — only one concurrent request can succeed
    $updated = Order::where('id', $order->id)
        ->where('payment_status', '!=', 'paid')
        ->update([
            'paid_at' => now(),
            'payment_status' => 'paid',
        ]);

    if ($updated === 0) {
        return; // Already paid by concurrent request
    }

    // Reload to get fresh state
    $order->refresh();

    if ($order->status === Order::STATUS_PENDING_CONFIRMATION) {
        $order->update(['status' => Order::STATUS_CONFIRMED, 'confirmed_at' => now()]);
        app(NotificationService::class)->notifyOrderConfirmed($order);
    }

    // Notify outlet about new paid order (non-COD orders skipped in OrderService)
    app(NotificationService::class)->notifyOrderCreated($order);

    Cache::forget("outlet:{$order->outlet_id}:pending_orders");
    Cache::forget('owner:pending_counts');
    Cache::forget('owner:order_stats');
}
```

- [ ] **Step 2: Run tests**

```bash
php artisan test tests/Feature/PaymentScenarioTest.php
```

Expected: 26 passed.

- [ ] **Step 3: Commit**

```bash
git add app/Services/DokuService.php
git commit -m "fix: atomic update in markOrderPaid to prevent race condition"
```

---

## Task 3: DokuService — Null Safety & Data Fixes (C4, H1, H2, M2)

**Files:**
- Modify: `app/Services/DokuService.php`

- [ ] **Step 1: Fix `buildCustomerInfo()` null safety (C4)**

Replace lines 339-345:

```php
private function buildCustomerInfo(Order $order): array
{
    $customer = $order->customer;

    return [
        'name' => $customer?->name ?? $order->customer_name,
        'email' => $customer?->email ?? null,
        'phone' => $customer?->phone ?? $order->customer_phone,
    ];
}
```

- [ ] **Step 2: Fix amount mismatch in `createPayment()` (H1)**

Line 99 — change `$order->total` to `$order->subtotal`:

```php
// Before:
'amount' => $order->total,

// After:
'amount' => (int) $order->subtotal,
```

- [ ] **Step 3: Fix hardcoded payment method in `createPayment()` (H2)**

Line 98 — change `'qris'` to actual method:

```php
// Before:
'payment_method' => 'qris',

// After:
'payment_method' => $order->payment_method ?? 'qris',
```

- [ ] **Step 4: Add warning log for unknown status in `mapStatus()` (M2)**

Replace `mapStatus()`:

```php
public function mapStatus(?string $dokuStatus): string
{
    $upper = strtoupper($dokuStatus ?? '');

    return match ($upper) {
        'SUCCESS' => 'paid',
        'PENDING' => 'pending',
        'FAILED', 'REJECTED', 'DENIED', 'CANCELLED' => 'failed',
        'EXPIRED' => 'expired',
        default => tap('pending', function () use ($upper) {
            Log::warning('DOKU: unmapped status', ['status' => $upper]);
        }),
    };
}
```

- [ ] **Step 5: Run tests**

```bash
php artisan test tests/Feature/PaymentScenarioTest.php
```

Expected: 26 passed.

- [ ] **Step 6: Commit**

```bash
git add app/Services/DokuService.php
git commit -m "fix: null safety, amount/method consistency, and status logging in DokuService"
```

---

## Task 4: CheckoutController — Cart Safety (H5)

**Files:**
- Modify: `app/Http/Controllers/Customer/CheckoutController.php`

**Why:** Session cart is cleared BEFORE Doku API call. If API fails, user loses cart data.

- [ ] **Step 1: Read current `submit()` method to find exact lines**

Read `app/Http/Controllers/Customer/CheckoutController.php` lines 460-530.

- [ ] **Step 2: Move session cleanup after payment URL success**

The current flow:
```
1. Create order
2. Clear cart session  ← TOO EARLY
3. Call DokuService::createPayment()
4. If fail → expire order, redirect to checkout (cart empty!)
5. If success → redirect to Doku
```

The fix:
```
1. Create order
2. Call DokuService::createPayment()
3. If fail → expire order, redirect to checkout (cart still intact)
4. If success → clear cart session, redirect to Doku
```

Move `$request->session()->forget([...])` from before `createPayment()` to inside the success path (after getting `$paymentUrl`).

- [ ] **Step 3: Run tests**

```bash
php artisan test tests/Feature/PaymentScenarioTest.php tests/Feature/CheckoutTest.php
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/Customer/CheckoutController.php
git commit -m "fix: move cart cleanup after Doku payment URL success"
```

---

## Task 5: OrderController — Guest paymentStatus Access (M4)

**Files:**
- Modify: `app/Http/Controllers/Customer/OrderController.php`

**Why:** `paymentStatus()` only checks logged-in user ownership. Guest with recovery session or fresh order gets 403.

- [ ] **Step 1: Add guest ownership check to `paymentStatus()`**

Add the same 3-tier ownership check from `pay()`:

```php
public function paymentStatus(Order $order): JsonResponse
{
    // Ownership check — same as pay()
    $user = auth()->user();
    if ($user) {
        if (! $user->isOwner() && $user->getCustomerOrCreate()->id !== $order->customer_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
    } elseif ($order->customer_id) {
        $recovery = session('guest_recovery');
        $hasRecovery = is_array($recovery)
            && ($recovery['customer_id'] ?? null) === $order->customer_id
            && in_array($order->id, $recovery['order_ids'] ?? [], true);

        $isFreshOrder = $order->created_at && $order->created_at->gt(now()->subMinutes(30));

        if (! $hasRecovery && ! $isFreshOrder) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
    }

    // ... rest of method
}
```

- [ ] **Step 2: Run tests**

```bash
php artisan test tests/Feature/PaymentScenarioTest.php
```

Expected: 26 passed.

- [ ] **Step 3: Commit**

```bash
git add app/Http/Controllers/Customer/OrderController.php
git commit -m "fix: add guest ownership check to paymentStatus endpoint"
```

---

## Task 6: Frontend — confirm.tsx Fixes (C3, H4)

**Files:**
- Modify: `resources/js/pages/customer/orders/confirm.tsx`

- [ ] **Step 1: Fix `paymentStatus` init (H4)**

Replace line 10-12:

```tsx
// Before:
const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    order.payment_status === 'paid' ? 'paid' : 'pending'
);

// After:
const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(() => {
    const s = order.payment_status;
    if (s === 'paid' || s === 'failed' || s === 'expired') return s;
    return 'pending';
});
```

- [ ] **Step 2: Add fallback for unknown status (C3)**

Replace `statusConfig` lookup (around line 135):

```tsx
// Before:
const status = statusConfig[paymentStatus];
const StatusIcon = status.icon;

// After:
const status = statusConfig[paymentStatus] ?? statusConfig.pending;
const StatusIcon = status.icon;
```

Also add `'cancelled'` to the `PaymentStatus` type and `statusConfig`:

```tsx
type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled';

// In statusConfig, add:
cancelled: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', title: 'Dibatalkan', message: 'Pembayaran dibatalkan.' },
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "confirm.tsx"
```

Expected: No errors for confirm.tsx.

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/customer/orders/confirm.tsx
git commit -m "fix: paymentStatus init and fallback handling in confirm page"
```

---

## Task 7: Frontend — track.tsx UseCountdown Fix (M3)

**Files:**
- Modify: `resources/js/pages/track.tsx`

- [ ] **Step 1: Check if `@/hooks/use-countdown` exists**

Read `resources/js/hooks/use-countdown.ts` to verify it exists and understand its API.

- [ ] **Step 2: Replace inline `useCountdown` with imported hook**

In `track.tsx`, find the inline `useCountdown` function and replace with import:

```tsx
// Before (inline):
function useCountdown(targetIso: string | null) { ... }

// After (import):
import { useCountdown } from '@/hooks/use-countdown';
```

Make sure the hook API is compatible (takes ISO string, returns seconds remaining).

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "track.tsx"
```

Expected: No errors for track.tsx (pre-existing `order` null check error is OK).

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/track.tsx
git commit -m "fix: use imported useCountdown hook in track page"
```

---

## Task 8: Run Full Test Suite & Verify

- [ ] **Step 1: Run all payment tests**

```bash
php artisan test tests/Feature/PaymentScenarioTest.php tests/Feature/GuestCheckoutRegisteredPhoneTest.php tests/Feature/OutletOrderExpiryFilterTest.php tests/Feature/PaymentFailureFlowTest.php
```

Expected: All pass.

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "confirm.tsx|track.tsx|show.tsx|active-order-card.tsx"
```

Expected: No new errors.

- [ ] **Step 3: Final commit (if any remaining changes)**

```bash
git add -A && git commit -m "chore: final cleanup for doku payment refactor"
```

---

## Verification Checklist

After all tasks, verify:

- [ ] 3DS success → paid, outlet notified
- [ ] 3DS rejected → failed, order expired, retry available
- [ ] Non-3DS success → paid, outlet notified
- [ ] Non-3DS rejected → failed, retry available
- [ ] Guest retry after failed → clean old tx, create new payment
- [ ] Guest retry after expired → restore cart, checkout ulang
- [ ] Concurrent webhook + redirect → no double notification
- [ ] Cart preserved if Doku API fails
- [ ] Guest can poll paymentStatus without 403
- [ ] Unknown Doku status → warning logged
- [ ] confirm.tsx no crash on unexpected status
- [ ] track.tsx uses same countdown hook as other pages
