# Outlet Orders: Operational vs History Tab Split

## Problem

Outlet staff see all orders in one flat list with 7 filter chips. It's hard to distinguish between orders that need action (operational) and orders that are already done (history). This causes confusion and slower response times.

## Solution

Split the orders page into 2 tabs: **Aktif** (operational) and **Riwayat** (history). Default to Aktif so outlet always sees what needs attention first.

## Current State

- Single page with 7 filter chips: Semua, Menunggu, Diterima, Disiapkan, Siap Ambil, Selesai, Dibatalkan
- All orders in one flat list, sorted newest first
- Urgency banner for pending orders
- Badge on bottom nav tab for pending count

## Design

### Tab Structure

**Tab Aktif** (`?tab=aktif`, default):
- Statuses: `pending_confirmation`, `confirmed`, `preparing`, `ready_for_pickup`, `picked_up`, `delivering`
- Filter chips: Menunggu, Diterima, Disiapkan, Siap Ambil, Dikirim
- Sort: oldest first (yang lama diprioritaskan)
- Badge: count of pending orders shown in tab label

**Tab Riwayat** (`?tab=riwayat`):
- Statuses: `completed`, `cancelled_by_customer`, `cancelled_by_outlet`, `rejected_by_outlet`, `failed_delivery`, `expired`
- Filter chips: Selesai, Dibatalkan, Ditolak, Gagal, Kadaluarsa
- Sort: newest first

### URL State

```
/outlet/orders                                    → tab=aktif (default)
/outlet/orders?tab=aktif                          → tab=aktif
/outlet/orders?tab=aktif&status=pending_confirmation → tab=aktif, filter Menunggu
/outlet/orders?tab=riwayat                        → tab=riwayat
/outlet/orders?tab=riwayat&status=completed       → tab=riwayat, filter Selesai
```

### UI

```
┌─────────────────────────────────────┐
│  [Aktif (3)]  [Riwayat]             │  ← Segmented control
│ ──────────────────────────────────── │
│  ●Menunggu  ●Diterima  ●Disiapkan  │  ← Filter chips (per tab)
│  ●Siap Ambil  ●Dikirim             │
│ ──────────────────────────────────── │
│  #ORD-001  Pickup  ●Menunggu        │
│  Customer · 3 item · 5m   Rp 45.000 │
│  #ORD-002  Delivery ●Disiapkan      │
│  Customer · 1 item · 12m  Rp 32.000 │
└─────────────────────────────────────┘
```

### Backend

**Controller:** `Outlet\OrderController@index`

- Accept `tab` query param (default: `aktif`)
- Tab `aktif`: `whereIn('status', $operationalStatuses)`, sort `oldest`
- Tab `riwayat`: `whereIn('status', $historyStatuses)`, sort `newest`
- `status` filter chip works within each tab
- Pass `tab`, `pendingCount` to Inertia props

### Files to Modify

| File | Change |
|------|--------|
| `app/Http/Controllers/Outlet/OrderController.php` | Add tab logic to `index()` |
| `resources/js/pages/outlet/orders/index.tsx` | Add segmented control, tab-aware filters |

### What Stays the Same

- Card design (compact 2-row)
- Bottom nav badge
- Sound alert
- Push notification
- Urgency banner (only on Aktif tab)
- Order detail page (`/outlet/orders/{id}`)

### Success Criteria

1. Default view shows only operational orders (Aktif tab)
2. Tab switch updates URL and filters
3. Filter chips change based on active tab
4. Sorting: Aktif = oldest first, Riwayat = newest first
5. Badge shows pending count on Aktif tab label
6. Existing order flow unchanged
