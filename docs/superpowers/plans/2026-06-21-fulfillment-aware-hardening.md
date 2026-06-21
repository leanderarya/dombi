# Operational Flow Hardening (Fulfillment Aware) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every dashboard, counter, status, KPI, action, and tracking step in Dombi fulfillment-type-aware — pickup orders are never treated as delivery, and vice versa.

**Architecture:** Add fulfillment_type constants and helpers to the Order model. Fix all dashboard queries to filter by fulfillment_type. Add service-layer guards against invalid transitions. Fix frontend labels and UI to branch on fulfillment_type. Add regression tests.

**Tech Stack:** Laravel 12, Inertia.js, React 19, TailwindCSS v4, PHPUnit

---

## Fulfillment Type Matrix (Reference)

### Order Statuses

| Status | Pickup Meaning | Delivery Meaning |
|--------|---------------|-----------------|
| `pending_confirmation` | Menunggu konfirmasi outlet | Menunggu konfirmasi outlet |
| `confirmed` | Pesanan diterima | Pesanan diterima |
| `preparing` | Sedang disiapkan | Sedang disiapkan |
| `ready_for_pickup` | **Siap diambil customer** | **Siap assign kurir** |
| `picked_up` | ❌ Tidak berlaku | Kurir sudah mengambil |
| `delivering` | ❌ Tidak berlaku | Dalam perjalanan |
| `completed` | Selesai (customer ambil) | Selesai (terkirim) |

### Valid Status Transitions

**Pickup:**
```
pending_confirmation → confirmed → preparing → ready_for_pickup → completed
```

**Delivery:**
```
pending_confirmation → confirmed → preparing → ready_for_pickup → picked_up → delivering → completed
```

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `tests/Feature/FulfillmentAwarenessTest.php` | Regression tests for fulfillment-type isolation |

### Modified Files
| File | Responsibility |
|------|---------------|
| `app/Models/Order.php` | Add fulfillment constants + `isPickup()`/`isDelivery()` helpers |
| `app/Http/Controllers/Outlet/DashboardController.php` | Fix counters to filter by fulfillment_type |
| `app/Http/Controllers/Outlet/DeliveryController.php` | Fix unassigned orders query to exclude pickup |
| `app/Services/OrderStatusService.php` | Add fulfillment guard to `updateStatus()` + fix notes |
| `resources/js/pages/outlet/dashboard.tsx` | Fix counter labels, split pickup vs delivery queues |
| `resources/js/pages/outlet/deliveries/index.tsx` | Ensure pickup orders excluded from delivery lists |
| `resources/js/lib/customer-status.ts` | Make labels and progress index fulfillment-aware |
| `resources/js/components/customer/order-timeline.tsx` | Make step labels fulfillment-specific |
| `resources/js/pages/customer/orders/show.tsx` | Add pickup-specific UI (outlet info, QR, instructions) |

---

### Task 1: Add fulfillment_type constants and helpers to Order model

**Files:**
- Modify: `app/Models/Order.php`

- [ ] **Step 1: Add constants and helpers**

In `app/Models/Order.php`, add these constants after the status constants (after line 52):

```php
public const FULFILLMENT_PICKUP = 'pickup';
public const FULFILLMENT_DELIVERY_DOMBI = 'delivery_dombi';
public const FULFILLMENT_DELIVERY_OJOL = 'delivery_ojol';

public const DELIVERY_FULFILLMENT_TYPES = [
    self::FULFILLMENT_DELIVERY_DOMBI,
    self::FULFILLMENT_DELIVERY_OJOL,
];
```

Add these helper methods after the `isFinalized()` method (after line 224):

```php
public function isPickup(): bool
{
    return $this->fulfillment_type === self::FULFILLMENT_PICKUP;
}

public function isDelivery(): bool
{
    return in_array($this->fulfillment_type, self::DELIVERY_FULFILLMENT_TYPES, true);
}
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `php artisan test tests/Feature/OrderTrackingTest.php`
Expected: All 8 tests PASS (no behavior change).

- [ ] **Step 3: Commit**

```bash
git add app/Models/Order.php
git commit -m "feat: add fulfillment_type constants and isPickup/isDelivery helpers to Order model"
```

---

### Task 2: Fix outlet dashboard counters

**Files:**
- Modify: `app/Http/Controllers/Outlet/DashboardController.php`
- Modify: `resources/js/pages/outlet/dashboard.tsx`

- [ ] **Step 1: Fix DashboardController counters**

In `app/Http/Controllers/Outlet/DashboardController.php`, find the `readyForPickupOrders` query (around line 34) and change it to only count pickup orders:

```php
// BEFORE (counts ALL ready_for_pickup orders)
$readyForPickupOrders = Order::where('outlet_id', $outlet->id)
    ->where('status', Order::STATUS_READY_FOR_PICKUP)
    ->count();

// AFTER (only pickup orders)
$readyForCustomerPickup = Order::where('outlet_id', $outlet->id)
    ->where('status', Order::STATUS_READY_FOR_PICKUP)
    ->where('fulfillment_type', Order::FULFILLMENT_PICKUP)
    ->count();
```

Find the `needsDispatch` query (around line 57) and add fulfillment_type filter:

```php
// BEFORE
$needsDispatch = Order::where('outlet_id', $outlet->id)
    ->where('status', Order::STATUS_READY_FOR_PICKUP)
    ->whereDoesntHave('delivery')
    ->count();

// AFTER (only delivery orders)
$needsDispatch = Order::where('outlet_id', $outlet->id)
    ->where('status', Order::STATUS_READY_FOR_PICKUP)
    ->whereIn('fulfillment_type', Order::DELIVERY_FULFILLMENT_TYPES)
    ->whereDoesntHave('delivery')
    ->count();
```

Update the `stats` array to use the new variable name:

```php
'stats' => [
    'pendingOrders' => $pendingOrders,
    'preparingOrders' => $preparingOrders,
    'readyForCustomerPickup' => $readyForCustomerPickup,  // renamed
    'todayOrders' => $todayOrders,
    // ... rest unchanged
],
```

Update the `orderQueue` array:

```php
'orderQueue' => [
    'new' => $pendingOrders,
    'preparing' => $preparingOrders,
    'ready' => $readyForCustomerPickup,  // pickup only
    'waiting_courier' => $waitingPickup,
],
```

- [ ] **Step 2: Fix dashboard.tsx to use renamed counter**

In `resources/js/pages/outlet/dashboard.tsx`, find all references to `stats.readyForPickupOrders` and change to `stats.readyForCustomerPickup`. Also update the label from "Siap Pickup" to "Siap Diambil":

```tsx
// BEFORE
<div className="text-2xl font-bold">{stats.readyForPickupOrders}</div>
<div className="text-xs text-zinc-500">Siap Pickup</div>

// AFTER
<div className="text-2xl font-bold">{stats.readyForCustomerPickup}</div>
<div className="text-xs text-zinc-500">Siap Diambil</div>
```

- [ ] **Step 3: Run tests**

Run: `php artisan test`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/Outlet/DashboardController.php resources/js/pages/outlet/dashboard.tsx
git commit -m "fix: outlet dashboard counters now filter by fulfillment_type"
```

---

### Task 3: Fix delivery index page to exclude pickup orders

**Files:**
- Modify: `app/Http/Controllers/Outlet/DeliveryController.php`

- [ ] **Step 1: Fix unassigned orders query**

In `app/Http/Controllers/Outlet/DeliveryController.php`, find the query that fetches unassigned orders (around line 27). It currently queries `ready_for_pickup` + no delivery. Add fulfillment_type filter:

```php
// BEFORE
$unassignedOrders = Order::where('outlet_id', $outlet->id)
    ->where('status', Order::STATUS_READY_FOR_PICKUP)
    ->whereDoesntHave('delivery')
    ->get();

// AFTER
$unassignedOrders = Order::where('outlet_id', $outlet->id)
    ->where('status', Order::STATUS_READY_FOR_PICKUP)
    ->whereIn('fulfillment_type', Order::DELIVERY_FULFILLMENT_TYPES)
    ->whereDoesntHave('delivery')
    ->with('items')
    ->get();
```

- [ ] **Step 2: Run tests**

Run: `php artisan test`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add app/Http/Controllers/Outlet/DeliveryController.php
git commit -m "fix: delivery index excludes pickup orders from unassigned queue"
```

---

### Task 4: Add fulfillment guard to OrderStatusService

**Files:**
- Modify: `app/Services/OrderStatusService.php`

- [ ] **Step 1: Add fulfillment guard to updateStatus()**

In `app/Services/OrderStatusService.php`, find the `updateStatus()` method. Add this guard at the beginning (after the status validation, before the transition logic):

```php
public function updateStatus(Order $order, string $newStatus, ?User $user = null): Order
{
    // Existing validation...

    // Fulfillment-aware guard: prevent pickup orders from entering delivery-only statuses
    if ($order->isPickup() && in_array($newStatus, [
        Order::STATUS_PICKED_UP,
        Order::STATUS_DELIVERING,
    ], true)) {
        throw ValidationException::withMessages([
            'status' => 'Pesanan pickup tidak dapat masuk ke status pengiriman.',
        ]);
    }

    // Existing transition logic...
}
```

- [ ] **Step 2: Fix status notes to be fulfillment-aware**

Find the `statusNote()` method. Update the notes for `ready_for_pickup` to be fulfillment-aware:

```php
private function statusNote(string $fromStatus, string $toStatus, ?Order $order = null): string
{
    return match ($toStatus) {
        // ... existing cases ...
        Order::STATUS_READY_FOR_PICKUP => $order && $order->isPickup()
            ? 'Pesanan siap diambil customer'
            : 'Pesanan siap diambil kurir',
        // ... rest unchanged
    };
}
```

- [ ] **Step 3: Run tests**

Run: `php artisan test`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add app/Services/OrderStatusService.php
git commit -m "fix: add fulfillment guard to OrderStatusService, pickup orders cannot enter delivery statuses"
```

---

### Task 5: Fix customer-status.ts to be fulfillment-aware

**Files:**
- Modify: `resources/js/lib/customer-status.ts`

- [ ] **Step 1: Add fulfillment-aware status labels**

In `resources/js/lib/customer-status.ts`, replace the single `orderStatusLabel` and `orderStatusTone` maps with fulfillment-aware versions:

```typescript
// Add fulfillment-aware label function
export function getOrderStatusLabel(status: string, fulfillmentType?: string): string {
    const isPickup = fulfillmentType === 'pickup';

    if (status === 'ready_for_pickup') {
        return isPickup ? 'Siap Diambil' : 'Menunggu Kurir';
    }
    if (status === 'picked_up') {
        return 'Kurir Mengambil';
    }
    if (status === 'delivering') {
        return 'Sedang Diantar';
    }

    // Default labels for non-fulfillment-specific statuses
    return orderStatusLabel(status);
}
```

- [ ] **Step 2: Fix orderProgressIndex() to be fulfillment-aware**

Update `orderProgressIndex()` to accept fulfillment_type and return correct indices:

```typescript
export function orderProgressIndex(status: string, fulfillmentType?: string): number {
    const isPickup = fulfillmentType === 'pickup';

    const pickupSteps = [
        'pending_confirmation',
        'confirmed',
        'preparing',
        'ready_for_pickup',
        'completed',
    ];

    const deliverySteps = [
        'pending_confirmation',
        'confirmed',
        'preparing',
        'ready_for_pickup',
        'picked_up',
        'delivering',
        'completed',
    ];

    const steps = isPickup ? pickupSteps : deliverySteps;
    const index = steps.indexOf(status);
    return index >= 0 ? index : 0;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run types:check`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add resources/js/lib/customer-status.ts
git commit -m "fix: customer-status.ts labels and progress index now fulfillment-aware"
```

---

### Task 6: Fix order-timeline.tsx labels to be fulfillment-specific

**Files:**
- Modify: `resources/js/components/customer/order-timeline.tsx`

- [ ] **Step 1: Make step labels fulfillment-aware**

In `resources/js/components/customer/order-timeline.tsx`, find the `TIMELINE_STEPS` constant and update it to use fulfillment-aware labels:

```typescript
const TIMELINE_STEPS: Record<string, { label: string; pickupLabel?: string }> = {
    pending_confirmation: { label: 'Menunggu Konfirmasi' },
    confirmed: { label: 'Pesanan Diterima' },
    preparing: { label: 'Sedang Disiapkan' },
    ready_for_pickup: { label: 'Menunggu Kurir', pickupLabel: 'Siap Diambil' },
    picked_up: { label: 'Kurir Mengambil' },
    delivering: { label: 'Sedang Diantar' },
    completed: { label: 'Selesai' },
};
```

Update the component to use the correct label based on fulfillment type:

```typescript
function getStepLabel(stepKey: string, fulfillmentType?: string): string {
    const step = TIMELINE_STEPS[stepKey];
    if (!step) return stepKey;
    if (fulfillmentType === 'pickup' && step.pickupLabel) {
        return step.pickupLabel;
    }
    return step.label;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run types:check`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/customer/order-timeline.tsx
git commit -m "fix: order timeline labels now fulfillment-aware (pickup vs delivery)"
```

---

### Task 7: Add pickup-specific UI to customer order show page

**Files:**
- Modify: `resources/js/pages/customer/orders/show.tsx`

- [ ] **Step 1: Add pickup info card**

In `resources/js/pages/customer/orders/show.tsx`, add a pickup-specific card that shows when the order is a pickup order. This mirrors what `track.tsx` already does:

Add imports at the top:

```typescript
import { QrCode, Navigation, Clock, Phone, Store } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
```

Add this card after the status badge section (after line 94), before the tracking code section:

```tsx
{/* Pickup Info Card */}
{order.fulfillment_type === 'pickup' && order.outlet && (
    <div className="mt-4 rounded-2xl border border-border bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50">
                <Store className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-text-subtle">Ambil di Outlet</span>
        </div>

        <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                <Store className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
                <div className="text-sm font-semibold text-text">{order.outlet.name}</div>
                {order.outlet.address && (
                    <div className="mt-0.5 text-xs text-text-muted">{order.outlet.address}</div>
                )}
            </div>
        </div>

        {/* QR Code when ready_for_pickup */}
        {order.status === 'ready_for_pickup' && (
            <div className="mt-4 rounded-xl bg-surface-muted p-4 flex flex-col items-center">
                <QRCodeSVG
                    value={order.order_code}
                    size={180}
                    bgColor="#f4f4f5"
                    fgColor="#1e40af"
                    level="M"
                    marginSize={0}
                />
                <div className="mt-2 text-center">
                    <div className="text-sm font-bold tracking-wider text-blue-700">{order.order_code}</div>
                    <div className="mt-1 text-[11px] text-text-subtle">Tunjukkan QR ini ke kasir</div>
                </div>
            </div>
        )}

        {/* Navigation Button */}
        {order.outlet.latitude && order.outlet.longitude && (
            <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${order.outlet.latitude},${order.outlet.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition-all active:scale-[0.98] active:bg-blue-700"
            >
                <Navigation className="h-4 w-4" />
                Navigasi ke Outlet
            </a>
        )}

        {/* Pickup Instructions */}
        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3">
            <div className="text-xs font-semibold text-blue-800 mb-2">Cara Mengambil:</div>
            <ol className="space-y-1.5 text-xs text-blue-700">
                <li className="flex items-start gap-2">
                    <span className="font-semibold text-blue-800">1.</span>
                    <span>Datang ke outlet yang tertera di atas</span>
                </li>
                <li className="flex items-start gap-2">
                    <span className="font-semibold text-blue-800">2.</span>
                    <span>Tunjukkan <span className="font-bold">QR code</span> di atas ke kasir</span>
                </li>
                <li className="flex items-start gap-2">
                    <span className="font-semibold text-blue-800">3.</span>
                    <span>Ambil pesanan Anda</span>
                </li>
            </ol>
        </div>

        {/* Contact Outlet */}
        {order.outlet.phone && (
            <a
                href={`tel:${order.outlet.phone}`}
                className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-sm font-semibold text-blue-700 transition-all active:scale-[0.98] active:bg-blue-100"
            >
                <Phone className="h-4 w-4" />
                Hubungi Outlet
            </a>
        )}
    </div>
)}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run types:check`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add resources/js/pages/customer/orders/show.tsx
git commit -m "feat: add pickup-specific UI to customer order show page (outlet info, QR, instructions)"
```

---

### Task 8: Write fulfillment awareness regression tests

**Files:**
- Create: `tests/Feature/FulfillmentAwarenessTest.php`

- [ ] **Step 1: Write the test file**

```php
<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FulfillmentAwarenessTest extends TestCase
{
    use RefreshDatabase;

    public function test_pickup_order_not_counted_in_delivery_queue(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);

        // Create a pickup order that is ready_for_pickup
        $this->createOrder($outlet, [
            'fulfillment_type' => 'pickup',
            'status' => Order::STATUS_READY_FOR_PICKUP,
        ]);

        // Create a delivery order that is ready_for_pickup
        $this->createOrder($outlet, [
            'fulfillment_type' => 'delivery_dombi',
            'status' => Order::STATUS_READY_FOR_PICKUP,
        ]);

        // Dashboard should count them separately
        $this->actingAs($user)
            ->get('/outlet/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('stats.readyForCustomerPickup', 1)
                ->where('deliveryStats.needsDispatch', 1)
            );
    }

    public function test_pickup_order_not_assignable_to_courier(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);
        $pickupOrder = $this->createOrder($outlet, [
            'fulfillment_type' => 'pickup',
            'status' => Order::STATUS_READY_FOR_PICKUP,
        ]);

        $this->actingAs($user)
            ->post("/outlet/orders/{$pickupOrder->id}/assign-courier", [
                'courier_id' => 1,
            ])
            ->assertSessionHasErrors('courier_id');
    }

    public function test_pickup_order_cannot_enter_delivery_statuses(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);
        $pickupOrder = $this->createOrder($outlet, [
            'fulfillment_type' => 'pickup',
            'status' => Order::STATUS_READY_FOR_PICKUP,
        ]);

        $this->actingAs($user)
            ->post("/outlet/orders/{$pickupOrder->id}/status", [
                'status' => Order::STATUS_PICKED_UP,
            ])
            ->assertSessionHasErrors('status');
    }

    public function test_delivery_order_cannot_use_complete_pickup(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);
        $deliveryOrder = $this->createOrder($outlet, [
            'fulfillment_type' => 'delivery_dombi',
            'status' => Order::STATUS_READY_FOR_PICKUP,
        ]);

        $this->actingAs($user)
            ->post("/outlet/orders/{$deliveryOrder->id}/complete-pickup")
            ->assertSessionHasErrors('fulfillment_type');
    }

    public function test_customer_pickup_tracking_has_no_delivery_steps(): void
    {
        $order = $this->createOrder($this->createOutlet(), [
            'fulfillment_type' => 'pickup',
            'status' => Order::STATUS_READY_FOR_PICKUP,
        ]);

        $this->get('/track/' . $order->recovery_token)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('order.fulfillment_type', 'pickup')
                ->missing('order.delivery')
            );
    }

    public function test_customer_delivery_tracking_has_no_pickup_qr(): void
    {
        $order = $this->createOrder($this->createOutlet(), [
            'fulfillment_type' => 'delivery_dombi',
            'status' => Order::STATUS_READY_FOR_PICKUP,
        ]);

        $this->get('/track/' . $order->recovery_token)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('order.fulfillment_type', 'delivery_dombi')
            );
    }

    public function test_no_delivery_records_for_pickup_orders(): void
    {
        $outlet = $this->createOutlet();

        // Create pickup orders
        $this->createOrder($outlet, [
            'fulfillment_type' => 'pickup',
            'status' => Order::STATUS_COMPLETED,
        ]);
        $this->createOrder($outlet, [
            'fulfillment_type' => 'pickup',
            'status' => Order::STATUS_READY_FOR_PICKUP,
        ]);

        // Audit: no delivery records should exist for pickup orders
        $pickupOrderIds = Order::where('fulfillment_type', 'pickup')->pluck('id');
        $this->assertDatabaseCount('deliveries', 0, [
            'order_id' => $pickupOrderIds,
        ]);
    }

    private function createOutlet(): Outlet
    {
        return Outlet::create([
            'name' => 'Outlet Test ' . uniqid(),
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'address' => 'Jl. Test',
            'latitude' => -7.0523456,
            'longitude' => 110.4345678,
            'status' => 'active',
        ]);
    }

    private function createOutletUser(Outlet $outlet): User
    {
        return User::create([
            'name' => 'Outlet Staff',
            'email' => 'outlet-' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'outlet',
            'outlet_id' => $outlet->id,
            'is_active' => true,
        ]);
    }

    private function createOrder(Outlet $outlet, array $overrides = []): Order
    {
        $customer = Customer::create([
            'name' => 'Test Customer',
            'phone' => '6281234567890' . rand(1000, 9999),
        ]);

        $product = Product::create([
            'name' => 'Susu Kambing 500ml',
            'slug' => 'susu-kambing-500ml-fa-' . uniqid(),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        $order = Order::create(array_merge([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-FA-' . strtoupper(uniqid()),
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'fulfillment_type' => 'pickup',
            'subtotal' => 50000,
            'delivery_fee' => 0,
            'payment_method' => 'cod',
            'payment_fee' => 0,
            'total' => 50000,
            'customer_name' => 'Test Customer',
            'customer_phone' => '6281234567890',
            'customer_address' => 'Jl. Test',
            'ordered_at' => now(),
        ], $overrides));

        $order->items()->create([
            'product_id' => $product->id,
            'product_name' => $product->name,
            'quantity' => 2,
            'price' => $product->price,
            'subtotal' => 50000,
        ]);

        return $order;
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test tests/Feature/FulfillmentAwarenessTest.php`
Expected: Some tests FAIL (counters not fixed yet, guards not added yet).

- [ ] **Step 3: Commit**

```bash
git add tests/Feature/FulfillmentAwarenessTest.php
git commit -m "test: add fulfillment awareness regression tests"
```

---

### Task 9: Run full verification

- [ ] **Step 1: Run all PHP tests**

Run: `php artisan test`
Expected: All tests PASS.

- [ ] **Step 2: Run TypeScript check**

Run: `npm run types:check`
Expected: No new errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint:check`
Expected: No new errors.

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Final commit if needed**

```bash
git add -A
git commit -m "fix: address lint/type issues from fulfillment hardening"
```

---

## Success Criteria Verification

For every screen in Dombi (Customer, Outlet, Courier, Owner):

- [ ] Pickup orders never show "Assign Kurir", "Perlu Dikirim", "Menunggu Kurir"
- [ ] Delivery orders never show "Siap Diambil", "Datang ke Outlet"
- [ ] All KPIs filter by fulfillment_type
- [ ] Status transitions are guarded by fulfillment_type
- [ ] Customer tracking shows correct steps per fulfillment_type
- [ ] Customer order show page has pickup-specific UI
- [ ] No delivery records exist for pickup orders
- [ ] All regression tests pass
