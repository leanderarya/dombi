# Fix Pickup Order Courier Assignment - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix pickup orders being asked to assign courier, and add proper pickup flow

**Architecture:** Add fulfillment_type checks in UI and backend, add pickup-specific status transition

**Tech Stack:** Laravel 13, React 19, Inertia.js

---

## Issue Summary

When a customer orders for pickup (ambil di outlet), the outlet is still asked to assign a courier. This is wrong because:
- Pickup orders don't need a courier
- The UI doesn't distinguish between pickup and delivery orders
- The backend allows courier assignment for pickup orders

---

### Task 1: Fix Outlet Order UI for Pickup

**Files:**
- Modify: `resources/js/pages/outlet/orders/show.tsx`

- [ ] **Step 1: Read current file**

```bash
cat resources/js/pages/outlet/orders/show.tsx
```

- [ ] **Step 2: Add fulfillment type checks**

Find the condition that shows courier assignment form and add fulfillment type check:

```tsx
// Before (around line 31):
const isReadyForPickup = order.status === 'ready_for_pickup' && !order.delivery;

// After:
const isDeliveryOrder = order.fulfillment_type !== 'pickup';
const isReadyForPickup = order.status === 'ready_for_pickup' && !order.delivery && isDeliveryOrder;
const isReadyForCustomerPickup = order.status === 'ready_for_pickup' && order.fulfillment_type === 'pickup';
```

- [ ] **Step 3: Add "Serahkan ke Customer" button for pickup orders**

Add a new section for pickup orders that are ready:

```tsx
{isReadyForCustomerPickup && (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="text-sm font-semibold text-emerald-700">Siap Diambil Customer</div>
        <div className="mt-1 text-xs text-emerald-600">
            Pesanan sudah siap. Serahkan ke customer saat datang mengambil.
        </div>
        <button
            onClick={() => router.post(`/outlet/orders/${order.id}/complete-pickup`)}
            className="mt-3 w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white active:bg-emerald-700"
        >
            Serahkan ke Customer
        </button>
    </div>
)}
```

- [ ] **Step 4: Test and commit**

Run: `npm run build && php artisan test`
Expected: PASS

---

### Task 2: Add Backend Guard for Pickup Orders

**Files:**
- Modify: `app/Services/DeliveryService.php`

- [ ] **Step 1: Read current file**

```bash
cat app/Services/DeliveryService.php
```

- [ ] **Step 2: Add fulfillment type guard in assignCourier()**

```php
public function assignCourier(Order $order, int $courierId, User $assignedBy): Delivery
{
    // Guard: pickup orders don't need courier
    if ($order->fulfillment_type === 'pickup') {
        throw \Illuminate\Validation\ValidationException::withMessages([
            'courier_id' => 'Pesanan pickup tidak memerlukan kurir.',
        ]);
    }

    // ... existing logic
}
```

- [ ] **Step 3: Test and commit**

Run: `php artisan test --filter=Delivery`
Expected: PASS

---

### Task 3: Add Pickup Status Transition

**Files:**
- Modify: `app/Services/OrderStatusService.php`
- Create: `app/Http/Controllers/Outlet/OrderController.php` (add completePickup method)

- [ ] **Step 1: Read OrderStatusService**

```bash
cat app/Services/OrderStatusService.php
```

- [ ] **Step 2: Add pickup completion transition**

In `OrderStatusService`, add a method for completing pickup orders:

```php
public function completePickup(Order $order, User $user): void
{
    if ($order->fulfillment_type !== 'pickup') {
        throw new \Exception('Hanya pesanan pickup yang bisa diselesaikan dengan cara ini.');
    }

    if ($order->status !== 'ready_for_pickup') {
        throw new \Exception('Pesanan harus dalam status siap diambil.');
    }

    DB::transaction(function () use ($order, $user) {
        $order = Order::lockForUpdate()->find($order->id);

        $order->update([
            'status' => 'completed',
            'completed_at' => now(),
        ]);

        $this->recordHistory($order, 'ready_for_pickup', 'completed', 'Pesanan diambil customer');
    });
}
```

- [ ] **Step 3: Add controller method**

In `Outlet/OrderController.php`, add:

```php
public function completePickup(Order $order, OrderStatusService $statusService): RedirectResponse
{
    $user = $request->user();
    $outlet = $user->outlet;

    abort_unless($outlet && $order->outlet_id === $outlet->id, 403);

    $statusService->completePickup($order, $user);

    return redirect()->route('outlet.orders.show', $order)
        ->with('success', 'Pesanan berhasil diserahkan ke customer.');
}
```

- [ ] **Step 4: Add route**

In `routes/web.php`:

```php
Route::post('/outlet/orders/{order}/complete-pickup', [OutletOrderController::class, 'completePickup'])
    ->name('outlet.orders.complete-pickup');
```

- [ ] **Step 5: Test and commit**

Run: `php artisan test --filter=Order`
Expected: PASS

---

### Task 4: Show Fulfillment Type Badge

**Files:**
- Modify: `resources/js/pages/outlet/orders/index.tsx`

- [ ] **Step 1: Read current file**

```bash
cat resources/js/pages/outlet/orders/index.tsx
```

- [ ] **Step 2: Add fulfillment type badge**

Add a badge to show whether order is pickup or delivery:

```tsx
<span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
    order.fulfillment_type === 'pickup'
        ? 'bg-blue-50 text-blue-700'
        : 'bg-purple-50 text-purple-700'
}`}>
    {order.fulfillment_type === 'pickup' ? 'Pickup' : 'Delivery'}
</span>
```

- [ ] **Step 3: Test and commit**

Run: `npm run build && php artisan test`
Expected: PASS

---

## Verification

After completing all tasks:

1. Run full test suite: `php artisan test`
2. Build frontend: `npm run build`
3. Manual testing:
   - Create a pickup order as customer
   - Process it as outlet (confirm, prepare, ready)
   - Verify no courier assignment is shown
   - Verify "Serahkan ke Customer" button appears
   - Click button and verify order completes

## Summary

| Task | Description | Est. |
|------|-------------|------|
| 1 | Fix outlet order UI for pickup | 1d |
| 2 | Add backend guard for pickup | 0.5d |
| 3 | Add pickup status transition | 0.5d |
| 4 | Show fulfillment type badge | 0.5d |
| **Total** | | **2.5d** |
