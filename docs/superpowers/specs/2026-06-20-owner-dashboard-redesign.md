# Owner Dashboard Redesign — Design Spec

## Goal

Redesign the Owner dashboard from a data-dense 15+ element layout to a minimal, decision-focused dashboard with 4 sections. Style: minimalist modern (Linear/Vercel inspired).

## Current State

The dashboard has 6 sections with 8 KPI cards, 4 action cards, outlet attention list, settlement alerts, and inventory risks. Problems:
- Information overload (15+ elements)
- Monotonous layout (all sections look the same)
- No interactivity (static cards)
- Flat typography (no visual hierarchy)
- Duplicate data (outstanding amount shown twice: hero + KPI card)
- Dead KPI strip (second row always shows zeros — backend never populates)
- Broken polling (reloads wrong Inertia prop keys)

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Approach | Hero + 3 KPI + Expandable | Minimalis tapi tetap informatif |
| Visual style | Minimalist modern | Clean, whitespace-heavy, subtle borders |
| KPI count | 3 (dari 8) | Hanya Tagihan, Butuh Tindakan, Stok Kritis |
| Sections | 4 (dari 6) | Hero + 3 KPI + 2 expandable |
| Interactivity | Clickable KPI + Expandable sections | Klik KPI → halaman terkait, expand/collapse detail |
| Outlet attention | Dihapus dari dashboard | Bisa diakses via menu Outlets |

## New Dashboard Structure

### Section 1: Page Header
- Title: "Dasbor" (bukan "Dasbor Keputusan")
- Subtitle: "Ringkasan operasional hari ini"

### Section 2: Hero Bar
- Background: gradient emerald-700 → emerald-800
- Left side:
  - Label: "Tagihan Tertunggak" (uppercase, small, semi-transparent)
  - Value: Outstanding amount (text-3xl, font-bold, tabular-nums)
  - Subtitle: "X outlet · Y hari rata-rata jatuh tempo"
- Right side:
  - CTA button: "Lihat Penagihan →" (semi-transparent white bg)
  - Links to: `/owner/finance`

### Section 3: KPI Cards (3 columns)
- Grid: `grid-cols-1 sm:grid-cols-3`, gap-3
- Each card:
  - Icon in colored rounded box (32x32)
  - Label (text-xs, text-muted)
  - Value (text-2xl, font-bold, tabular-nums)
  - Subtitle (text-xs, text-subtle)
  - Entire card is clickable → links to related page

| KPI | Icon | Value | Subtitle | Link |
|-----|------|-------|----------|------|
| Tagihan | 💰 Wallet | Rp X.XJt | "X outlet belum bayar" | `/owner/finance` |
| Butuh Tindakan | 📋 ClipboardList | 5 | "2 restock · 2 return · 1 pembayaran" | Expand section below |
| Stok Kritis | ⚠️ AlertTriangle | 3 | "SKU perlu restock segera" | `/owner/inventories?filter=critical` |

### Section 4: Expandable Sections (2)

**"Butuh Tindakan" section:**
- Header: title + count badge (blue)
- Click to expand/collapse
- When expanded: list of pending items
  - Each item: icon + description + action link
  - Items: restock requests, returns, exchanges, settlement payments
  - Max 5 items shown, "Lihat Semua" link if more

**"Stok Kritis" section:**
- Header: title + count badge (red)
- Click to expand/collapse
- When expanded: list of critical SKUs
  - Each item: variant name + stock info + restock link
  - Max 5 items shown, "Lihat Semua" link if more

## Visual Design

### Colors
- Background: `bg-surface` (white)
- Hero: gradient `emerald-700` → `emerald-800`
- Cards: `border-border` (slate-200), `bg-surface`
- Text: `text-text` (primary), `text-text-muted` (secondary)
- Severity: red for critical, blue for info, amber for warning

### Typography
- Page title: `text-xl font-semibold tracking-tight`
- Hero value: `text-3xl font-bold tabular-nums`
- KPI value: `text-2xl font-bold tabular-nums`
- Section header: `text-sm font-semibold`
- Item text: `text-sm`
- Labels: `text-xs font-medium text-text-muted`

### Spacing
- Section gap: `gap-4` (16px)
- Card padding: `p-4` (16px)
- Hero padding: `px-6 py-5` (24px, 20px)
- Item padding: `py-2` (8px)

### Border Radius
- Hero: `rounded-2xl` (16px)
- KPI cards: `rounded-xl` (12px)
- Expandable sections: `rounded-xl` (12px)

### Interactions
- KPI cards: hover border highlight (`hover:border-border-strong`)
- Expandable sections: rotate chevron icon on expand
- Action links: `text-primary hover:text-primary-hover`

## Backend Changes

### Remove from DashboardController
- `agingKpis` computation (dead code — never used by frontend)
- Second KPI strip data (`monthlyBilling`, `monthlyPayments`, `activeReturns`, `activeExchanges`)
- `outletAttention` data (removed from dashboard)

### Fix
- Update `usePolling` to reload correct Inertia prop keys
- Remove duplicate outstanding amount (keep hero, remove KPI card)

## Files to Modify

### Frontend
- `resources/js/pages/owner/dashboard.tsx` — Complete rewrite
- `resources/js/components/owner/owner-kpi-card.tsx` — Add clickable variant
- `resources/js/components/ui/expandable-section.tsx` — New component

### Backend
- `app/Http/Controllers/Owner/DashboardController.php` — Simplify data

## Acceptance Criteria

1. Dashboard shows exactly 4 sections: header, hero, 3 KPI, 2 expandable
2. All KPI cards are clickable and navigate to correct pages
3. Expandable sections expand/collapse on click
4. Hero shows outstanding amount with outlet count and average days overdue
5. "Butuh Tindakan" shows pending restocks, returns, exchanges, payments
6. "Stok Kritis" shows SKUs below threshold
7. Polling works correctly (auto-refresh every 30s)
8. No dead data (all displayed data is populated by backend)
9. Responsive: 3-column KPI on desktop, 1-column on mobile
10. All colors use semantic tokens (no hardcoded slate/zinc)

## Out of Scope

- Dark mode
- Charts/graphs
- Date range filtering
- Outlet attention page (moved to separate task)
- Animation/transitions beyond hover states
