# Outlet Hamburger Navigation — Design Spec

**Date:** 2026-07-01
**Status:** Approved
**Scope:** Replace outlet bottom navigation with hamburger menu + side sheet

---

## Problem

Audit using "Design of Everyday Things" framework scored outlet navigation **6.5/10**. Key issues:

- Only 4 items in bottom nav, but 9+ features hidden in `/outlet/more`
- Gulf of Execution: users can't find Pengiriman, Restock, Return from nav
- Redundancy: Scan QR exists in nav AND as big button on dashboard
- Quick Actions on dashboard duplicate nav items without clarity

## Solution

Replace bottom navigation with a hamburger menu that opens a grouped side sheet, similar to owner sidebar pattern.

---

## Navigation Structure

All outlet routes grouped into 5 sections:

### Utama
| Item | Route | Badge Key |
|------|-------|-----------|
| Dashboard | `/outlet/dashboard` | — |
| Pesanan | `/outlet/orders` | `orders` (pendingCount) |
| Scan QR | `/outlet/scan` | — |

### Operasional
| Item | Route | Badge Key |
|------|-------|-----------|
| Inventaris | `/outlet/inventory` | — |
| Pengiriman | `/outlet/deliveries` | `deliveries` |
| Restock | `/outlet/restocks` | `restocks` |
| Penjualan Offline | `/outlet/offline-sales` | — |

### Pelaporan
| Item | Route | Badge Key |
|------|-------|-----------|
| Analitik | `/outlet/analytics` | — |
| Laporan Penjualan | `/outlet/reports` | — |
| Laporan Masalah | `/outlet/order-reports` | `reports` |

### Pengembalian
| Item | Route | Badge Key |
|------|-------|-----------|
| Return Produk | `/outlet/returns` | `returns` |
| Tukar Produk | `/outlet/exchanges` | `exchanges` |

### Keuangan
| Item | Route | Badge Key |
|------|-------|-----------|
| Riwayat Pembayaran | `/outlet/settlement-payments` | `payments` |

---

## Side Sheet Component

### New Component: `OutletNavigationSheet`

**Behavior:**
- Width: 80% screen, max 320px
- Slides from left, 200ms ease animation
- Dark overlay (opacity 50%) — tap overlay to close
- Swipe left to close (gesture)
- Page behind is scroll-locked
- Active page highlighted with emerald bg + text

**Structure:**
```
┌── Overlay (z-50) ───────────────────────────┐
│                                              │
│  ┌── Sheet (from left) ─────────────────┐   │
│  │  Dombi Logo                          │   │
│  │  Outlet: [Nama Outlet]               │   │
│  │  Selamat pagi, [User]                │   │
│  │  [✕]                                 │   │
│  │  ─────────────────────────────────── │   │
│  │                                      │   │
│  │  ▸ Utama                             │   │
│  │    🏠  Dashboard                     │   │
│  │    📦  Pesanan                   [3] │   │
│  │    📱  Scan QR                       │   │
│  │                                      │   │
│  │  ▸ Operasional                       │   │
│  │    📦  Inventaris                    │   │
│  │    🚚  Pengiriman                [2] │   │
│  │    🔄  Restock                   [1] │   │
│  │    🛒  Penjualan Offline             │   │
│  │                                      │   │
│  │  ▸ Pelaporan                         │   │
│  │    📊  Analitik                      │   │
│  │    📄  Laporan Penjualan             │   │
│  │    ⚠️  Laporan Masalah           [1] │   │
│  │                                      │   │
│  │  ▸ Pengembalian                      │   │
│  │    ↩️  Return Produk              [2] │   │
│  │    🔁  Tukar Produk              [1] │   │
│  │                                      │   │
│  │  ▸ Keuangan                          │   │
│  │    💰  Riwayat Pembayaran            │   │
│  │                                      │   │
│  │  ─────────────────────────────────── │   │
│  │  🚪  Logout                          │   │
│  └──────────────────────────────────────┘   │
│                                              │
└──────────────────────────────────────────────┘
```

**Implementation:** Create new `SideSheet` component (not extend BottomSheet — different semantics: no snap points, no drag handle, left-side origin). Uses `createPortal` for rendering.

---

## Header Changes

### Before
```
┌─────────────────────────────────────────┐
│  [←]    Title              [🔔] [👤]   │
│         Subtitle                        │
└─────────────────────────────────────────┘
```

### After
```
┌─────────────────────────────────────────┐
│  [☰]    Title              [🔔]        │
│         Subtitle                        │
└─────────────────────────────────────────┘
```

**Changes:**
- Hamburger icon (`Menu` from lucide-react) replaces back button on main pages (no `backHref`)
- Pages with `backHref` show both: back button left + hamburger right of back button
- User button removed (user info now in side sheet header)
- NotificationBell stays

---

## Data Flow

### Badge Counts

**Problem:** Badge counts only available on dashboard/more pages. Side sheet needs them everywhere.

**Solution:** New hook `useOutletBadges` with polling.

```
useOutletBadges() → fetch /outlet/badge-counts every 30s
                  → returns { badgeCounts, isLoading }
```

**New endpoint:** `GET /outlet/badge-counts`
- Returns: `{ returns, exchanges, restocks, deliveries, payments, reports }`
- Reuses queries from `DashboardController::more()`
- Polling interval: 30 seconds

### Component Hierarchy

```
OutletLayout
├─ useOrderAlert()        → pendingCount (orders badge)
├─ useOutletBadges()      → badgeCounts (other badges)
├─ PageHeader
│  ├─ onMenuClick         → opens side sheet
│  └─ NotificationBell    → unchanged
└─ OutletNavigationSheet
   ├─ pendingCount         → orders badge
   └─ badgeCounts          → other badges
```

---

## Files Changed

| File | Action |
|------|--------|
| `resources/js/components/outlet-bottom-nav.tsx` | Delete |
| `resources/js/components/outlet-navigation-sheet.tsx` | Create |
| `resources/js/components/ui/side-sheet.tsx` | Create (or extend BottomSheet) |
| `resources/js/hooks/use-outlet-badges.ts` | Create |
| `resources/js/layouts/outlet-layout.tsx` | Update: remove bottom nav, add side sheet |
| `resources/js/components/ui/page-header.tsx` | Update: add hamburger icon support |
| `resources/js/components/ui/mobile-role-layout.tsx` | Update: remove bottom nav padding |
| `resources/js/pages/outlet/more.tsx` | Remove (replaced by side sheet) |
| `routes/web.php` | Add `/outlet/badge-counts` route |
| `app/Http/Controllers/Outlet/DashboardController.php` | Add `badgeCounts()` method |

---

## Verification

1. Open responsive mode iPhone 14 Pro Max
2. Hamburger icon visible in header on all outlet pages
3. Tap hamburger → side sheet slides from left with animation
4. All 5 groups visible with correct items and badges
5. Active page highlighted in emerald
6. Tap item → navigate + close sheet
7. Tap overlay → close sheet
8. Badge counts update via polling
9. No bottom nav visible anywhere
10. Content area uses full height (no bottom padding waste)
