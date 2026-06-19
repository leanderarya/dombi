# Owner Dashboard Design Refactor - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor owner dashboard to be clean, sleek, and use natural colors - inspired by modern SaaS dashboards

**Architecture:** Update design tokens, component styles, and layout for a cohesive natural color palette

**Tech Stack:** React 19, Tailwind CSS 4, Lucide Icons

---

## Design Principles

1. **Natural Colors** - Use muted, warm tones instead of saturated Tailwind colors
2. **Visual Calm** - Reduce visual noise, more whitespace, fewer borders
3. **Consistency** - Unified card styles, typography, spacing
4. **Hierarchy** - Clear visual hierarchy through size, weight, and color

---

## Color Palette

### Neutrals (Unified)
- Background: `stone-50` or `zinc-50`
- Surface: `white`
- Border: `zinc-200`
- Text primary: `zinc-900`
- Text secondary: `zinc-500`
- Text muted: `zinc-400`

### Primary (Muted Green)
- Primary: `emerald-600` (keep but soften context)
- Primary hover: `emerald-700`
- Primary light: `emerald-50`

### Status (Soften)
- Success: `emerald-500`
- Warning: `amber-500`
- Danger: `red-500`
- Info: `blue-500`

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `resources/js/pages/owner/dashboard.tsx` | Modify | Refactor dashboard layout |
| `resources/js/components/owner/owner-kpi-card.tsx` | Modify | Simplify KPI card design |
| `resources/js/components/owner/owner-action-card.tsx` | Modify | Clean action card |
| `resources/js/components/ui/section-card.tsx` | Modify | Unify card style |
| `resources/js/layouts/owner-layout.tsx` | Modify | Update sidebar colors |

---

### Task 1: Simplify Dashboard Layout

**Files:**
- Modify: `resources/js/pages/owner/dashboard.tsx`

- [ ] **Step 1: Read current dashboard**

```bash
cat resources/js/pages/owner/dashboard.tsx
```

- [ ] **Step 2: Refactor with cleaner layout**

Key changes:
- Remove hero gradient card - use simple white card
- Consolidate KPIs into a compact grid
- Reduce section spacing
- Use consistent card styling

```tsx
// Hero section - simple and clean
<div className="rounded-2xl border border-zinc-200 bg-white p-6">
    <div className="text-sm text-zinc-500">Dashboard</div>
    <div className="mt-1 text-2xl font-semibold text-zinc-900">Selamat Pagi, Owner</div>
</div>

// KPI grid - compact 2x2
<div className="grid grid-cols-2 gap-3">
    <KpiCard label="Outstanding" value={kpis.total_unpaid} icon={<DollarSign />} />
    <KpiCard label="Outlet Bermasalah" value={kpis.outlets_unpaid} icon={<Store />} />
    <KpiCard label="Jatuh Tempo" value={kpis.due_this_week} icon={<Clock />} />
    <KpiCard label="Stok Kritis" value={criticalStock} icon={<AlertTriangle />} />
</div>
```

- [ ] **Step 3: Commit**

```bash
git add resources/js/pages/owner/dashboard.tsx
git commit -m "refactor: simplify owner dashboard layout with cleaner design"
```

---

### Task 2: Simplify KPI Card Component

**Files:**
- Modify: `resources/js/components/owner/owner-kpi-card.tsx`

- [ ] **Step 1: Read current component**

```bash
cat resources/js/components/owner/owner-kpi-card.tsx
```

- [ ] **Step 2: Simplify design**

Remove left border accent, use icon color for visual interest:

```tsx
export default function OwnerKpiCard({ label, value, icon, trend }: Props) {
    return (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100">
                    {icon}
                </div>
                <div className="text-xs font-medium text-zinc-500">{label}</div>
            </div>
            <div className="mt-3 text-2xl font-semibold tabular-nums text-zinc-900">
                {value}
            </div>
            {trend && (
                <div className="mt-1 text-xs text-zinc-400">{trend}</div>
            )}
        </div>
    );
}
```

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/owner/owner-kpi-card.tsx
git commit -m "refactor: simplify KPI card - remove left border, use icon for visual interest"
```

---

### Task 3: Unify Section Card Style

**Files:**
- Modify: `resources/js/components/ui/section-card.tsx`

- [ ] **Step 1: Read current component**

```bash
cat resources/js/components/ui/section-card.tsx
```

- [ ] **Step 2: Standardize to rounded-2xl**

```tsx
export default function SectionCard({ label, children, className }: Props) {
    return (
        <div className={`rounded-2xl border border-zinc-200 bg-white p-5 ${className ?? ''}`}>
            {label && (
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    {label}
                </div>
            )}
            {children}
        </div>
    );
}
```

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/ui/section-card.tsx
git commit -m "refactor: unify section card - use rounded-2xl and consistent padding"
```

---

### Task 4: Soften Action Card Colors

**Files:**
- Modify: `resources/js/components/owner/owner-action-card.tsx`

- [ ] **Step 1: Read current component**

```bash
cat resources/js/components/owner/owner-action-card.tsx
```

- [ ] **Step 2: Soften hover states**

```tsx
// Before: hover:border-emerald-200 hover:bg-emerald-50/40
// After: hover:bg-zinc-50

// Remove active:scale-[0.99] - feels cheap on desktop
```

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/owner/owner-action-card.tsx
git commit -m "refactor: soften action card hover states - use neutral tones"
```

---

### Task 5: Update Sidebar Colors

**Files:**
- Modify: `resources/js/layouts/owner-layout.tsx`
- Modify: `resources/js/components/owner/owner-sidebar-nav.tsx`

- [ ] **Step 1: Read current files**

- [ ] **Step 2: Soften sidebar colors**

```tsx
// Brand badge: bg-emerald-700 → keep (brand color)
// Active nav: bg-emerald-50 text-emerald-800 → bg-zinc-100 text-zinc-900
// Hover: hover:bg-emerald-50 → hover:bg-zinc-50
// Badge: bg-amber-100 → keep (status color)
```

- [ ] **Step 3: Commit**

```bash
git add resources/js/layouts/owner-layout.tsx resources/js/components/owner/owner-sidebar-nav.tsx
git commit -m "refactor: soften sidebar navigation colors - use neutral tones"
```

---

## Verification

After completing all tasks:

1. Run full test suite: `php artisan test`
2. Build frontend: `npm run build`
3. Visual verification:
   - Dashboard looks clean and sleek
   - Colors are natural and muted
   - Cards are consistent (rounded-2xl, p-5)
   - Hover states are subtle
   - Typography is consistent

## Summary

| Task | Description | Est. |
|------|-------------|------|
| 1 | Simplify dashboard layout | 1d |
| 2 | Simplify KPI card | 0.5d |
| 3 | Unify section card | 0.5d |
| 4 | Soften action card colors | 0.5d |
| 5 | Update sidebar colors | 0.5d |
| **Total** | | **3d** |
