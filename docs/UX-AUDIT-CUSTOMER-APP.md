# Dombi Customer App — UX Audit & Redesign Roadmap

**Date:** 2026-06-18
**Status:** Audit Complete
**Goal:** Transform from CRUD Mobile App → Modern Consumer Commerce App

---

## Executive Summary

Customer app saat ini terasa seperti **CRUD mobile panel**, bukan **modern consumer commerce app**. Masalah terbesar bukan pada fitur, tapi pada:

- Visual hierarchy lemah
- Card tidak memiliki rhythm konsisten
- Spacing kurang natural
- Belum memiliki design language yang kuat
- Belum memiliki identitas seperti Fore, GrabFood, atau Kopi Kenangan

---

## Biggest Problems Found

### 1. Card Design Inconsistency

| Pattern | Radius | Border | Shadow | Padding |
|---------|--------|--------|--------|---------|
| A | `rounded-xl` | `border-slate-200` | none | `px-4 py-3` |
| B | `rounded-xl` | `border-emerald-200` | none | `p-4` |
| C | `rounded-lg` | `border-zinc-100` | none | `p-4` |
| D | `rounded-2xl` | none | `shadow-xl` | `px-5 py-4` |

**Problem:** 3 radius values, 3 border color systems, zero shadows, inconsistent padding.

### 2. Color Palette Drift

App mixes `slate-*` and `zinc-*` neutrals interchangeably. Modern apps use single neutral scale.

### 3. Typography Scale Fragmentation

Non-standard sizes used: `10px`, `11px`, `13px`, `15px`, `22px`. Should use Tailwind scale only.

### 4. No Visual Depth

Zero shadows on any card. Modern apps use subtle elevation for depth.

### 5. No Loading States

Skeleton component exists but never used in customer pages.

---

## Audit by Page

### Welcome Page
- **Issue:** Secondary CTA "Lewati Tahap Ini" has `text-slate-400` — fails WCAG AA contrast
- **Issue:** Carousel indicators are decorative, not functional
- **Issue:** Loading state shows generic pulse, not branded

### Home Page
- **Issue:** Hero carousel 2/3 slides have no CTA — wasted space
- **Issue:** "Pesan Sekarang" section buried below account summary
- **Issue:** Section margins inconsistent (`mt-4`, `mt-5`, `mt-6`)
- **Issue:** Trust section "Sertifikasi Halal" at `text-[10px]` — too small to read
- **Issue:** Pickup/Delivery buttons use different colors (emerald vs blue)

### Products Page
- **Issue:** No product images — emoji placeholders
- **Issue:** List items have no card boundaries
- **Issue:** Section headers use non-standard `text-[15px]`
- **Issue:** No skeleton loading state

### Product Detail
- **Issue:** Image area is placeholder gradient with emoji
- **Issue:** Toast notification pushes content down
- **Issue:** `pb-40` hardcoded for sticky CTA
- **Issue:** Variant summary too subtle at `text-sm text-zinc-500`

### Checkout Flow
- **Issue:** Double title ("Pesanan Anda" + "Checkout")
- **Issue:** Step header uses `-mx-4 -mt-5` layout hack
- **Issue:** Form labels use section label style (`text-[11px] uppercase`)
- **Issue:** Order summary hidden behind expand toggle

### Orders Page
- **Issue:** Empty state CTA links to `/checkout` (empty) — should be `/products`
- **Issue:** Recovery card uses different border color than other cards
- **Issue:** Magic number `h-26` spacer

### Orders Show
- **Issue:** Tracking code section too prominent
- **Issue:** Rejection reason card not urgent enough
- **Issue:** Courier card vs failed delivery card use different radius

### Track Page
- **Issue:** Public link section too prominent
- **Issue:** 3-button grid has inconsistent styling
- **Issue:** No SPA navigation on "Kembali ke Beranda" link

### Profile Page
- **Issue:** Title "Pengaturan" at `text-lg` — smaller than other pages
- **Issue:** No logout button
- **Issue:** No user avatar/name display
- **Issue:** Version text at `text-[11px]` — barely readable

### Addresses
- **Issue:** "Tambah Alamat" button uses `bg-slate-900` — competes with bottom nav
- **Issue:** "Utama" badge at `text-[9px]` — extremely small
- **Issue:** Address form header uses layout hack

---

## Shared Components Issues

### Dialog (`dialog.tsx`)
- Uses `rounded-2xl` while cards use `rounded-xl` — inconsistent
- No animation on open/close
- Close button uses `hover:` (desktop) not `active:` (mobile)
- No `max-h` constraint — can overflow viewport

### VariantListItem
- Favorite heart button `h-7 w-7` — below 44px touch target
- Quick-add button `h-9 w-9` — below 44px touch target
- No skeleton for image placeholder

### ActiveOrderCard
- "Lacak Pesanan" uses `bg-slate-900`, "Pesan Lagi" uses `bg-emerald-700` — two dark colors
- Item summary uses `truncate` with no tooltip

### OrderHistoryCard
- Package icon placeholder is generic
- "Detail" button looks disabled compared to "Pesan Lagi"
- Uses absolute dates instead of relative

### FloatingCartBar
- "Lihat Keranjang" appears twice (text + button)
- Uses `bg-slate-900` — heavy compared to light page background

### BottomNav
- Labels at `text-[10px]` — below comfortable reading
- "Akun" tab uses gear icon, not person icon
- Active/inactive contrast could be stronger

### EmptyOrderState
- CTA links to `/checkout` — should be `/products`
- Uses `rounded-lg` while cards use `rounded-xl`

---

## New Design Language

### Direction

**Fore Coffee × GrabFood**

Not: Bootstrap Admin × Mobile CRUD

### Card System Rules

**Rule 1: Reduce borders**
- Use soft surface + subtle shadow instead of borders
- Only use borders for interactive/selected states

**Rule 2: Consistent radius**
- `rounded-3xl` for hero cards
- `rounded-2xl` for product/info cards
- `rounded-xl` for compact elements

**Rule 3: Cards shouldn't look like boxes**
- Cards should blend with layout
- Use elevation (shadow) for depth
- Not: `┌─────┐` but: seamless surface

### Spacing System

Use only: `8`, `12`, `16`, `24`, `32`

### Typography System

| Element | Size | Weight |
|---------|------|--------|
| Title | `text-xl` | `font-semibold` |
| Product Name | `text-base` | `font-medium` |
| Price | `text-lg` | `font-semibold` |
| Supporting | `text-sm` | `text-muted` |
| Label | `text-xs` | `font-medium` |

### Color System

Pick ONE neutral scale: `zinc` or `slate` (recommend `zinc`)

---

## Priority Action Items

### P0 — Critical (Fix Immediately)

| # | Issue | File | Impact |
|---|-------|------|--------|
| 1 | Secondary CTA contrast failure | `welcome.tsx:115` | Accessibility |
| 2 | EmptyOrderState CTA links to empty checkout | `empty-order-state.tsx:15` | UX |
| 3 | Touch targets below 44px | `variant-list-item.tsx:99,136` | Accessibility |
| 4 | No loading/skeleton states | All pages | UX |

### P1 — High (Fix Soon)

| # | Issue | Impact |
|---|-------|--------|
| 5 | Card design inconsistency | Visual |
| 6 | Color palette drift | Visual |
| 7 | Typography scale fragmentation | Visual |
| 8 | BottomNav gear icon instead of person | UX |
| 9 | No logout button on profile | UX |
| 10 | Dialog hover instead of active | Mobile UX |

### P2 — Medium (Improve)

| # | Issue | Impact |
|---|-------|--------|
| 11 | No product images | Visual |
| 12 | Hero carousel wasted space | Conversion |
| 13 | Checkout hides order items | UX |
| 14 | Section spacing inconsistent | Visual |
| 15 | Track page link section too prominent | UX |

### P3 — Low (Polish)

| # | Issue | Impact |
|---|-------|--------|
| 16 | No dialog animation | Polish |
| 17 | No pull-to-refresh | UX |
| 18 | Trust section too small | Visual |
| 19 | No promotional banners | Conversion |
| 20 | Page props not typed | Code quality |

---

## Redesign Roadmap

### Sprint 1: Foundation (3 days)

**Goal:** Establish consistent design system

| Task | Description | Est. |
|------|-------------|------|
| 1.1 | Fix P0 issues (contrast, empty state, touch targets) | 1d |
| 1.2 | Standardize card system (radius, borders, shadows) | 1d |
| 1.3 | Standardize typography & color scale | 1d |

### Sprint 2: Product Experience (3 days)

**Goal:** Modern product browsing

| Task | Description | Est. |
|------|-------------|------|
| 2.1 | Redesign product cards with images | 1d |
| 2.2 | Improve product detail page | 1d |
| 2.3 | Add skeleton loading states | 1d |

### Sprint 3: Order Experience (2 days)

**Goal:** Clear order management

| Task | Description | Est. |
|------|-------------|------|
| 3.1 | Redesign order cards | 1d |
| 3.2 | Improve empty states | 0.5d |
| 3.3 | Fix profile page (logout, avatar) | 0.5d |

### Sprint 4: Checkout & Home (2 days)

**Goal:** Smooth checkout flow

| Task | Description | Est. |
|------|-------------|------|
| 4.1 | Simplify checkout UI | 1d |
| 4.2 | Improve home page hierarchy | 1d |

---

## Summary

| Area | Issues | Priority |
|------|--------|----------|
| Card Design | 5 issues | P1 |
| Typography | 3 issues | P1 |
| Color | 2 issues | P1 |
| Spacing | 3 issues | P2 |
| Accessibility | 3 issues | P0 |
| Missing Features | 5 issues | P2-P3 |

**Total: 28 issues identified**
**Estimated effort: 10 days**
