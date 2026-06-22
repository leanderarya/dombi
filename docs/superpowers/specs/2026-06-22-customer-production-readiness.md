# Dombi Customer Production Readiness — Audit & Plan

**Date:** 2026-06-22
**Status:** Audit Complete — Pending Implementation
**Skills:** ios-hig-design, refactoring-ui

---

## 1. Guest Flow Audit

### Capability Matrix

| Feature | Guest (Anonymous) | Guest (Recovered) | Authenticated Customer |
|---------|-------------------|-------------------|----------------------|
| Browse products | ✅ | ✅ | ✅ |
| Cart (session) | ✅ | ✅ | ✅ |
| **Pickup checkout** | ✅ | ✅ | ✅ |
| **Delivery checkout** | ❌ (login required) | ❌ (login required) | ✅ |
| Place order | ✅ (pickup only) | ✅ (pickup only) | ✅ |
| Track order | ✅ (token) | ✅ (token) | ✅ |
| View confirmation | ✅ (token) | ✅ (token) | ✅ |
| Cancel order | ✅ (token) | ✅ (token) | ✅ (auth) |
| Contact outlet | ✅ | ✅ | ✅ |
| View timeline | ✅ | ✅ | ✅ |
| Reorder | ❌ | ✅ (session) | ✅ |
| Addresses | ❌ | ❌ | ✅ |
| Account promotion | ✅ (post-OTP) | ✅ | N/A |

### Guest Route Security

| Route | Middleware | Auth Required | Status |
|-------|-----------|---------------|--------|
| `GET /track/{token}` | `web`, `throttle` | No | ✅ Safe |
| `POST /track/{token}/cancel` | `web`, `throttle` | No | ✅ Safe |
| `GET /customer/orders/{id}/confirmation/{token}` | `web`, `guest.or.customer` | No | ✅ Safe |
| `POST /customer/orders/recovery` | `web`, `throttle` | No | ✅ Safe |

### Token Security

- Tokens are 8-char alphanumeric (e.g., `UN5DYQ32`)
- Characters `I`, `O`, `0`, `1` excluded to avoid confusion
- Token is the `recovery_token` field on Order model
- Generated at order creation time
- No expiration (tokens persist forever)
- Rate-limited: 6 cancel requests/minute

---

## 2. Tracking Audit

### Fulfillment Awareness Status

| Component | Fulfillment-Aware? | Issue |
|-----------|-------------------|-------|
| `track.tsx` status badge | ❌ | Shows "Siap Diambil" for delivery orders at `ready_for_pickup` |
| `track.tsx` timeline | ✅ | Uses `OrderTimeline` with proper step filtering |
| `track.tsx` QR code | ✅ | Only shows for pickup + `ready_for_pickup` |
| `track.tsx` delivery address | ✅ | Hidden for pickup |
| `track.tsx` courier card | ✅ | Data-driven, not shown for pickup |
| `customer-status.ts` | Partial | `getOrderStatusLabel()` is aware, but `orderStatusLabel()` is not |
| `order-timeline.tsx` | ✅ | `pickupLabel` override works correctly |

### Issues Found

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1 | Status badge not fulfillment-aware | Medium | `track.tsx:48-61` |
| 2 | `orderStatusLabel()` vs `getOrderStatusLabel()` inconsistency | Low | `customer-status.ts` |
| 3 | Outlet "Pengiriman" section header renders for pickup | Low | `outlet/orders/show.tsx:98` |

---

## 3. Customer UX Audit

### Track Page (Guest Order Detail)

| Issue | Severity | Fix |
|-------|----------|-----|
| Status badge not fulfillment-aware | Medium | Use `getOrderStatusLabel(status, fulfillmentType)` |
| Account promotion form uses `text-slate-*` | Low | Use design tokens |

### Confirmation Page (orders/show)

| Issue | Severity | Fix |
|-------|----------|-----|
| Guest cancel redirects to `/login` | **Critical** | Already fixed — uses `/track/{token}/cancel` for guests |
| Duplicate tracking code sections | Medium | Already fixed — merged into one |

### Customer Orders Show

| Issue | Severity | Fix |
|-------|----------|-----|
| No pickup-specific UI | Medium | Already fixed — added outlet info, QR, instructions |

---

## 4. Production Risk Report

### Critical Risks (Fixed)

| Risk | Status | Fix |
|------|--------|-----|
| Guest cancel redirects to login | ✅ Fixed | `handleCancel()` uses `/track/{token}/cancel` for guests |
| CSRF blocking guest cancel | ✅ Fixed | Exception in `bootstrap/app.php` |
| `customer.inertia` middleware redirecting guests | ✅ Fixed | Route moved outside middleware group |

### Remaining Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| No token expiration | Low | Consider adding 30-day expiry in future |
| `orderStatusLabel()` flat map used in some places | Low | Audit callers, switch to `getOrderStatusLabel()` |
| Session-based cart (no persistence) | Low | Expected behavior for guest checkout |

---

## 5. Refactor Plan

### Task 1: Fix track.tsx status badge (P1)

**File:** `resources/js/pages/track.tsx`

Replace flat `STATUS_LABELS` with fulfillment-aware labels:

```tsx
// BEFORE
const STATUS_LABELS: Record<string, { label: string; description: string }> = {
    ready_for_pickup: { label: 'Siap Diambil', ... },
    // ...
};

// AFTER — use getOrderStatusLabel from customer-status.ts
import { getOrderStatusLabel } from '@/lib/customer-status';

// In the component:
const statusLabel = getOrderStatusLabel(order.status, order.fulfillment_type);
```

### Task 2: Deprecate flat `orderStatusLabel()` (P2)

**File:** `resources/js/lib/customer-status.ts`

Mark `orderStatusLabel()` as deprecated, encourage `getOrderStatusLabel()`:

```typescript
/** @deprecated Use getOrderStatusLabel(status, fulfillmentType) instead */
export function orderStatusLabel(status: string): string {
    return orderStatusLabels[status] ?? status;
}
```

### Task 3: Fix outlet "Pengiriman" section for pickup orders (P2)

**File:** `resources/js/pages/outlet/orders/show.tsx`

Change "Delivery tersedia setelah siap diambil" to only show for delivery orders:

```tsx
// BEFORE
) : (
    <div className="text-sm text-zinc-500">Delivery tersedia setelah siap diambil.</div>
)}

// AFTER
) : isDeliveryOrder ? (
    <div className="text-sm text-zinc-500">Delivery tersedia setelah siap diambil.</div>
) : null)}
```

### Task 4: Add regression tests (P1)

**File:** `tests/Feature/GuestFlowTest.php`

```php
<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GuestFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_view_order_by_token(): void
    {
        $order = $this->createOrder(['status' => Order::STATUS_PENDING_CONFIRMATION]);

        $this->get('/track/' . $order->recovery_token)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('found', true)
                ->where('order.order_code', $order->order_code)
            );
    }

    public function test_guest_can_cancel_order(): void
    {
        $order = $this->createOrder(['status' => Order::STATUS_PENDING_CONFIRMATION]);

        $this->post('/track/' . $order->recovery_token . '/cancel', [
            'reason' => 'Salah Pesan',
        ])->assertJson(['success' => true]);

        $order->refresh();
        $this->assertSame(Order::CANCELLED_BY_CUSTOMER, $order->status);
    }

    public function test_guest_cannot_cancel_completed_order(): void
    {
        $order = $this->createOrder(['status' => Order::STATUS_COMPLETED]);

        $this->post('/track/' . $order->recovery_token . '/cancel', [
            'reason' => 'Salah Pesan',
        ])->assertJson(['success' => false]);
    }

    public function test_guest_cancel_does_not_require_auth(): void
    {
        $order = $this->createOrder(['status' => Order::STATUS_PENDING_CONFIRMATION]);

        // No actingAs() — pure guest
        $this->post('/track/' . $order->recovery_token . '/cancel', [
            'reason' => 'Salah Pesan',
        ])->assertJson(['success' => true]);
    }

    public function test_invalid_token_returns_not_found(): void
    {
        $this->get('/track/INVALID123')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('found', false)
            );
    }

    public function test_pickup_tracking_has_no_delivery_steps(): void
    {
        $order = $this->createOrder([
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

    public function test_delivery_tracking_has_no_pickup_qr(): void
    {
        $order = $this->createOrder([
            'fulfillment_type' => 'delivery_dombi',
            'status' => Order::STATUS_READY_FOR_PICKUP,
        ]);

        $this->get('/track/' . $order->recovery_token)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('order.fulfillment_type', 'delivery_dombi')
            );
    }

    public function test_guest_and_customer_cancel_use_same_service(): void
    {
        $outlet = $this->createOutlet();
        $customer = Customer::create(['name' => 'Test', 'phone' => '6281234567890123']);
        $user = User::create([
            'name' => 'Test',
            'email' => 'test-' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'customer',
            'customer_id' => $customer->id,
        ]);

        // Guest cancel
        $guestOrder = $this->createOrder(['status' => Order::STATUS_PENDING_CONFIRMATION]);
        $this->post('/track/' . $guestOrder->recovery_token . '/cancel', [
            'reason' => 'Salah Pesan',
        ])->assertJson(['success' => true]);

        // Customer cancel
        $customerOrder = $this->createOrder([
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'customer_id' => $customer->id,
        ]);
        $this->actingAs($user)
            ->post('/customer/orders/' . $customerOrder->id . '/cancel', [
                'reason' => 'Salah Pesan',
            ])
            ->assertRedirect();

        // Both should be cancelled
        $guestOrder->refresh();
        $customerOrder->refresh();
        $this->assertSame(Order::CANCELLED_BY_CUSTOMER, $guestOrder->status);
        $this->assertSame(Order::CANCELLED_BY_CUSTOMER, $customerOrder->status);
    }

    private function createOutlet(): Outlet
    {
        return Outlet::create([
            'name' => 'Test Outlet ' . uniqid(),
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'address' => 'Jl. Test',
            'latitude' => -7.05,
            'longitude' => 110.43,
            'status' => 'active',
        ]);
    }

    private function createOrder(array $overrides = []): Order
    {
        $outlet = $this->createOutlet();
        $customer = Customer::create(['name' => 'Guest', 'phone' => '628123456789' . rand(1000, 9999)]);
        $product = Product::create([
            'name' => 'Test Product',
            'slug' => 'test-' . uniqid(),
            'unit' => 'pcs',
            'price' => 25000,
            'is_active' => true,
        ]);

        $order = Order::create(array_merge([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'TEST-' . strtoupper(uniqid()),
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'fulfillment_type' => 'pickup',
            'subtotal' => 50000,
            'delivery_fee' => 0,
            'payment_method' => 'cod',
            'payment_fee' => 0,
            'total' => 50000,
            'customer_name' => 'Guest',
            'customer_phone' => '628123456789',
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

---

## 6. Implementation Priority

| Priority | Task | Impact | Effort |
|----------|------|--------|--------|
| P1 | Fix track.tsx status badge | Delivery customers see correct status | Low |
| P1 | Add regression tests | Prevent future bugs | Medium |
| P2 | Deprecate flat `orderStatusLabel()` | Code consistency | Low |
| P2 | Fix outlet "Pengiriman" section for pickup | Minor UX | Low |

---

## Success Criteria

- [ ] Guest can view order details without login
- [ ] Guest can cancel order without login
- [ ] Guest cannot cancel completed orders
- [ ] Pickup tracking shows no delivery steps
- [ ] Delivery tracking shows no pickup QR
- [ ] Status badge is fulfillment-aware
- [ ] Customer and guest have consistent cancel behavior
- [ ] Invalid tokens show "not found"
- [ ] All regression tests pass
