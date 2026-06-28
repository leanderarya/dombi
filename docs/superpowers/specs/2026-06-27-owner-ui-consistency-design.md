# Owner UI/UX Consistency Audit — Design Spec

**Date:** 2026-06-27
**Scope:** 37 owner pages, 25 controllers
**Dimension:** UI/UX Consistency (token, spacing, card, badge, filter, button, layout)
**Approach:** Per Domain (Steve Jobs Design Review)

---

## Problem

Owner pages were built incrementally over time, resulting in inconsistent UI patterns:

- **Token usage:** Hardcoded `slate-*`, `zinc-*`, `emerald-*` instead of semantic tokens (`text-text`, `border-border`, `bg-surface`)
- **Spacing:** `mb-4`, `mb-5`, `mb-6`, `space-y-3`, `space-y-4`, `space-y-6` mixed
- **Card styles:** `rounded-2xl shadow-sm` vs `rounded-xl` vs `rounded-lg`
- **Status badges:** 3 different approaches (unified `StatusBadge`, manual `statusStyles` map, inline badge)
- **Filters:** 4 patterns (DataTable header, FilterSheet, FilterChips, manual `<select>`)
- **Buttons:** Hardcoded `bg-emerald-600/700` vs `bg-primary` token
- **Empty states:** 3 approaches (`EmptyState` component, manual JSX, inline text)
- **Layout:** `OwnerPageShell` (most) vs `OwnerLayout` directly (order-reports, orders/show)
- **Back button:** `ArrowLeft` vs `ChevronLeft`

---

## Target State

All 37 owner pages follow the same visual language established in customer, outlet, and courier pages.

### Design Tokens

| Token | Usage |
|-------|-------|
| `text-text` | Primary text |
| `text-text-muted` | Secondary text |
| `text-text-subtle` | Tertiary/label text |
| `border-border` | Default border |
| `border-border-strong` | Hover/active border |
| `bg-surface` | Page background |
| `bg-surface-muted` | Card background, hover states |
| `bg-primary` | Primary button, accent |
| `bg-primary-hover` | Primary button hover |
| `bg-primary-light` | Light accent background |

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `mb-4` | 16px | Default section margin |
| `space-y-2` | 8px | List items spacing |
| `space-y-4` | 16px | Sections spacing |
| `mt-4` | 16px | Header to content spacing |
| `p-4` | 16px | Card padding |

### Component Standards

| Element | Standard |
|---------|----------|
| Card | `rounded-xl border border-border bg-white p-4` |
| Status Badge | `StatusBadge` with `{status}` prop (auto-maps) |
| Filter (header) | `Select` component in `headerRight` |
| Filter (sheet) | `FilterSheet` bottom sheet |
| Filter (chips) | `FilterChips` component |
| Empty State | `EmptyState` component |
| Back Button | `ChevronLeft` icon |
| Layout | `OwnerPageShell` for all pages |

---

## Audit Order

### Batch 1: Dasbor (1 page)

**Files:**
- `resources/js/pages/owner/dashboard.tsx`

**Current state:**
- Uses `OwnerPageShell` ✓
- Hero bar: `bg-gradient-to-br from-primary to-primary-hover` (acceptable)
- KPI cards: Uses `OwnerKpiCard` (already tokenized)
- Action items: `border-border`, `text-text`, `text-text-muted` ✓
- Expandable sections: `bg-blue-50`, `bg-amber-50`, `bg-emerald-50` (hardcoded semantic colors for icons — acceptable for icon backgrounds)

**Action items:**
- Audit hardcoded colors in action item icon backgrounds
- Verify spacing consistency

---

### Batch 2: Operasional (8 pages)

**Files:**
- `resources/js/pages/owner/orders/index.tsx`
- `resources/js/pages/owner/orders/show.tsx`
- `resources/js/pages/owner/deliveries/index.tsx`
- `resources/js/pages/owner/deliveries/show.tsx`
- `resources/js/pages/owner/deliveries/board.tsx`
- `resources/js/pages/owner/returns/index.tsx`
- `resources/js/pages/owner/returns/show.tsx`
- `resources/js/pages/owner/exchanges/index.tsx`
- `resources/js/pages/owner/exchanges/show.tsx`

**Known issues:**
- `orders/show.tsx`: Uses `OwnerLayout` directly (not `OwnerPageShell`)
- `orders/show.tsx`: Hardcoded `border-slate-200`, `text-slate-400`, `bg-emerald-50`, `text-emerald-700`
- `returns/index.tsx`: Hardcoded `border-zinc-100`, `text-zinc-500`, `bg-emerald-600`
- `returns/show.tsx`: Hardcoded `border-zinc-100`, `text-zinc-500`, `bg-emerald-600`
- `exchanges/index.tsx`: Same hardcoded colors as returns
- `deliveries/index.tsx`: Uses `DataTable` (acceptable)
- Status badges: Returns and exchanges use `StatusBadge` ✓, but some manual status maps exist

**Action items:**
- Convert `orders/show.tsx` to use `OwnerPageShell`
- Replace all hardcoded `slate-*`, `zinc-*` with tokens
- Replace hardcoded `emerald-*` buttons with `bg-primary`
- Verify filter patterns are consistent

---

### Batch 3: Keuangan (4 pages)

**Files:**
- `resources/js/pages/owner/finance/index.tsx`
- `resources/js/pages/owner/finance/outlet-detail.tsx`
- `resources/js/pages/owner/settlement-payments.tsx`
- `resources/js/pages/owner/payment-accounts.tsx`

**Known issues:**
- `finance/index.tsx`: Sticky filter uses `-mx-4` hack, hardcoded `border-slate-200`, `bg-white/80`
- `settlement-payments.tsx`: Same sticky filter pattern, hardcoded `border-slate-200`
- `payment-accounts.tsx`: Hardcoded `border-zinc-200`, `bg-emerald-600`, `bg-zinc-100`
- Finance components (`FinanceKpiCard`, `FinanceFilterTabs`, `FinanceOutletCard`, `PaymentHistoryCard`) — need to check token usage

**Action items:**
- Tokenize all finance pages
- Verify finance components use tokens
- Standardize filter pattern

---

### Batch 4: Master Data (10 pages)

**Files:**
- `resources/js/pages/owner/outlets/index.tsx`
- `resources/js/pages/owner/outlets/show.tsx`
- `resources/js/pages/owner/outlets/create.tsx`
- `resources/js/pages/owner/outlets/edit.tsx`
- `resources/js/pages/owner/product-families/index.tsx`
- `resources/js/pages/owner/product-families/show.tsx`
- `resources/js/pages/owner/pricing/index.tsx`
- `resources/js/pages/owner/pricing/master.tsx`
- `resources/js/pages/owner/pricing/outlet.tsx`
- `resources/js/pages/owner/pricing/history.tsx`

**Known issues:**
- `outlets/index.tsx`: Hardcoded `border-slate-200`, `text-slate-900`, `bg-[#F8FAFC]`
- `outlets/show.tsx`: Hardcoded `border-slate-200`, `text-slate-900`, `bg-[#F8FAFC]`, `shadow-sm`
- `product-families/index.tsx`: Hardcoded `border-zinc-200`, `bg-emerald-600`, `text-zinc-500`
- `pricing/index.tsx`: Hardcoded `border-slate-200`, `text-slate-900`

**Action items:**
- Tokenize all master data pages
- Replace `bg-[#F8FAFC]` with `bg-surface-muted`
- Replace `shadow-sm` with consistent card style

---

### Batch 5: Persediaan (7 pages)

**Files:**
- `resources/js/pages/owner/inventories/index.tsx`
- `resources/js/pages/owner/inventories/create.tsx`
- `resources/js/pages/owner/inventories/edit.tsx`
- `resources/js/pages/owner/restocks/index.tsx`
- `resources/js/pages/owner/restocks/show.tsx`
- `resources/js/pages/owner/distributions/index.tsx`
- `resources/js/pages/owner/distributions/show.tsx`

**Known issues:**
- `inventories/index.tsx`: Uses `bg-surface` ✓, but some hardcoded `text-slate-600`
- `restocks/index.tsx`: Hardcoded `statusStyles` map instead of `StatusBadge`
- `restocks/show.tsx`: Hardcoded `border-slate-200`, `text-slate-950`, `shadow-sm`
- `distributions/index.tsx`: Same `statusStyles` map pattern

**Action items:**
- Convert restocks/distributions to use `StatusBadge`
- Tokenize all persediaan pages
- Standardize card style (remove `shadow-sm`)

---

### Batch 6: Analitik (6 pages)

**Files:**
- `resources/js/pages/owner/analytics/index.tsx`
- `resources/js/pages/owner/reports/index.tsx`
- `resources/js/pages/owner/stock-movements/index.tsx`
- `resources/js/pages/owner/order-reports/index.tsx`
- `resources/js/pages/owner/order-reports/show.tsx`

**Known issues:**
- `analytics/index.tsx`: Hardcoded `border-zinc-200`, `text-slate-500`, `bg-emerald-600`
- `reports/index.tsx`: Hardcoded `border-slate-200`, `text-slate-400`, `bg-emerald-600`
- `order-reports/index.tsx`: Uses `OwnerLayout` directly (not `OwnerPageShell`)
- `order-reports/index.tsx`: Already uses tokens (`text-text`, `border-border`) ✓

**Action items:**
- Convert `order-reports/index.tsx` to use `OwnerPageShell` (or keep `OwnerLayout` with `FilterChips` — consistent with customer pattern)
- Tokenize analytics and reports pages

---

## Done Criteria

For each batch:
1. All pages in the domain use consistent tokens
2. No hardcoded `slate-*`, `zinc-*` (except semantic icon backgrounds like `bg-blue-50`)
3. All `emerald-*` buttons replaced with `bg-primary`
4. Spacing consistent (`mb-4`, `space-y-2`, `space-y-4`)
5. Cards use `rounded-xl border border-border bg-white p-4`
6. Status badges use `StatusBadge` component
7. Empty states use `EmptyState` component
8. Build clean (TypeScript no error)
9. `/steve-jobs-design-review` passes

---

## Risks

1. **sed corruption:** Previous batch sed corrupted `bg-emerald-500` → `bg-primary-light0`. Fix: Use targeted Edit tool instead of sed.
2. **Scope creep:** Owner pages have many sub-components (`FinanceKpiCard`, `FinanceFilterTabs`, etc.). Fix: Only fix pages, not shared components (unless broken).
3. **Semantic colors:** Some `emerald-*` is semantic (success states, positive numbers). Rule: Keep `emerald-*` when it means "success/positive/active" (e.g., stock level badge, payment status, positive trend). Replace `emerald-*` when it's UI chrome (buttons, borders, hover states, filter tabs) with `bg-primary` / `border-border` tokens.
