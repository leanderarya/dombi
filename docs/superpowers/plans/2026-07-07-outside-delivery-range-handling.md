# Outside Delivery Range Handling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When customer is outside delivery range, show helpful UX — suggest pickup, don't just block.

**Architecture:** Enhance the checkout flow to handle `is_serviceable: false` gracefully. Show a suggestion card with pickup option and "Ubah Lokasi" button. No backend changes needed — only frontend UX improvements.

**Tech Stack:** React 19 + TypeScript + Tailwind CSS v4 + Inertia.js

---

## Current Behavior

When customer location is outside delivery range:
1. `DeliveryPricingService::quote()` returns `is_serviceable: false`
2. `CheckoutController::submit()` blocks with error "Luar jangkauan"
3. Frontend shows red text "Luar jangkauan Kurir Dombi" — dead end, no guidance

## Proposed Behavior

When customer location is outside delivery range:
1. Show a suggestion card (not just red text)
2. Display: "Delivery belum tersedia di lokasi Anda" + outlet name
3. Show: "Gunakan Pickup" button → switches to pickup flow
4. Show: "Ubah Lokasi" button → opens LocationSheet to try different address

---

### Task 1: Replace red text with suggestion card

**Files:**
- Modify: `resources/js/pages/customer/checkout/customer.tsx`

- [ ] **Step 1: Update DeliveryInfoCard — outside-range section**

Find this section (around line 306-311):

```tsx
) : (
    <div className="flex items-center gap-2">
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
        <span className="text-[11px] font-medium text-red-600">Luar jangkauan Kurir Dombi</span>
    </div>
)}
```

Replace with:

```tsx
) : (
    <div className="space-y-2">
        <div className="flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500 mt-0.5" />
            <div>
                <p className="text-[11px] font-medium text-amber-700">Delivery belum tersedia di lokasi Anda</p>
                {deliveryQuote?.outlet?.name && (
                    <p className="text-[10px] text-text-subtle mt-0.5">Outlet terdekat: {deliveryQuote.outlet.name}</p>
                )}
            </div>
        </div>
        <div className="flex gap-2">
            <button
                type="button"
                onClick={onSwitchToPickup}
                className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white active:opacity-80"
            >
                Gunakan Pickup
            </button>
            <button
                type="button"
                onClick={onEdit}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-[11px] font-semibold text-text active:opacity-80"
            >
                Ubah Lokasi
            </button>
        </div>
    </div>
)}
```

- [ ] **Step 2: Add `onSwitchToPickup` prop to DeliveryInfoCard**

Update the function signature:

```tsx
function DeliveryInfoCard({ addressLine, village, district, city, deliveryQuote, addressLabel, onEdit, onSwitchToPickup }: {
    addressLine: string;
    village: string;
    district: string;
    city: string;
    deliveryQuote: any;
    addressLabel?: string | null;
    onEdit: () => void;
    onSwitchToPickup: () => void;
}) {
```

- [ ] **Step 3: Pass `onSwitchToPickup` when rendering DeliveryInfoCard**

Find where DeliveryInfoCard is rendered and add:

```tsx
onSwitchToPickup={() => {
    localStorage.setItem('dombi_fulfillment_type', 'pickup');
    window.location.href = '/customer/checkout';
}}
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/customer/checkout/customer.tsx
git commit -m "feat: add pickup suggestion when outside delivery range"
```

---

## Verification Checklist

After all tasks:

- [ ] Customer outside delivery range sees "Delivery belum tersedia di lokasi Anda" (amber, not red)
- [ ] Nearest outlet name shown below the message
- [ ] "Gunakan Pickup" button switches to pickup flow
- [ ] "Ubah Lokasi" button opens LocationSheet
- [ ] Existing serviceable delivery flow still works (outlet + distance + fee)
- [ ] `php artisan test --filter=DeliveryPricing` — all existing tests pass
- [ ] TypeScript check passes with no new errors
