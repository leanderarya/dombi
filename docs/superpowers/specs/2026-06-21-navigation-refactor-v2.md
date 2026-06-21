# Navigation Refactor V2 — iOS HIG + Refactoring UI

**Date:** 2026-06-21
**Status:** Audit Complete — Pending Implementation
**Skills:** ios-hig-design, refactoring-ui

---

## 1. Navigation Audit — Owner

### Bottom Tabs (Primary — 80% Daily)

| Tab | Routes Covered | Status |
|-----|---------------|--------|
| Dashboard | `/owner/dashboard` | ✅ OK |
| Outlet | `/owner/outlets`, `/owner/orders`, `/owner/deliveries`, `/owner/returns`, `/owner/exchanges` | ✅ OK |
| Produk | `/owner/products`, `/owner/product-families`, `/owner/pricing/*`, `/owner/inventories`, `/owner/restocks`, `/owner/distributions` | ✅ OK |
| Keuangan | `/owner/finance`, `/owner/settlement-payments`, `/owner/payment-accounts`, `/owner/reports`, `/owner/analytics`, `/owner/stock-movements` | ✅ OK |

### Owner Command Sheet (Secondary — 20%)

Accessed from: **Profile/Avatar button** (top-right of header)

```
┌─────────────────────────────┐
│  Akun                       │
│  ─────────────────────────  │
│  Laporan                    │
│  Harga Produk               │
│  Riwayat Harga              │
│  Riwayat Pembayaran         │
│  Audit Aktivitas            │
│  Pengaturan                 │
│  ─────────────────────────  │
│  Keluar                     │
└─────────────────────────────┘
```

| Sheet Item | Route | Current Status |
|------------|-------|----------------|
| Akun | `/owner/profile` | **ORPHAN** — no entry point |
| Laporan | `/owner/reports` | Accessible via Keuangan tab |
| Harga Produk | `/owner/pricing/master` | Accessible via Produk tab |
| Riwayat Harga | `/owner/pricing/history` | Accessible via Produk tab |
| Riwayat Pembayaran | `/owner/settlement-payments` | Accessible via Keuangan tab |
| Audit Aktivitas | `/owner/stock-movements` | Accessible via Keuangan tab |
| Pengaturan | (future) | Does not exist yet |
| Keluar | POST `/logout` | — |

### Orphan Routes

| Route | Issue | Fix |
|-------|-------|-----|
| `/owner/profile` | No navigation entry | Add to Owner Command Sheet |
| `/owner/deliveries/board` | No navigation entry | Add link from deliveries index page |

---

## 2. Navigation Audit — Outlet

### Bottom Tabs (Primary — 80% Daily)

| Tab | Routes Covered | Status |
|-----|---------------|--------|
| Dashboard | `/outlet/dashboard` | ✅ OK |
| Pesanan | `/outlet/orders` | ✅ OK |
| Scan | `/outlet/scan` | ✅ OK |
| Inventaris | `/outlet/inventory` | ✅ OK |

### Outlet More Sheet (Secondary — 20%)

Accessed from: **Profile/Avatar button** (top-right of header)

```
┌─────────────────────────────┐
│  Restock                    │
│  Settlement                 │
│  Pengiriman                 │
│  Pengembalian               │
│  Penukaran                  │
│  Laporan                    │
│  Analitik                   │
│  ─────────────────────────  │
│  Pengaturan Outlet          │
│  ─────────────────────────  │
│  Keluar                     │
└─────────────────────────────┘
```

| Sheet Item | Route | Current Status |
|------------|-------|----------------|
| Restock | `/outlet/restocks` | **ORPHAN** — only `/restocks/create` accessible |
| Settlement | `/outlet/settlement` | **ORPHAN** — no entry point at all |
| Pengiriman | `/outlet/deliveries` | Accessible via dashboard |
| Pengembalian | `/outlet/returns` | **ORPHAN** — no entry point |
| Penukaran | `/outlet/exchanges` | **ORPHAN** — no entry point |
| Laporan | `/outlet/reports` | **ORPHAN** — no entry point |
| Analitik | `/outlet/analytics` | **ORPHAN** — no entry point |
| Pengaturan Outlet | (future) | Does not exist yet |
| Keluar | POST `/logout` | — |

### Orphan Routes (Critical)

| Route | Issue | Severity |
|-------|-------|----------|
| `/outlet/more` | Hub page exists but **zero inbound links** | HIGH |
| `/outlet/settlement` | No entry point at all | HIGH |
| `/outlet/settlement-payments` | Only reachable from orphan `/outlet/more` | HIGH |
| `/outlet/returns` | Only reachable from orphan `/outlet/more` | HIGH |
| `/outlet/exchanges` | Only reachable from orphan `/outlet/more` | HIGH |
| `/outlet/restocks` | Only reachable from orphan `/outlet/more` | MEDIUM |
| `/outlet/analytics` | Only reachable from orphan `/outlet/more` | MEDIUM |
| `/outlet/reports` | Only reachable from orphan `/outlet/more` | MEDIUM |

---

## 3. Navigation Audit — Courier

### Bottom Tabs (Primary)

| Tab | Routes Covered | Status |
|-----|---------------|--------|
| Tugas | `/courier/dashboard` | ✅ OK |
| Riwayat | `/courier/deliveries` | ✅ OK |
| Profil | `/courier/profile` | **BROKEN** — no route, no page! |

### Orphan Routes

| Route | Issue | Severity |
|-------|-------|----------|
| `/courier/profile` | Bottom tab links to non-existent route/page | **CRITICAL** |
| `POST .../reject` | Route exists, no UI button | MEDIUM |
| `POST .../return-to-outlet` | Route exists, no UI button | MEDIUM |
| `GET .../availability/status` | API exists, never called | LOW |

---

## 4. Discoverability Issues

### Bad Patterns Found

| Pattern | Example | Impact |
|---------|---------|--------|
| Route exists, no navigation entry | `/outlet/settlement` | Users can't find feature |
| Feature only reachable by URL | `/owner/profile` | Power users only |
| Hub page itself is orphan | `/outlet/more` | 7 features hidden |
| Bottom tab links to 404 | `/courier/profile` | Broken UX |
| Action route, no UI button | courier `reject` | Feature unusable |

### Good Patterns Found

| Pattern | Example | Status |
|---------|---------|--------|
| Contextual links from dashboard | outlet dashboard → deliveries | ✅ |
| Drill-down from list to detail | orders list → order detail | ✅ |
| Quick actions on dashboard | outlet scan CTA | ✅ |
| Alert rows for urgent items | pending orders, failed deliveries | ✅ |

---

## 5. Owner Navigation Map

```
Bottom Tabs (4)
├── Dashboard ──────── /owner/dashboard
├── Outlet ─────────── /owner/outlets
│   ├── Orders ─────── /owner/orders
│   ├── Deliveries ─── /owner/deliveries
│   ├── Returns ────── /owner/returns
│   └── Exchanges ──── /owner/exchanges
├── Produk ─────────── /owner/products
│   ├── Pricing ────── /owner/pricing/*
│   ├── Inventories ── /owner/inventories
│   ├── Restocks ───── /owner/restocks
│   └── Distributions ─ /owner/distributions
└── Keuangan ───────── /owner/finance
    ├── Settlements ── /owner/settlement-payments
    ├── Payment Accts ─ /owner/payment-accounts
    ├── Reports ─────── /owner/reports
    ├── Analytics ───── /owner/analytics
    └── Stock Movements ─ /owner/stock-movements

Owner Command Sheet (from avatar)
├── Akun ───────────── /owner/profile
├── Laporan ────────── /owner/reports
├── Harga Produk ───── /owner/pricing/master
├── Riwayat Harga ──── /owner/pricing/history
├── Riwayat Pembayaran ─ /owner/settlement-payments
├── Audit Aktivitas ── /owner/stock-movements
├── Pengaturan ─────── (future)
└── Keluar ─────────── POST /logout
```

---

## 6. Outlet Navigation Map

```
Bottom Tabs (4)
├── Dashboard ──────── /outlet/dashboard
├── Pesanan ────────── /outlet/orders
├── Scan ───────────── /outlet/scan
└── Inventaris ─────── /outlet/inventory

Outlet More Sheet (from avatar)
├── Restock ────────── /outlet/restocks
├── Settlement ─────── /outlet/settlement
├── Pengiriman ─────── /outlet/deliveries
├── Pengembalian ───── /outlet/returns
├── Penukaran ──────── /outlet/exchanges
├── Laporan ────────── /outlet/reports
├── Analitik ───────── /outlet/analytics
├── Pengaturan ─────── (future)
└── Keluar ─────────── POST /logout
```

---

## 7. Courier Navigation Map

```
Bottom Tabs (3)
├── Tugas ──────────── /courier/dashboard
├── Riwayat ────────── /courier/deliveries
└── Profil ─────────── /courier/profile ← NEEDS PAGE

Delivery Detail (contextual)
├── Confirm Pickup ─── POST .../confirm-pickup
├── Start Delivery ─── POST .../start-delivery
├── Complete ────────── POST .../complete
├── Fail ────────────── POST .../fail
├── Reject ──────────── POST .../reject ← NEEDS UI BUTTON
└── Return to Outlet ── POST .../return-to-outlet ← NEEDS UI BUTTON
```

---

## 8. HIG Compliance Review

| Principle | Status | Notes |
|-----------|--------|-------|
| Bottom tabs = primary workflow | ✅ | All 3 roles have proper tab bars |
| Sheets = secondary workflow | ❌ | No sheets implemented yet |
| Navigation stack = detail screens | ✅ | Drill-down works correctly |
| No hamburger menu | ✅ | Removed in Phase 3 |
| No sidebar on mobile | ✅ | Hidden in Phase 3 |
| No nested tabs | ✅ | Clean |
| All routes discoverable | ❌ | 8+ orphan routes found |
| Max 2 taps from home | ❌ | Some features require 3+ taps |

---

## 9. Refactoring UI Review

| Principle | Status | Notes |
|-----------|--------|-------|
| 80% daily in primary tabs | ✅ | Tabs cover main workflows |
| 20% secondary in sheets | ❌ | Sheets not implemented yet |
| Progressive disclosure | ❌ | All features shown equally |
| Navigation weight | ✅ | Primary feels light, secondary should feel heavier |
| Predictable location | ❌ | Orphan routes break mental model |

---

## 10. Navigation Refactor Plan

### Task 1: Fix Courier Profile (CRITICAL)

**Problem:** Bottom tab links to `/courier/profile` which doesn't exist.

**Fix:** Create `resources/js/pages/courier/profile.tsx` with:
- User info (name, role)
- Logout button
- App version

**Files:**
- Create: `resources/js/pages/courier/profile.tsx`
- Create: `app/Http/Controllers/Courier/ProfileController.php`
- Modify: `routes/web.php` (add route)

### Task 2: Create Owner Command Sheet

**Problem:** Owner has no secondary navigation sheet. Profile page is orphan.

**Fix:** Create an iOS-style action sheet that opens from the avatar button in the owner header.

**Files:**
- Create: `resources/js/components/owner/owner-command-sheet.tsx`
- Modify: `resources/js/layouts/owner-layout.tsx` (add avatar button + sheet)
- Modify: `resources/js/components/owner-mobile-nav.tsx` (add avatar to header)

**Sheet items:**
```tsx
const sheetItems = [
    { href: '/owner/profile', label: 'Akun', icon: User },
    { divider: true },
    { href: '/owner/reports', label: 'Laporan', icon: FileText },
    { href: '/owner/pricing/master', label: 'Harga Produk', icon: DollarSign },
    { href: '/owner/pricing/history', label: 'Riwayat Harga', icon: Clock },
    { href: '/owner/settlement-payments', label: 'Riwayat Pembayaran', icon: CreditCard },
    { href: '/owner/stock-movements', label: 'Audit Aktivitas', icon: Shield },
    { divider: true },
    { href: '/owner/profile', label: 'Pengaturan', icon: Settings },
    { divider: true },
    { action: 'logout', label: 'Keluar', icon: LogOut, variant: 'danger' },
];
```

### Task 3: Create Outlet More Sheet

**Problem:** 8 orphan routes with no navigation entry. `/outlet/more` page exists but is itself orphan.

**Fix:** Create an iOS-style action sheet that opens from the avatar button in the outlet header.

**Files:**
- Create: `resources/js/components/outlet/outlet-more-sheet.tsx`
- Modify: `resources/js/layouts/outlet-layout.tsx` (add avatar button + sheet)
- Modify: `resources/js/pages/outlet/dashboard.tsx` (add link to sheet)

**Sheet items:**
```tsx
const sheetItems = [
    { href: '/outlet/restocks', label: 'Restock', icon: Package },
    { href: '/outlet/settlement', label: 'Settlement', icon: DollarSign },
    { href: '/outlet/deliveries', label: 'Pengiriman', icon: Truck },
    { divider: true },
    { href: '/outlet/returns', label: 'Pengembalian', icon: RotateCcw },
    { href: '/outlet/exchanges', label: 'Penukaran', icon: RefreshCw },
    { divider: true },
    { href: '/outlet/reports', label: 'Laporan', icon: FileText },
    { href: '/outlet/analytics', label: 'Analitik', icon: BarChart3 },
    { divider: true },
    { action: 'logout', label: 'Keluar', icon: LogOut, variant: 'danger' },
];
```

### Task 4: Add Avatar Button to Layout Headers

**Problem:** No profile/avatar button in headers for opening sheets.

**Fix:** Add avatar button to top-right of each role's header.

**Files:**
- Modify: `resources/js/layouts/owner-layout.tsx`
- Modify: `resources/js/layouts/outlet-layout.tsx`
- Modify: `resources/js/layouts/courier-layout.tsx`

**Pattern:**
```tsx
<button onClick={() => setSheetOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
    <User className="h-5 w-5" />
</button>
```

### Task 5: Fix Courier Orphan Actions

**Problem:** `reject` and `return-to-outlet` routes exist but have no UI buttons.

**Fix:** Add contextual buttons to courier delivery detail page.

**Files:**
- Modify: `resources/js/pages/courier/deliveries/show.tsx`

**Add:**
- "Tolak" button (reject) — shown when delivery is in `waiting_pickup` status
- "Kembali ke Outlet" button (return-to-outlet) — shown when delivery is in `picked_up` status

### Task 6: Add Delivery Board Link

**Problem:** `/owner/deliveries/board` has no navigation entry.

**Fix:** Add "Board View" link from deliveries index page.

**Files:**
- Modify: `resources/js/pages/owner/deliveries/index.tsx`

---

## Implementation Priority

| Priority | Task | Impact | Effort |
|----------|------|--------|--------|
| P0 | Task 1: Fix Courier Profile (broken link) | Critical — 404 on tap | Low |
| P0 | Task 3: Outlet More Sheet | 8 orphan routes | Medium |
| P1 | Task 2: Owner Command Sheet | Profile orphan + secondary nav | Medium |
| P1 | Task 4: Avatar buttons in headers | Entry point for sheets | Low |
| P2 | Task 5: Courier orphan actions | 2 unusable features | Low |
| P2 | Task 6: Delivery board link | 1 orphan route | Low |
