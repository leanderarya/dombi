# Dombi UX Refactor — Apple HIG Audit

**Date:** 2026-06-21
**Status:** Audit Complete — Pending Implementation
**Scope:** All screens across Customer, Outlet, Courier, Owner roles

---

## Executive Summary

Dombi's UI is functional but feels like a **web admin dashboard wrapped in a mobile shell**. The core issues are:

1. **Card overuse** — Every content block is a `rounded-2xl border` card. iOS uses grouped lists, not stacked cards.
2. **Touch targets under 44pt** — Buttons at 32-40px appear on nearly every screen.
3. **Web typography** — `text-[10px] uppercase tracking-wider` labels everywhere. iOS uses system 13pt.
4. **HTML tables on mobile** — 5-7 column tables on 375px screens (Owner).
5. **Sidebar navigation** — Owner layout uses web-style sidebar with hamburger menu.

**Current Score: 4/10** (functional but not native-feeling)

---

## Global Component Issues

These components affect ALL screens and should be refactored first.

### 1. `SectionCard` — Root Cause of Card-Heavy Feel

**File:** `resources/js/components/ui/section-card.tsx`

| Line | Issue | Fix |
|------|-------|-----|
| 24 | `rounded-2xl border border-border bg-surface p-5` — Every content block gets a bordered container | Replace with iOS Inset Grouped style: `rounded-xl bg-white` with subtle separators |
| 20 | `text-xs font-semibold uppercase tracking-wider` — Web dashboard section header | Use system 13pt regular weight, sentence case, gray color |

### 2. `PageHeader` — Too Small, Wrong Touch Target

**File:** `resources/js/components/ui/page-header.tsx`

| Line | Issue | Fix |
|------|-------|-----|
| 22 | Back button `h-10 w-10` (40pt) — under 44pt minimum | Change to `h-11 w-11` (44pt) |
| 31 | Title `text-sm` (14px) — iOS nav bar is 17pt | Change to `text-lg` (18px) or `text-[17px]` |

### 3. `BottomSheet` — Missing Swipe-to-Dismiss

**File:** `resources/js/components/ui/bottom-sheet.tsx`

| Line | Issue | Fix |
|------|-------|-----|
| 52 | Close button `h-8 w-8` (32pt) — under 44pt | Change to `h-11 w-11` |
| — | No swipe-to-dismiss gesture | Add touch event handler for swipe-down |
| — | No spring animation | Add CSS transition with spring easing |

### 4. `FilterChips` — Touch Targets Too Small

**File:** `resources/js/components/ui/filter-chips.tsx`

| Line | Issue | Fix |
|------|-------|-----|
| 21 | `px-4 py-2 text-xs` — ~32pt height | Change to `px-4 py-2.5 text-sm` (~40pt) |

### 5. `DataTable` — Web Admin Pattern

**File:** `resources/js/components/ui/data-table.tsx`

| Line | Issue | Fix |
|------|-------|-----|
| 67-123 | HTML `<table>` with multi-column layout | Replace with card-based list rows |
| 110 | Action buttons `min-h-[32px]` (32pt) | Change to `min-h-[44px]` |

---

## Customer App Audit

### Score: 5/10

### Home (`customer/home.tsx`)

| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Hero CTA button ~34px height | High | 173 | `min-h-[44px]` |
| Dot indicators 8px tap area | High | 187 | Add 44pt hit area padding |
| Google login button 40px | High | 255 | `min-h-[44px]` |
| Auto-rotating carousel, no reduced-motion check | Medium | 44-50 | Add `prefers-reduced-motion` media query |
| 3-second forced delay on pickup action | High | 107-108 | Remove `setTimeout`, navigate immediately |
| Trust section `text-zinc-400` — fails WCAG AA | High | 362 | Change to `text-zinc-500` |
| Section headers `text-xs uppercase` | Medium | 198, 271 | Use `text-sm font-semibold` sentence case |

### Products (`customer/products.tsx`)

| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Search input ~34px height | High | 201 | `min-h-[44px]` |
| Every variant item is a card with border + shadow | High | variant-list-item.tsx:92 | Use flat list rows with separators |
| Favorite button 28px | High | variant-list-item.tsx:105 | `h-11 w-11` |
| Quick-add button 36px | High | variant-list-item.tsx:149 | `h-11 w-11` |

### Product Detail (`customer/product-detail.tsx`)

| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Back button 40px | High | 183 | `h-11 w-11` |
| Cart icon button 40px | High | 193 | `h-11 w-11` |
| Flavor/size selector buttons ~42px | Medium | 262, 299 | `min-h-[44px]` |
| "Tambah ke Keranjang" CTA ~42px | Medium | 411 | `min-h-[44px]` |

### Checkout Flow (`customer/checkout/`)

| Issue | Severity | File:Line | Fix |
|-------|----------|-----------|-----|
| Back button 40px on all 3 steps | High | index.tsx:235, customer.tsx:321, payment.tsx:243 | `h-11 w-11` |
| `‹` character instead of chevron icon | Medium | index.tsx:236, customer.tsx:322, payment.tsx:244 | Use consistent SVG chevron |
| StepHeader/StepButton duplicated 3 times | Medium | All checkout files | Extract to shared component |
| 2x2 grid for address fields — cramped on small screens | Medium | customer.tsx:270 | Stack vertically |
| `border-2` on total payment card | Medium | payment.tsx:206 | Use `border` or subtle background |
| Heavy shadow on sticky footer | Medium | index.tsx:250 | Use thin separator, not drop shadow |
| Error dismiss button 16px | High | payment.tsx:76 | `h-11 w-11` |

### Order History (`customer/orders/index.tsx`)

| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Back button 40px | High | 71 | `h-11 w-11` |
| "Ganti" button ~16px tap area | High | 103 | `min-h-[44px]` |
| Section labels `text-[11px] uppercase` | Medium | 113, 124 | `text-sm` sentence case |

### Order Detail (`customer/orders/show.tsx`)

| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Back button 40px | High | 73 | `h-11 w-11` |
| "Navigasi ke Outlet" ~38px | High | 143 | `min-h-[44px]` |
| "Hubungi Outlet" ~34px | High | 173 | `min-h-[44px]` |
| Copy button 36px | High | 194 | `h-11 w-11` |
| "Bagikan Link" button 40px | High | 208 | `h-11` |
| "Buka di Maps" 36px | High | 305 | `min-h-[44px]` |
| Multiple cards with border + shadow | Medium | Throughout | Use grouped sections |

### Profile (`customer/profile.tsx`)

| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| "Kelola Alamat" button 36px | High | 49 | `min-h-[44px]` |
| "Utama" badge text 9px | High | 44 | `text-[11px]` minimum |

---

## Outlet App Audit

### Score: 5/10

### Dashboard (`outlet/dashboard.tsx`)

| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Hero gradient feels like web marketing banner | Medium | 21-37 | Simplify to clean card |
| `active:scale-[0.99]` on QR scan card | Medium | 42 | Use opacity feedback |
| 4-column stats grid — cramped | Medium | 80 | Use 2-column or horizontal scroll |
| "Lihat Semua" text links under 44pt | High | 97, 119 | `min-h-[44px]` with padding |

### Orders List (`outlet/orders/index.tsx`)

| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| `text-[10px]` status badges | Medium | 76, 84 | `text-[11px]` minimum |
| `active:scale-[0.99]` on cards | Medium | 68 | Use opacity feedback |

### Order Detail (`outlet/orders/show.tsx`)

| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Select dropdown ~34px | High | 112 | `min-h-[44px]` |
| "Assign Kurir" button ~34px | High | 116 | `min-h-[44px]` |
| "Serahkan ke Customer" ~34px | High | 126 | `min-h-[44px]` |
| Customer name grayed out (secondary) | Medium | 74 | Make more prominent |
| Raw status strings with underscores | High | 180 | Translate to human-readable |
| Inline courier assignment form | Medium | 109-117 | Move to modal/sheet |
| 5 stacked SectionCards | High | Throughout | Use grouped sections |

### Inventory (`outlet/inventory.tsx`)

| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Stock opname button 32px | High | 233 | `h-11 w-11` |
| Healthy stock toggle ~38px | High | 119 | `min-h-[44px]` |
| Summary bar double borders | Medium | 63 | Remove inner borders |
| Uppercase tracking-wider section headers | Medium | 84, 102 | Sentence case |

### Scan Page (`outlet/scan.tsx`)

| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| "Berhenti Scan" button ~38px | High | 196 | `min-h-[44px]` |
| Manual input ~38px | High | 233 | `min-h-[44px]` |
| "ATAU" divider is web pattern | Medium | 214-218 | Use segmented control |
| Persistent instructions box | Medium | 247-263 | Move to onboarding |

### Restocks (`outlet/restocks/`)

| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Delete button 32px | High | create.tsx:55 | `h-11 w-11` |
| Select/number inputs ~34px | High | create.tsx:67, 104 | `min-h-[44px]` |
| Date text `text-slate-400` fails WCAG AA | Medium | index.tsx:61 | Change to `text-slate-500` |
| `space-y-2` inconsistent with orders `space-y-3` | Low | index.tsx:50 | Standardize to `space-y-3` |

---

## Courier App Audit

### Score: 4/10

### Dashboard (`courier/dashboard.tsx`)

| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Availability toggle ~28px | High | 109 | `min-h-[44px]` |
| Shift buttons ~28px | High | 121, 129 | `min-h-[44px]` |
| 4-column stats — cramped | High | 139 | Use 2-column |
| "Lihat Semua" link under 44pt | High | 244 | `min-h-[44px]` |
| `text-[10px]` age badges | Medium | 193 | `text-[11px]` |
| No visual affordance on task links | Medium | 152-169 | Add chevrons |
| Negative margins `-mx-4 -mb-4` | Low | 155, 184 | Use proper layout |

### Delivery Detail (`courier/deliveries/show.tsx`)

| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| 6 stacked SectionCards | High | Throughout | Use grouped sections |
| Customer name 14px — too small for detail page | High | 178 | Use 17-20px |
| `h-24` spacer for sticky bar | Low | 372 | Use dynamic calculation |

---

## Owner App Audit

### Score: 3/10 (Most Web-Like)

### Layout (`owner-layout.tsx`)

| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| Sidebar navigation on mobile | Critical | 103 | Remove sidebar, use tab bar only |
| Hamburger menu for mobile | High | 137 | Remove, use bottom tabs |
| Two navigation systems coexist | High | 120, 149 | Remove sidebar nav |
| Logout button 32px | High | 127 | `min-h-[44px]` |

### Outlets Index (`owner/outlets/index.tsx`)

| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| HTML table with 5 columns | Critical | 35-87 | Replace with card list |
| DataTable action buttons 32px | High | DataTable:110 | `min-h-[44px]` |
| `text-[10px]` metric labels | Medium | 114-115 | `text-[11px]` minimum |

### Outlets Show (`owner/outlets/show.tsx`)

| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| 8 standalone bordered cards | Critical | Throughout | Use grouped sections |
| "Edit" button 36px | High | 60 | `min-h-[44px]` |
| "Arsipkan" button 36px | High | 64 | `min-h-[44px]` |
| Back button 36px | High | owner-page-shell:27 | `h-11 w-11` |
| Audit log shows raw field names | Medium | 292-323 | Translate to human-readable |

### Pricing (`owner/pricing/`)

| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| HTML tables with 5-7 columns | Critical | master.tsx:145, outlet.tsx:306, history.tsx:74 | Replace with card lists |
| Bulk update 8 inline buttons ~24pt | Critical | outlet.tsx:266-267 | Use sheet with larger buttons |
| `confirm()` dialogs | High | outlet.tsx:165, 186 | Use bottom sheet |
| Pagination web pattern | High | Multiple | Use infinite scroll |

### Reports (`owner/reports/index.tsx`)

| Issue | Severity | Line | Fix |
|-------|----------|------|-----|
| `text-[9px]` KPI labels | Critical | 144 | `text-[11px]` minimum |
| `text-[10px]` breakdown labels | High | 155 | `text-[11px]` minimum |
| Period selector ~32pt | Medium | 75 | `min-h-[44px]` |

---

## Navigation Redesign

### Current Problems

| Role | Issue |
|------|-------|
| Customer | 4 tabs — OK but "Help" tab wastes space |
| Outlet | 5 tabs + "More" hiding 4+ destinations |
| Courier | 2 tabs — too sparse |
| Owner | Sidebar + hamburger + 5 tabs — confusing |

### Recommended Tab Structure

**Customer (4 tabs):**
```
Beranda | Produk | Pesanan | Profil
```

**Outlet (4 tabs):**
```
Dashboard | Pesanan | Scan | Inventaris
```
Move Restocks, Deliveries, Returns, Exchanges to "Pesanan" detail or contextual actions.

**Courier (3 tabs):**
```
Tugas | Rute | Profil
```

**Owner (4 tabs):**
```
Dashboard | Outlet | Produk | Keuangan
```
Move Pricing, Reports, Inventory to sub-pages of their parent tabs.

---

## Card System Refactor

### Current Pattern (Web Admin)
```tsx
<SectionCard label="Title">
  <div className="rounded-2xl border border-border bg-white p-5">
    {/* content */}
  </div>
</SectionCard>
```

### Target Pattern (iOS Inset Grouped)
```tsx
<div className="mb-6">
  <h2 className="mb-2 px-4 text-[13px] font-normal uppercase text-text-subtle">Title</h2>
  <div className="mx-4 overflow-hidden rounded-xl bg-white">
    <div className="border-b border-border px-4 py-3">Row 1</div>
    <div className="border-b border-border px-4 py-3">Row 2</div>
    <div className="px-4 py-3">Row 3</div>
  </div>
</div>
```

### Changes Required

| Component | Current | Target |
|-----------|---------|--------|
| SectionCard | `rounded-2xl border p-5` | `rounded-xl bg-white` with row separators |
| List items | Individual cards with border/shadow | Rows inside grouped section |
| Stats | Card grid | Horizontal scroll or inline |
| Actions | Card grid | List rows with chevrons |

---

## Typography System

### Current (Web)
```
text-[9px]  — badges (CRITICAL: below readable)
text-[10px] — tab labels, stat labels
text-[11px] — section headers, meta
text-xs     — body secondary (12px)
text-sm     — body primary (14px)
text-base   — headings (16px)
text-lg     — page titles (18px)
```

### Target (iOS HIG)
```
text-[10px] — tab labels only (iOS minimum for tabs)
text-[13px] — captions, footnotes (system caption)
text-sm     — secondary body (14px)
text-base   — primary body (16px ≈ iOS Body)
text-lg     — titles (18px ≈ iOS Title)
text-xl     — large titles (20px)
text-3xl    — hero numbers (30px ≈ iOS Large Title)
```

### Rules
- **Minimum 11px** for any readable text
- **Minimum 13px** for interactive text (buttons, links)
- **No uppercase tracking-wider** — use sentence case
- **Weight for hierarchy**, not extreme size differences

---

## Priority Matrix

### P0 — Critical (Fix Before Launch)

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 1 | Touch targets under 44pt | Accessibility failure, mis-taps | Low — change height classes |
| 2 | HTML tables on mobile | Unusable on 375px screens | High — redesign to card lists |
| 3 | Owner sidebar navigation | Web admin feel | High — restructure navigation |
| 4 | `text-[9px]` / `text-[10px]` | Unreadable text | Low — change size classes |

### P1 — Important (Fix for Polish)

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 5 | Card overuse (SectionCard) | Web dashboard feel | Medium — refactor component |
| 6 | PageHeader title too small | Wrong iOS feel | Low — change size |
| 7 | Bottom sheet missing swipe-to-dismiss | Non-native interaction | Medium — add gesture |
| 8 | Raw status strings with underscores | Data display bug | Low — add label map |
| 9 | Uppercase tracking-wider headers | Web pattern | Low — change classes |

### P2 — Nice to Have (Polish)

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 10 | `active:scale-[0.99]` feedback | Non-native feel | Low — change to opacity |
| 11 | Heavy shadows on footers | Web feel | Low — use thin separator |
| 12 | Auto-rotating carousel | Accessibility | Low — add reduced-motion |
| 13 | 3-second forced delay | Poor UX | Low — remove setTimeout |
| 14 | Inconsistent spacing | Visual noise | Low — standardize |

---

## Implementation Roadmap

### Phase 1: Foundation (1-2 days)
- Fix all touch targets to 44pt minimum
- Fix all text to 11px minimum
- Fix PageHeader title size
- Fix raw status strings
- Remove `active:scale` transforms

### Phase 2: Components (2-3 days)
- Refactor SectionCard to iOS Inset Grouped style
- Refactor DataTable to card-based list
- Add swipe-to-dismiss to BottomSheet
- Standardize FilterChips touch targets
- Extract shared StepHeader/StepButton components

### Phase 3: Navigation (2-3 days)
- Restructure Owner layout (remove sidebar)
- Simplify Outlet tab structure
- Add 3rd tab for Courier
- Remove hamburger menu pattern

### Phase 4: Screen Refactor (3-5 days)
- Customer: product list items → flat rows with separators
- Outlet: order detail → grouped sections instead of stacked cards
- Owner: pricing/tables → card-based lists
- Owner: outlet show → tabbed sections

### Phase 5: Polish (1-2 days)
- Add prefers-reduced-motion support
- Remove 3-second delays
- Standardize spacing scale
- Test on iPhone SE and Pro Max
- VoiceOver testing pass
