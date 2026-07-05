# Frontend Cleanup Action Plan

> Generated: 2026-07-05
> Status: **Pending Review**

---

## P0 — Delete Dead Code (16 files)

Zero imports anywhere. Safe to delete.

| # | File | Lines |
|---|---|---|
| 1 | `components/customer/cart-confirmation-sheet.tsx` | — |
| 2 | `components/customer/order-summary-card.tsx` | 45 |
| 3 | `components/customer/recipient-selector.tsx` | — |
| 4 | `components/customer/sticky-order-actions.tsx` | — |
| 5 | `components/customer/order-card.tsx` | 48 |
| 6 | `components/dashboard-card.tsx` | — |
| 7 | `components/dev-toolbar.tsx` | — |
| 8 | `components/loading-button.tsx` | — |
| 9 | `components/notification-list.tsx` | — |
| 10 | `components/owner-mobile-nav.tsx` | — |
| 11 | `components/owner/center-price-edit-modal.tsx` | — |
| 12 | `components/owner/finance/finance-kpi-card.tsx` | — |
| 13 | `components/owner/outlet-attention-list.tsx` | — |
| 14 | `components/owner/outlet-location-map.tsx` | — |
| 15 | `components/owner/owner-action-card.tsx` | — |
| 16 | `components/owner/pricing-edit-modal.tsx` | — |
| 17 | `components/ui/data-table.tsx` | — |

**Verify:** `npm run build` passes after deletion.

---

## P1 — Add Barrel Exports (3 folders)

Create `index.ts` in high-traffic folders to simplify imports.

### 1.1 `components/ui/index.ts`

```ts
export { default as BottomSheet } from './bottom-sheet';
export { default as Button } from './button';
export { default as CustomSelect } from './custom-select';
export { default as Dialog } from './dialog';
export { default as EmptyState } from './empty-state';
export { default as ExpandableSection } from './expandable-section';
export { default as FilterChips } from './filter-chips';
export { default as Input } from './input';
export { default as MobileRoleLayout } from './mobile-role-layout';
export { default as PageHeader } from './page-header';
export { default as PhoneInput } from './phone-input';
export { default as SectionCard } from './section-card';
export { default as Select } from './select';
export { default as SideSheet } from './side-sheet';
export { Skeleton, SkeletonList } from './skeleton';
export { default as StatusBadge } from './status-badge';
export { default as StickyActionBar } from './sticky-action-bar';
export { default as Textarea } from './textarea';
```

### 1.2 `components/customer/index.ts`

```ts
export { default as ActiveOrderBar } from './active-order-bar';
export { default as ActiveOrderCard } from './active-order-card';
export { default as AddressForm } from './address-form';
export { default as BottomNav } from './bottom-nav';
export { default as CheckoutItemCard } from './checkout-item-card';
export { default as CustomerLocationBootstrap } from './customer-location-bootstrap';
export { default as CustomerTopBar } from './customer-top-bar';
export { default as DeliveryLoginSheet } from './delivery-login-sheet';
export { default as DeliveryQuoteCard } from './delivery-quote-card';
export { default as EmptyOrderState } from './empty-order-state';
export { default as FloatingCartBar } from './floating-cart-bar';
export { default as ForeGreenHeader } from './fore-green-header';
export { default as FulfillmentToggle } from './fulfillment-toggle';
export { default as LeafletPicker } from './leaflet-picker';
export { default as LocationSearchPanel } from './location-search-panel';
export { default as LocationSheet } from './location-sheet';
export { default as OrderFilterChips } from './order-filter-chips';
export { default as OrderHistoryCard } from './order-history-card';
export { default as OrderQrCard } from './order-qr-card';
export { default as OrderTimeline } from './order-timeline';
export { default as OutletSheet } from './outlet-sheet';
export { default as PickupOutletSelector } from './pickup-outlet-selector';
export { default as ProductImage } from './product-image';
export { default as RecoverySheet } from './recovery-sheet';
export { default as SizeSelectorSheet } from './size-selector-sheet';
export { default as StepButton } from './step-button';
export { default as StepHeader } from './step-header';
export { default as StoreLocationCard } from './store-location-card';
export { default as VariantListItem } from './variant-list-item';
```

### 1.3 `components/owner/index.ts`

```ts
export { default as AssignCourierSheet } from './assign-courier-sheet';
export { default as CourierAvailabilityCard } from './courier-availability-card';
export { default as DeliveryBoardColumn } from './delivery-board-column';
export { default as DeliveryCard } from './delivery-card';
export { default as DeliveryPerformanceCard } from './delivery-performance-card';
export { default as HolidayManager } from './holiday-manager';
export { default as InvoiceModal } from './invoice-modal';
export { default as OperatingHoursManager } from './operating-hours-manager';
export { default as OrderStatusChip } from './order-status-chip';
export { default as OutletFormSheet } from './outlet-form-sheet';
export { default as OutletProducts } from './outlet-products';
export { default as OutletProvisioningSummary } from './outlet-provisioning-summary';
export { default as OutletStatusBadge } from './outlet-status-badge';
export { default as OwnerCommandSheet } from './owner-command-sheet';
export { default as OwnerDashboardSkeleton } from './owner-dashboard-skeleton';
export { default as OwnerKpiCard } from './owner-kpi-card';
export { default as OwnerPageShell } from './owner-page-shell';
export { default as OwnerPageSkeleton } from './owner-page-skeleton';
export { default as OwnerSidebarNav } from './owner-sidebar-nav';
export { default as ResolveDeliverySheet } from './resolve-delivery-sheet';
export { default as RestockModal } from './restock-modal';
export { default as SettlementPaymentModal } from './settlement-payment-modal';
export { default as TambahProdukModal } from './tambah-produk-modal';
```

**Verify:** Existing imports still work (barrel is additive, not breaking).

---

## P2 — Move Root-Level Components (12 files)

| File | Current | Target | Reason |
|---|---|---|---|
| `courier-bottom-nav.tsx` | `components/` | `components/courier/bottom-nav.tsx` | Courier domain |
| `notification-bell.tsx` | `components/` | `components/shared/notification-bell.tsx` | Shared |
| `notification-sheet.tsx` | `components/` | `components/shared/notification-sheet.tsx` | Shared |
| `offline-banner.tsx` | `components/` | `components/shared/offline-banner.tsx` | Shared |
| `update-banner.tsx` | `components/` | `components/shared/update-banner.tsx` | Shared |
| `outlet-navigation-sheet.tsx` | `components/` | `components/outlet/navigation-sheet.tsx` | Outlet domain |
| `pagination.tsx` | `components/` | `components/ui/pagination.tsx` | Generic UI |
| `delivery-status-badge.tsx` | `components/` | `components/ui/delivery-status-badge.tsx` | Generic UI |
| `distribution-status-badge.tsx` | `components/` | `components/ui/distribution-status-badge.tsx` | Generic UI |
| `order-status-badge.tsx` | `components/` | `components/ui/order-status-badge.tsx` | Generic UI |
| `restock-status-badge.tsx` | `components/` | `components/ui/restock-status-badge.tsx` | Generic UI |
| `stock-level-badge.tsx` | `components/` | `components/ui/stock-level-badge.tsx` | Generic UI |

**Steps per file:**
1. Move file to target location
2. Update all imports (grep for old path → replace with new path)
3. Add to barrel export in target folder's `index.ts`
4. `npm run build` to verify

**Verify:** `npm run build` passes. No broken imports.

---

## P3 — Split Large Files (10 files >500 lines)

### 3.1 `owner/pricing/index.tsx` (1116 lines) → 4 files

```
owner/pricing/
├── index.tsx              (~150 lines) — page shell, state, routing
├── pricing-table.tsx      (~300 lines) — price list table
├── pricing-edit-modal.tsx (~200 lines) — edit form
├── pricing-filters.tsx    (~100 lines) — filter/search bar
└── pricing-utils.ts       (~50 lines)  — helpers
```

### 3.2 `owner/analytics/index.tsx` (896 lines) → 3 files

```
owner/analytics/
├── index.tsx              (~200 lines) — page shell, data fetching
├── analytics-charts.tsx   (~400 lines) — chart components
└── analytics-cards.tsx    (~200 lines) — KPI cards
```

### 3.3 `owner/finance/index.tsx` (788 lines) → 3 files

```
owner/finance/
├── index.tsx              (~200 lines) — page shell
├── finance-table.tsx      (~300 lines) — data table
└── finance-summary.tsx    (~150 lines) — summary cards
```

### 3.4 `track.tsx` (763 lines) → 3 files

```
pages/
├── track.tsx              (~200 lines) — page shell, data fetching
components/customer/
├── track-timeline.tsx     (~300 lines) — order timeline
├── track-order-info.tsx   (~150 lines) — order details card
```

### 3.5 `customer/orders/show.tsx` (721 lines) → 3 files

```
pages/customer/orders/
├── show.tsx               (~200 lines) — page shell
components/customer/
├── order-detail-card.tsx  (~250 lines) — order info
├── order-detail-actions.tsx (~150 lines) — action buttons
```

### 3.6 `owner/inventories/index.tsx` (641 lines) → 2 files

```
owner/inventories/
├── index.tsx              (~300 lines) — page shell
└── inventory-table.tsx    (~250 lines) — data table
```

### 3.7 `courier/deliveries/show.tsx` (633 lines) → 2 files

```
pages/courier/deliveries/
├── show.tsx               (~300 lines) — page shell
components/courier/
├── delivery-detail.tsx    (~250 lines) — detail card
```

### 3.8 `customer/checkout/customer.tsx` (523 lines) → 2 files

```
pages/customer/checkout/
├── customer.tsx           (~250 lines) — page shell
components/customer/checkout/
├── customer-form.tsx      (~200 lines) — form fields
```

### 3.9 `owner/product-families/show.tsx` (513 lines) → 2 files

```
owner/product-families/
├── show.tsx               (~250 lines) — page shell
└── family-variants.tsx    (~200 lines) — variant list
```

### 3.10 `customer/home.tsx` (509 lines) → 2 files

```
pages/customer/
├── home.tsx               (~250 lines) — page shell
components/customer/
├── home-hero-carousel.tsx (~150 lines) — hero carousel
```

**Verify per split:** `npm run build` passes. No behavioral changes.

---

## P4 — Organize Customer Components (sub-groups)

```
components/customer/
├── layout/                    # Page shell components
│   ├── bottom-nav.tsx
│   ├── customer-top-bar.tsx
│   ├── customer-location-bootstrap.tsx
│   ├── floating-cart-bar.tsx
│   ├── fore-green-header.tsx
│   └── index.ts
│
├── order/                     # Order-related
│   ├── active-order-bar.tsx
│   ├── active-order-card.tsx
│   ├── order-filter-chips.tsx
│   ├── order-history-card.tsx
│   ├── order-qr-card.tsx
│   ├── order-timeline.tsx
│   ├── empty-order-state.tsx
│   ├── recovery-sheet.tsx
│   └── index.ts
│
├── product/                   # Product-related
│   ├── variant-list-item.tsx
│   ├── size-selector-sheet.tsx
│   ├── product-image.tsx
│   └── index.ts
│
├── checkout/                  # Checkout flow
│   ├── checkout-item-card.tsx
│   ├── address-form.tsx
│   ├── fulfillment-toggle.tsx
│   ├── pickup-outlet-selector.tsx
│   ├── delivery-login-sheet.tsx
│   ├── delivery-quote-card.tsx
│   ├── store-location-card.tsx
│   ├── notice-banner.tsx
│   └── index.ts
│
├── location/                  # Location/map
│   ├── leaflet-picker.tsx
│   ├── location-search-panel.tsx
│   ├── location-sheet.tsx
│   ├── current-location-button.tsx
│   └── index.ts
│
├── outlet/                    # Outlet selection
│   ├── outlet-sheet.tsx
│   └── index.ts
│
├── step/                      # Step wizard
│   ├── step-button.tsx
│   ├── step-header.tsx
│   └── index.ts
│
└── index.ts                   # Re-exports all sub-groups
```

**Steps:**
1. Create subdirectories
2. Move files
3. Update all imports (grep + replace)
4. Create sub-group `index.ts` files
5. Update root `components/customer/index.ts` to re-export from sub-groups
6. `npm run build`

---

## P5 — Consolidate Status Badges (6 → 1)

Current: 6 separate badge files, each with different config.

Target: Single `ui/status-badge.tsx` with domain configs:

```tsx
// ui/status-badge.tsx
const STATUS_CONFIGS = {
    order: { pending: {...}, confirmed: {...}, ... },
    delivery: { assigned: {...}, picked_up: {...}, ... },
    distribution: { pending: {...}, delivered: {...}, ... },
    restock: { pending: {...}, received: {...}, ... },
    stock: { available: {...}, low: {...}, out_of_stock: {...} },
};

export function StatusBadge({ domain, status, ...props }) {
    const config = STATUS_CONFIGS[domain]?.[status];
    // render
}
```

Then delete:
- `order-status-badge.tsx`
- `delivery-status-badge.tsx`
- `distribution-status-badge.tsx`
- `restock-status-badge.tsx`
- `stock-level-badge.tsx`

Update all imports to use unified `StatusBadge`.

---

## Execution Order

```
P0 (dead code)     → immediate, zero risk
  ↓
P1 (barrel exports) → additive, no breaking changes
  ↓
P2 (move files)     → import path changes, build verifies
  ↓
P4 (organize customer/) → depends on P2
  ↓
P5 (consolidate badges) → depends on P1 (barrel exists)
  ↓
P3 (split large files) → highest risk, do last
```

## Estimated Effort

| Phase | Files touched | Time | Risk |
|---|---|---|---|
| P0 | 17 deletes | 5 min | None |
| P1 | 3 new files | 10 min | None |
| P2 | 12 moves + ~50 import updates | 30 min | Low |
| P3 | 10 splits + ~20 import updates | 2 hours | Medium |
| P4 | 37 moves + ~100 import updates | 1 hour | Medium |
| P5 | 6 deletes + ~40 import updates | 30 min | Low |
| **Total** | | **~4 hours** | |

## Verification Checklist

After each phase:
- [ ] `npm run build` passes
- [ ] `npm run lint` passes (if configured)
- [ ] Manual smoke test: customer home → products → checkout → orders
- [ ] Manual smoke test: owner dashboard → orders → inventory
- [ ] Manual smoke test: courier deliveries
