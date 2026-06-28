# Owner Dashboard Restructuring — Design Spec

**Date:** 2026-06-28
**Goal:** Simplify owner role from 20+ sidebar items to 13 items by merging similar pages
**Approach:** Merge similar pages into tabbed interfaces

---

## Problem

Owner role has 6 groups, 20+ sidebar items, ~37 pages. Too many pages confuse users. Other roles (customer, outlet, courier) are already clean and consistent.

## Solution

Merge similar pages into tabbed interfaces:
- **Keuangan** (3→1): Tagihan + Pembayaran + Rekening
- **Harga** (3→1): Pusat + Outlet + Riwayat
- **Analitik** (4→1): Dashboard + Audit Trail + Laporan + Masalah

**Result:** 6 groups, 13 items, ~25 pages

---

## Design Language (Consistent with Customer, Outlet, Courier)

### Tokens
```
text-text          → Primary text
text-text-muted    → Secondary text
text-text-subtle   → Tertiary text
border-border      → Default border
bg-surface         → Page background
bg-surface-muted   → Card background
bg-primary         → Accent/CTA
```

### Typography
- Page title: `text-xl font-semibold`
- Section title: `text-sm font-bold uppercase tracking-wider text-text-subtle`
- Card title: `text-base font-semibold`
- Body: `text-sm text-text-muted`
- Caption: `text-xs text-text-subtle`

### Spacing
- Section gap: `space-y-4`
- Card gap: `space-y-2`
- Card padding: `p-5`
- Section padding: `mb-4`

### Card Style
```
rounded-xl border border-border bg-white p-5
```

### Tab Pills Style
```
rounded-full px-3.5 py-1.5 text-xs font-medium
Active: bg-primary text-white shadow-sm shadow-primary/20
Inactive: bg-surface-muted text-text-muted hover:bg-zinc-200
```

---

## Page Designs

### 1. Keuangan Page (3→1)

**URL:** `/owner/finance`
**Sidebar:** "Keuangan"

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Keuangan                                                │
│ Pantau kewajiban seluruh outlet                         │
├─────────────────────────────────────────────────────────┤
│ [Tagihan] [Pembayaran] [Rekening]    ← Tab Pills       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────┐  ┌─────────────────────────┐  │
│  │ Content Area        │  │ KPI Sidebar (sticky)    │  │
│  │                     │  │                         │  │
│  │ Tagihan:            │  │ Total Belum Dibayar     │  │
│  │ - Filter tabs       │  │ Rp 12.500.000           │  │
│  │ - Outlet cards      │  │                         │  │
│  │                     │  │ Outlet Belum Bayar      │  │
│  │ Pembayaran:         │  │ 3 outlet                │  │
│  │ - Filter tabs       │  │                         │  │
│  │ - Payment cards     │  │ Jatuh Tempo Minggu Ini  │  │
│  │ - Verifikasi Semua  │  │ Rp 5.000.000            │  │
│  │                     │  │                         │  │
│  │ Rekening:           │  └─────────────────────────┘  │
│  │ - Form tambah       │                               │
│  │ - Account list      │                               │
│  │                     │                               │
│  └─────────────────────┘                               │
└─────────────────────────────────────────────────────────┘
```

**URL Structure:**
- `/owner/finance` → default tab "Tagihan"
- `/owner/finance?tab=pembayaran` → tab "Pembayaran"
- `/owner/finance?tab=rekening` → tab "Rekening"

**Business Logic:**
- Tab "Tagihan": Owner bisa lihat tagihan outlet, filter by status
- Tab "Pembayaran": Owner bisa verifikasi/tolak pembayaran
- Tab "Rekening": Owner bisa kelola rekening bank

---

### 2. Harga Page (3→1)

**URL:** `/owner/pricing`
**Sidebar:** "Harga"

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Harga                                                   │
│ Kelola harga jual produk                                │
├─────────────────────────────────────────────────────────┤
│ [Pusat] [Outlet] [Riwayat]           ← Tab Pills       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────┐  ┌─────────────────────────┐  │
│  │ Content Area        │  │ KPI Sidebar (sticky)    │  │
│  │                     │  │                         │  │
│  │ Pusat:              │  │ Total Produk            │  │
│  │ - Search + filter   │  │ 24 SKU                  │  │
│  │ - Price grid        │  │                         │  │
│  │ - Edit inline       │  │ Harga Bervariasi        │  │
│  │                     │  │ 8 produk                │  │
│  │ Outlet:             │  │                         │  │
│  │ - Outlet selector   │  │ Margin Terendah         │  │
│  │ - Price grid        │  │ Rp 5.000                │  │
│  │ - Copy from master  │  │                         │  │
│  │ - Bulk update       │  └─────────────────────────┘  │
│  │                     │                               │
│  │ Riwayat:            │                               │
│  │ - Date filter       │                               │
│  │ - Change list       │                               │
│  │                     │                               │
│  └─────────────────────┘                               │
└─────────────────────────────────────────────────────────┘
```

**URL Structure:**
- `/owner/pricing` → default tab "Pusat"
- `/owner/pricing?tab=outlet` → tab "Outlet"
- `/owner/pricing?tab=riwayat` → tab "Riwayat"

**Business Logic:**
- Tab "Pusat": Owner bisa edit harga master
- Tab "Outlet": Owner bisa override harga per outlet
- Tab "Riwayat": Owner bisa lihat riwayat perubahan harga

---

### 3. Analitik Page (4→1)

**URL:** `/owner/analytics`
**Sidebar:** "Analitik"

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Analitik                                                │
│ Analitik performa bisnis                                │
├─────────────────────────────────────────────────────────┤
│ [Dashboard] [Audit Trail] [Laporan] [Masalah]  ← Tabs  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────┐  ┌─────────────────────────┐  │
│  │ Content Area        │  │ KPI Sidebar (sticky)    │  │
│  │                     │  │                         │  │
│  │ Dashboard:          │  │ Total Revenue           │  │
│  │ - Period selector   │  │ Rp 125.000.000          │  │
│  │ - Outlet comparison │  │                         │  │
│  │ - Top products      │  │ Total Orders            │  │
│  │                     │  │ 1.250                   │  │
│  │ Audit Trail:        │  │                         │  │
│  │ - Filter pills      │  │ Active Outlets          │  │
│  │ - Movement list     │  │ 5 outlet                │  │
│  │                     │  │                         │  │
│  │ Laporan:            │  └─────────────────────────┘  │
│  │ - Date filter       │                               │
│  │ - Export cards      │                               │
│  │ - Breakdown cards   │                               │
│  │                     │                               │
│  │ Masalah:            │                               │
│  │ - Filter pills      │                               │
│  │ - Report list       │                               │
│  │                     │                               │
│  └─────────────────────┘                               │
└─────────────────────────────────────────────────────────┘
```

**URL Structure:**
- `/owner/analytics` → default tab "Dashboard"
- `/owner/analytics?tab=audit` → tab "Audit Trail"
- `/owner/analytics?tab=laporan` → tab "Laporan"
- `/owner/analytics?tab=masalah` → tab "Masalah"

**Business Logic:**
- Tab "Dashboard": Owner bisa lihat performa bisnis
- Tab "Audit Trail": Owner bisa lihat perubahan stok
- Tab "Laporan": Owner bisa export data
- Tab "Masalah": Owner bisa kelola laporan masalah

---

## Sidebar Final

```
┌─────────────┐
│ Dombi       │
│ Owner       │
├─────────────┤
│ ▢ Dasbor   │
├─────────────┤
│ ▢ Pesanan  │
│ ▢ Pengiriman│
│ ▢ Pengembalian│
│ ▢ Penukaran│
├─────────────┤
│ ▢ Keuangan │
├─────────────┤
│ ▢ Outlet   │
│ ▢ Produk   │
│ ▢ Harga    │
├─────────────┤
│ ▢ Inventaris│
│ ▢ Restock  │
│ ▢ Distribusi│
├─────────────┤
│ ▢ Analitik │
└─────────────┘
```

**13 items, 6 grup, clean.**

---

## Files Changes

### New Files
- `resources/js/pages/owner/finance/index.tsx` (merged)
- `resources/js/pages/owner/pricing/index.tsx` (merged)
- `resources/js/pages/owner/analytics/index.tsx` (merged)

### Delete Files
- `resources/js/pages/owner/finance/settlement-payments.tsx`
- `resources/js/pages/owner/finance/payment-accounts.tsx`
- `resources/js/pages/owner/pricing/master.tsx`
- `resources/js/pages/owner/pricing/outlet.tsx`
- `resources/js/pages/owner/pricing/history.tsx`
- `resources/js/pages/owner/stock-movements/index.tsx`
- `resources/js/pages/owner/reports/index.tsx`
- `resources/js/pages/owner/order-reports/index.tsx`
- `resources/js/pages/owner/order-reports/show.tsx`

### Update Files
- `resources/js/layouts/owner-layout.tsx` (sidebar)
- `routes/web.php` (routes)

---

## Routes

### Keep
- `/owner/finance` (default tab)
- `/owner/pricing` (default tab)
- `/owner/analytics` (default tab)

### Delete
- `/owner/finance/settlement-payments`
- `/owner/finance/payment-accounts`
- `/owner/pricing/master`
- `/owner/pricing/outlet`
- `/owner/pricing/history`
- `/owner/stock-movements`
- `/owner/reports`
- `/owner/order-reports`

---

## Done Criteria

1. Sidebar shows 13 items in 6 groups
2. Each merged page has tab navigation
3. Tab state persists via URL params
4. KPI sidebar shows on relevant tabs
5. All existing functionality preserved
6. Build passes (TypeScript no error)
7. Responsive on mobile + desktop
