# Owner Role — Compact & Clean Redesign

**Date:** 2026-07-07  
**Scope:** Owner role UI (desktop-first)  
**Goal:** Visual noise reduction, data density increase. All existing functionality preserved.

---

## Design Approach: Card-Light

Notion-style soft backgrounds, tighter spacing, minimal borders. No heavy card shadows. Table rows replace card lists on data pages. Sidebar grouping reduced from 7 to 6.

---

## 1. Sidebar Navigation

### Regrouping

**Before (7 groups):** Dasbor, Operasional (3), Keuangan (1), Pengiriman (1), Master Data (3), Persediaan (3), Analitik (1)

**After (6 groups):** Dasbor (top-level link), Operasional (4 items), Keuangan (1), Master Data (3), Persediaan (3), Analitik (1)

- "Pengiriman" (`/owner/delivery-tiers`) merged into "Operasional" group
- "Dasbor" becomes single top-level link (no expandable group wrapper)
- Group labels unchanged

### Spacing Changes

| Element | Before | After |
|---------|--------|-------|
| Nav item padding | `px-3 py-2` | `px-2.5 py-1.5` |
| Nav item font | `text-[13px]` | `text-xs` (12px) |
| Group heading font | `text-[13px]` | `text-[11px]` |
| Group margin-top | `mt-1` | `mt-0.5` |
| Child item padding | `px-3 py-1.5` | `px-2.5 py-1` |

### File Changes

- `resources/js/layouts/owner-layout.tsx` — remove "Pengiriman" group, add `delivery-tiers` to Operasional items, move Dasbor to top-level link
- `resources/js/components/owner/owner-sidebar-nav.tsx` — reduce padding/font classes

---

## 2. Page Shell & Layout

### Page Header

| Element | Before | After |
|---------|--------|-------|
| Header border-bottom + padding | `border-b pb-4 mb-6` | `border-b pb-3 mb-4` |
| Title font | `text-xl lg:text-2xl` | `text-lg lg:text-xl` |

### Main Content Container

| Element | Before | After |
|---------|--------|-------|
| Max width | `max-w-300` (1200px) | `max-w-7xl` (1280px) |
| Container padding | `px-6 py-8` | `px-6 py-6` |

### Section Spacing (global)

| Class | Before | After |
|-------|--------|-------|
| Section gap | `space-y-4` / `gap-6` | `space-y-3` / `gap-4` |
| Card radius | `rounded-xl` / `rounded-2xl` | `rounded-lg` |

### File Changes

- `resources/js/components/owner/owner-page-shell.tsx` — adjust padding/gap classes
- `resources/js/layouts/owner-layout.tsx` — adjust `max-w` and container `px/py`

---

## 3. Dashboard Page

### Layout Restructure

**Before:** 2-column grid (actions-left + KPIs-right), big bordered card sections

**After:** KPI horizontal strip → 2-column (actions-left + stock-right) → hero bar

### KPI Section

- Replace 2×2 card grid with **4-wide horizontal strip**
- Each KPI: `bg-[#f7f7f7] rounded-lg p-2.5`, no border, no shadow
- Font: label `text-[10px]`, value `text-base font-bold`
- Remove `OwnerKpiCard` wrapper — inline simple divs

### "Butuh Tindakan" Section

- Border-card items → **bg-only soft list**
- Each item: `bg-[#fafafa] rounded-md px-3 py-2`, icon box in `w-6 h-6`
- Icon box: tinted background matching status (amber for restock/return, blue for payment)
- Remove `ExpandedSection` wrapper — use simple section heading + count badge

### "Stok Kritis" Section

- Same bg-list style as Butuh Tindakan
- Risk items: `bg-red-50 rounded-md px-3 py-2`
- "Restock" CTA button: compact `text-[10px] px-2 py-1`

### Hero Bar (Tagihan Tertunggak)

- Keep but downsize: `rounded-lg px-4 py-3` (was `rounded-xl px-5 py-4 lg:px-6 lg:py-5`)
- Amount: `text-xl` (was `text-2xl lg:text-3xl`)

### File Changes

- `resources/js/pages/owner/dashboard.tsx` — full restructure
- `resources/js/components/owner/owner-kpi-card.tsx` — may be removed or slimmed

---

## 4. List Pages (Orders, Deliveries, Restocks, Returns, etc.)

### Table Row Layout

**Before:** Individual white cards (`rounded-xl border p-4 hover:shadow-md`)

**After:** Single bordered container with table rows

#### Structure

```
┌─ border rounded-lg overflow-hidden ─────────────┐
│ Header row (bg-[#fafafa], border-b)              │
│ ├ Kode  ├ Info              ├ Status ├ Total ├→ │
├──────────────────────────────────────────────────┤
│ Row (border-b border-[#f0f0f0] last:border-0)    │
│ ├ #ORD  ├ Customer · Outlet ├ Badge  ├ RpXX ├→│
│ ...                                              │
└──────────────────────────────────────────────────┘
```

#### Specs

- Row padding: `py-2 px-3`
- Header: `text-[10px] uppercase text-text-muted`
- Row font: `text-xs` (12px)
- Hover: `bg-surface-muted`, no shadow lift, no border change
- Status badge inside row: `px-1.5 py-0.5 text-[10px] rounded-lg`
- Action column: `text-primary font-semibold text-right` ("Detail →")
- "Assign Kurir" button: `text-[10px] px-2 py-0.5`

### Filters

**Before:** Pills row + separate controls row (3 visual rows)

**After:** Single row — pills left, controls right (flex-wrap)

- Filter pills: `px-2.5 py-1 text-[10px] rounded-full`
- Search: `h-8 w-40`
- Select/Date: `h-8`

### KPI Stats

**Before:** Sticky sidebar (320px) with individual stat cards

**After:** 4-wide KPI strip above table (same style as dashboard KPI)

### File Changes (per page)

Each owner list page needs table-row conversion. Priority pages:

1. `resources/js/pages/owner/orders/index.tsx`
2. `resources/js/pages/owner/deliveries/index.tsx`
3. `resources/js/pages/owner/restocks/index.tsx`
4. `resources/js/pages/owner/returns/index.tsx`
5. `resources/js/pages/owner/exchanges/index.tsx`
6. `resources/js/pages/owner/inventories/index.tsx`
7. `resources/js/pages/owner/distributions/index.tsx`

---

## 5. Detail/Show Pages

### Section Layout

**Before:** Individual white cards (`rounded-2xl border p-5 shadow-sm`), stacked vertically

**After:** 2-column grid of compact bordered sections

#### Specs

- Section container: `border rounded-lg p-4`
- Section heading: `text-[11px] font-bold uppercase text-text-muted mb-3`
- Content: key-value rows — `flex justify-between py-1 border-b border-[#f5f5f5] last:border-0`
- Label: `text-text-muted`, value: `text-text`
- Full-width sections (timeline, payment, delivery tracking) use `col-span-full`
- 2-column grid: `grid-cols-1 lg:grid-cols-2 gap-3`. Metadata sections stack left; items/timeline span right or full-width depending on content volume.

### Back Button

- Size: `h-7 w-7` (was `h-9 w-9`)
- Padding: `p-1.5` (was `p-2`)

### Status Badge (in header)

- Compact: `px-1.5 py-0.5 text-[10px] rounded-lg`
- Displayed inline next to title, not inside a card

### File Changes

1. `resources/js/pages/owner/orders/show.tsx`
2. `resources/js/pages/owner/deliveries/show.tsx`
3. `resources/js/pages/owner/restocks/show.tsx`
4. `resources/js/pages/owner/returns/show.tsx`
5. `resources/js/pages/owner/exchanges/show.tsx`
6. `resources/js/pages/owner/outlets/show.tsx`
7. `resources/js/pages/owner/distributions/show.tsx`

---

## 6. Shared Component Changes

### Status Badge (`components/ui/status-badge.tsx`)

| Prop | Before | After |
|------|--------|-------|
| Padding (sm) | `px-2 py-0.5` | `px-1.5 py-0.5` |
| Font | `text-xs` | `text-[10px]` |
| Radius | `rounded-full` | `rounded-lg` |

### Action Buttons (Primary/Outline)

| Prop | Before | After |
|------|--------|-------|
| Padding | `px-3 py-1.5` | `px-2.5 py-1` |
| Font | `text-xs` | `text-[11px]` |
| Radius | `rounded-lg` | `rounded-md` |

### Owner KPI Card (`components/owner/owner-kpi-card.tsx`)

- Slim down, do not remove (used by analytics pages): no border, no shadow, `rounded-md p-2.5`, label `text-[10px]`, value `text-base`

### Expandable Section (`components/ui/expandable-section.tsx`)

- Reduce padding: `px-3 py-2` (was `px-4 py-3`)
- Reduce heading font in collapsed state
- Note: Dashboard deliberately replaces ExpandableSection with simple headings (see §3). This component shrinks for remaining use on analytics, inventory, etc.

### Pagination (`components/ui/pagination.tsx`)

- Page buttons: `px-2 py-1 text-xs` (was `px-3 py-1.5`)
- Gap: `gap-1` (was `gap-2`)

---

## 7. Owner-Scoped Theme Adjustments

### Approach: Owner wrapper class

Do NOT change global Tailwind tokens — they affect Customer/Outlet/Courier roles. Instead:

1. Add `class="owner-app"` to the root `<div>` in `owner-layout.tsx`
2. In `app.css`, add an owner-scoped block:

```css
.owner-app {
  /* override radius for owner cards */
  --owner-card-radius: 0.5rem;   /* rounded-lg instead of rounded-2xl */
  /* lighter shadow, barely visible */
  --owner-card-shadow: 0 1px 2px rgba(0,0,0,0.04);
  /* smaller control radius */
  --owner-control-radius: 0.375rem;
}
```

3. Owner components reference these via arbitrary values (e.g., `rounded-[var(--owner-card-radius)]`) instead of Tailwind utilities, OR use explicit `rounded-lg`/`rounded-md` classes directly (preferred — no new CSS variables needed, just stop using `rounded-2xl`/`rounded-xl` on owner components).

**Decision: explicit classes, no CSS variables.** Each owner component changes from `rounded-2xl`/`rounded-xl` → `rounded-lg` inline. Simpler, no coupling, no global theme risk.

### Shadow Removal

- `shadow-sm` / `shadow-card` removed from all owner components
- Hover lift effects removed
- Separation via borders (`border-border`) and background color shifts only

### Optional: Sidebar width

If further compaction needed: 224px → 208px. Evaluate after other changes.

---

## 8. Scope Limit — NOT Changed

These areas remain untouched:

- **Mobile layout** — desktop-first, mobile stays as-is
- **Customer/Outlet/Courier roles** — owner-only redesign
- **Backend controllers/services** — pure UI
- **PWA/manifest** — no change
- **Font** — keep Poppins, keep brand emerald
- **Button**, **Input**, **Dialog**, **BottomSheet** base components — only owner-layout wrappers

---

## 9. Rollout Order

1. **Sidebar regroup + spacing** (`owner-layout.tsx`, `owner-sidebar-nav.tsx`)
2. **Page shell** (`owner-page-shell.tsx`)
3. **Dashboard** (`dashboard.tsx`, convert to card-light)
4. **Orders list** (table-row conversion, pattern template)
5. **Remaining list pages** (batch: deliveries, restocks, returns, exchanges, inventories, distributions)
6. **Detail/show pages** (batch: orders/show, deliveries/show, restocks/show, returns/show, exchanges/show, outlets/show)
7. **Shared components** (status-badge, pagination, etc.)
8. **CSS variables** (`app.css` radius/shadow)
