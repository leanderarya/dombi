# Owner UI/UX Consistency Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify all 37 owner pages to use the same design tokens, spacing, components, and patterns established in customer/outlet/courier pages.

**Architecture:** Per-domain audit using Steve Jobs Design Review. Each batch fixes one domain (5-10 pages). Use Edit tool for targeted replacements — never sed batch replacements.

**Tech Stack:** React + TypeScript + Tailwind CSS + Inertia.js

## Global Constraints

- Use `text-text`, `text-text-muted`, `text-text-subtle` for text colors
- Use `border-border`, `border-border-strong` for borders
- Use `bg-surface`, `bg-surface-muted` for backgrounds
- Use `bg-primary`, `bg-primary-hover` for buttons/accents
- Keep `emerald-*` only for semantic meaning (success, positive trends)
- Use `rounded-xl border border-border bg-white p-4` for cards
- Use `StatusBadge` with `{status}` prop for status badges
- Use `EmptyState` component for empty states
- Use `OwnerPageShell` for all page layouts
- Use `ChevronLeft` for back buttons (not `ArrowLeft`)
- Spacing: `mb-4` (sections), `space-y-2` (lists), `space-y-4` (groups)
- Never use sed for batch replacements — use Edit tool per file

---

## Batch 1: Dasbor (1 page)

### Task 1.1: Audit dashboard.tsx

**Files:**
- Modify: `resources/js/pages/owner/dashboard.tsx`

**Goal:** Verify token usage, fix any hardcoded colors.

- [ ] **Step 1: Read dashboard.tsx and identify hardcoded values**

Read the file and list all hardcoded color values that need tokenization.

- [ ] **Step 2: Fix hardcoded colors**

Replace any `slate-*`, `zinc-*` with design tokens. Keep `emerald-*` for semantic icon backgrounds (success states).

- [ ] **Step 3: Verify spacing consistency**

Ensure `mb-4` for sections, `space-y-2` for lists, `mt-4` for header-to-content.

- [ ] **Step 4: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/owner/dashboard.tsx
git commit -m "refactor(owner): tokenize dashboard colors and spacing"
```

---

## Batch 2: Operasional (8 pages)

### Task 2.1: Convert orders/show.tsx to OwnerPageShell

**Files:**
- Modify: `resources/js/pages/owner/orders/show.tsx`

**Goal:** Replace `OwnerLayout` direct usage with `OwnerPageShell`.

- [ ] **Step 1: Read orders/show.tsx**

Read the file to understand current structure.

- [ ] **Step 2: Replace OwnerLayout with OwnerPageShell**

Change import from `OwnerLayout` to `OwnerPageShell`. Wrap content with `<OwnerPageShell title={order.order_code} subtitle="Detail pesanan" backHref="/owner/orders">`.

- [ ] **Step 3: Replace hardcoded colors**

Replace all `border-slate-200` → `border-border`, `text-slate-400` → `text-text-subtle`, `text-slate-500` → `text-text-muted`, `text-slate-600` → `text-text-muted`, `text-slate-900` → `text-text`, `bg-emerald-50` → `bg-primary-light`, `text-emerald-700` → `text-primary`, `border-emerald-200` → `border-primary/20`.

- [ ] **Step 4: Replace hardcoded button colors**

Replace `bg-emerald-700` → `bg-primary`, `text-white` stays.

- [ ] **Step 5: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/owner/orders/show.tsx
git commit -m "refactor(owner): tokenize orders/show, use OwnerPageShell"
```

### Task 2.2: Tokenize orders/index.tsx

**Files:**
- Modify: `resources/js/pages/owner/orders/index.tsx`

**Goal:** Replace hardcoded colors with tokens.

- [ ] **Step 1: Read orders/index.tsx**

- [ ] **Step 2: Replace hardcoded colors**

The file already uses `StatusBadge` and `DataTable`. Check for any `slate-*`, `zinc-*` hardcoded values and replace with tokens.

- [ ] **Step 3: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/orders/index.tsx
git commit -m "refactor(owner): tokenize orders/index colors"
```

### Task 2.3: Tokenize deliveries/index.tsx

**Files:**
- Modify: `resources/js/pages/owner/deliveries/index.tsx`

**Goal:** Replace hardcoded colors with tokens.

- [ ] **Step 1: Read deliveries/index.tsx**

- [ ] **Step 2: Replace hardcoded colors**

Replace `border-zinc-200` → `border-border`, `text-slate-400` → `text-text-subtle`, etc.

- [ ] **Step 3: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/deliveries/index.tsx
git commit -m "refactor(owner): tokenize deliveries/index colors"
```

### Task 2.4: Tokenize deliveries/show.tsx

**Files:**
- Modify: `resources/js/pages/owner/deliveries/show.tsx`

**Goal:** Replace hardcoded colors with tokens.

- [ ] **Step 1: Read deliveries/show.tsx**

- [ ] **Step 2: Replace hardcoded colors**

- [ ] **Step 3: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/deliveries/show.tsx
git commit -m "refactor(owner): tokenize deliveries/show colors"
```

### Task 2.5: Tokenize deliveries/board.tsx

**Files:**
- Modify: `resources/js/pages/owner/deliveries/board.tsx`

**Goal:** Replace hardcoded colors with tokens.

- [ ] **Step 1: Read deliveries/board.tsx**

- [ ] **Step 2: Replace hardcoded colors**

- [ ] **Step 3: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/deliveries/board.tsx
git commit -m "refactor(owner): tokenize deliveries/board colors"
```

### Task 2.6: Tokenize returns/index.tsx

**Files:**
- Modify: `resources/js/pages/owner/returns/index.tsx`

**Goal:** Replace hardcoded colors, standardize filter pattern.

- [ ] **Step 1: Read returns/index.tsx**

- [ ] **Step 2: Replace hardcoded colors**

Replace `border-zinc-100` → `border-border`, `text-zinc-500` → `text-text-muted`, `text-zinc-400` → `text-text-subtle`, `text-slate-900` → `text-text`, `bg-emerald-600` → `bg-primary`, `text-emerald-700` → `text-primary`.

- [ ] **Step 3: Replace manual select filters with Select component**

Replace raw `<select>` elements with the `Select` component from `@/components/ui/select`.

- [ ] **Step 4: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/owner/returns/index.tsx
git commit -m "refactor(owner): tokenize returns/index, use Select component"
```

### Task 2.7: Tokenize returns/show.tsx

**Files:**
- Modify: `resources/js/pages/owner/returns/show.tsx`

**Goal:** Replace hardcoded colors with tokens.

- [ ] **Step 1: Read returns/show.tsx**

- [ ] **Step 2: Replace hardcoded colors**

Replace `border-zinc-100` → `border-border`, `text-zinc-500` → `text-text-muted`, `bg-emerald-600` → `bg-primary`, `bg-red-600` → `bg-red-600` (keep — semantic danger).

- [ ] **Step 3: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/returns/show.tsx
git commit -m "refactor(owner): tokenize returns/show colors"
```

### Task 2.8: Tokenize exchanges/index.tsx

**Files:**
- Modify: `resources/js/pages/owner/exchanges/index.tsx`

**Goal:** Replace hardcoded colors, standardize filter pattern.

- [ ] **Step 1: Read exchanges/index.tsx**

- [ ] **Step 2: Replace hardcoded colors**

Same pattern as returns/index.tsx.

- [ ] **Step 3: Replace manual select filters with Select component**

- [ ] **Step 4: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/owner/exchanges/index.tsx
git commit -m "refactor(owner): tokenize exchanges/index, use Select component"
```

### Task 2.9: Tokenize exchanges/show.tsx

**Files:**
- Modify: `resources/js/pages/owner/exchanges/show.tsx`

**Goal:** Replace hardcoded colors with tokens.

- [ ] **Step 1: Read exchanges/show.tsx**

- [ ] **Step 2: Replace hardcoded colors**

- [ ] **Step 3: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/exchanges/show.tsx
git commit -m "refactor(owner): tokenize exchanges/show colors"
```

### Task 2.10: Batch 2 summary commit

- [ ] **Step 1: Verify all operasional pages build clean**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 2: Summary commit**

```bash
git add resources/js/pages/owner/orders/ resources/js/pages/owner/deliveries/ resources/js/pages/owner/returns/ resources/js/pages/owner/exchanges/
git commit -m "refactor(owner): batch 2 operasional pages — token consistency"
```

---

## Batch 3: Keuangan (4 pages)

### Task 3.1: Tokenize finance/index.tsx

**Files:**
- Modify: `resources/js/pages/owner/finance/index.tsx`

**Goal:** Replace hardcoded colors, fix sticky filter pattern.

- [ ] **Step 1: Read finance/index.tsx**

- [ ] **Step 2: Replace hardcoded colors**

Replace `border-slate-200` → `border-border`, `text-slate-400` → `text-text-subtle`, `text-slate-600` → `text-text-muted`, `text-slate-700` → `text-text`, `bg-white/80` → `bg-surface/80`.

- [ ] **Step 3: Fix sticky filter**

Replace `-mx-4` hack with proper container. Replace `border-slate-200` → `border-border`.

- [ ] **Step 4: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/owner/finance/index.tsx
git commit -m "refactor(owner): tokenize finance/index colors and filters"
```

### Task 3.2: Tokenize finance/outlet-detail.tsx

**Files:**
- Modify: `resources/js/pages/owner/finance/outlet-detail.tsx`

**Goal:** Replace hardcoded colors with tokens.

- [ ] **Step 1: Read finance/outlet-detail.tsx**

- [ ] **Step 2: Replace hardcoded colors**

- [ ] **Step 3: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/finance/outlet-detail.tsx
git commit -m "refactor(owner): tokenize finance/outlet-detail colors"
```

### Task 3.3: Tokenize settlement-payments.tsx

**Files:**
- Modify: `resources/js/pages/owner/settlement-payments.tsx`

**Goal:** Replace hardcoded colors, fix sticky filter.

- [ ] **Step 1: Read settlement-payments.tsx**

- [ ] **Step 2: Replace hardcoded colors**

Replace `border-slate-200` → `border-border`, `text-slate-600` → `text-text-muted`, `bg-emerald-600` → `bg-primary`, `bg-slate-100` → `bg-surface-muted`.

- [ ] **Step 3: Fix sticky filter pattern**

Same fix as finance/index.tsx.

- [ ] **Step 4: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/owner/settlement-payments.tsx
git commit -m "refactor(owner): tokenize settlement-payments colors and filters"
```

### Task 3.4: Tokenize payment-accounts.tsx

**Files:**
- Modify: `resources/js/pages/owner/payment-accounts.tsx`

**Goal:** Replace hardcoded colors with tokens.

- [ ] **Step 1: Read payment-accounts.tsx**

- [ ] **Step 2: Replace hardcoded colors**

Replace `border-zinc-200` → `border-border`, `text-zinc-500` → `text-text-muted`, `text-zinc-400` → `text-text-subtle`, `text-slate-900` → `text-text`, `bg-emerald-600` → `bg-primary`, `bg-zinc-100` → `bg-surface-muted`.

- [ ] **Step 3: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/payment-accounts.tsx
git commit -m "refactor(owner): tokenize payment-accounts colors"
```

---

## Batch 4: Master Data (10 pages)

### Task 4.1: Tokenize outlets/index.tsx

**Files:**
- Modify: `resources/js/pages/owner/outlets/index.tsx`

**Goal:** Replace hardcoded colors with tokens.

- [ ] **Step 1: Read outlets/index.tsx**

- [ ] **Step 2: Replace hardcoded colors**

Replace `text-slate-900` → `text-text`, `text-slate-500` → `text-text-muted`, `border-slate-200` → `border-border`, `bg-[#F8FAFC]` → `bg-surface-muted`.

- [ ] **Step 3: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/outlets/index.tsx
git commit -m "refactor(owner): tokenize outlets/index colors"
```

### Task 4.2: Tokenize outlets/show.tsx

**Files:**
- Modify: `resources/js/pages/owner/outlets/show.tsx`

**Goal:** Replace hardcoded colors, remove shadow-sm.

- [ ] **Step 1: Read outlets/show.tsx**

- [ ] **Step 2: Replace hardcoded colors**

Replace `border-slate-200` → `border-border`, `text-slate-900` → `text-text`, `text-slate-500` → `text-text-muted`, `bg-[#F8FAFC]` → `bg-surface-muted`, `shadow-sm` → remove (use border only).

- [ ] **Step 3: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/outlets/show.tsx
git commit -m "refactor(owner): tokenize outlets/show colors"
```

### Task 4.3: Tokenize outlets/create.tsx and edit.tsx

**Files:**
- Modify: `resources/js/pages/owner/outlets/create.tsx`
- Modify: `resources/js/pages/owner/outlets/edit.tsx`

**Goal:** Replace hardcoded colors with tokens.

- [ ] **Step 1: Read both files**

- [ ] **Step 2: Replace hardcoded colors**

- [ ] **Step 3: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/outlets/create.tsx resources/js/pages/owner/outlets/edit.tsx
git commit -m "refactor(owner): tokenize outlets/create and edit colors"
```

### Task 4.4: Tokenize product-families/index.tsx

**Files:**
- Modify: `resources/js/pages/owner/product-families/index.tsx`

**Goal:** Replace hardcoded colors with tokens.

- [ ] **Step 1: Read product-families/index.tsx**

- [ ] **Step 2: Replace hardcoded colors**

Replace `border-zinc-200` → `border-border`, `text-zinc-500` → `text-text-muted`, `text-zinc-400` → `text-text-subtle`, `text-slate-900` → `text-text`, `bg-emerald-600` → `bg-primary`, `bg-zinc-100` → `bg-surface-muted`.

- [ ] **Step 3: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/product-families/index.tsx
git commit -m "refactor(owner): tokenize product-families/index colors"
```

### Task 4.5: Tokenize product-families/show.tsx

**Files:**
- Modify: `resources/js/pages/owner/product-families/show.tsx`

**Goal:** Replace hardcoded colors with tokens.

- [ ] **Step 1: Read product-families/show.tsx**

- [ ] **Step 2: Replace hardcoded colors**

- [ ] **Step 3: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/product-families/show.tsx
git commit -m "refactor(owner): tokenize product-families/show colors"
```

### Task 4.6: Tokenize pricing/index.tsx

**Files:**
- Modify: `resources/js/pages/owner/pricing/index.tsx`

**Goal:** Replace hardcoded colors with tokens.

- [ ] **Step 1: Read pricing/index.tsx**

- [ ] **Step 2: Replace hardcoded colors**

Replace `border-slate-200` → `border-border`, `text-slate-900` → `text-text`, `text-slate-500` → `text-text-muted`, `text-slate-300` → `text-text-subtle`.

- [ ] **Step 3: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/pricing/index.tsx
git commit -m "refactor(owner): tokenize pricing/index colors"
```

### Task 4.7: Tokenize pricing/master.tsx, outlet.tsx, history.tsx

**Files:**
- Modify: `resources/js/pages/owner/pricing/master.tsx`
- Modify: `resources/js/pages/owner/pricing/outlet.tsx`
- Modify: `resources/js/pages/owner/pricing/history.tsx`

**Goal:** Replace hardcoded colors with tokens.

- [ ] **Step 1: Read all three files**

- [ ] **Step 2: Replace hardcoded colors**

- [ ] **Step 3: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/pricing/
git commit -m "refactor(owner): tokenize pricing pages colors"
```

---

## Batch 5: Persediaan (7 pages)

### Task 5.1: Tokenize inventories/index.tsx

**Files:**
- Modify: `resources/js/pages/owner/inventories/index.tsx`

**Goal:** Replace hardcoded colors with tokens.

- [ ] **Step 1: Read inventories/index.tsx**

- [ ] **Step 2: Replace hardcoded colors**

Replace `text-slate-600` → `text-text-muted`, `text-slate-400` → `text-text-subtle`.

- [ ] **Step 3: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/inventories/index.tsx
git commit -m "refactor(owner): tokenize inventories/index colors"
```

### Task 5.2: Tokenize inventories/create.tsx and edit.tsx

**Files:**
- Modify: `resources/js/pages/owner/inventories/create.tsx`
- Modify: `resources/js/pages/owner/inventories/edit.tsx`

**Goal:** Replace hardcoded colors with tokens.

- [ ] **Step 1: Read both files**

- [ ] **Step 2: Replace hardcoded colors**

- [ ] **Step 3: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/inventories/create.tsx resources/js/pages/owner/inventories/edit.tsx
git commit -m "refactor(owner): tokenize inventories/create and edit colors"
```

### Task 5.3: Convert restocks/index.tsx to use StatusBadge

**Files:**
- Modify: `resources/js/pages/owner/restocks/index.tsx`

**Goal:** Replace manual `statusStyles` map with `StatusBadge` component.

**Note:** `StatusBadge` resolves `requested` → `RESTOCK_STATUSES.requested` (correct). Shared keys like `preparing`, `shipped`, `completed` resolve via ORDER_STATUSES precedence, but labels are identical. If labels ever diverge, use explicit `{variant, children}` props instead.

- [ ] **Step 1: Read restocks/index.tsx**

- [ ] **Step 2: Replace manual status badge with StatusBadge**

Remove `statusStyles` map. Import `StatusBadge`. Replace `<span className={statusStyles[r.status]}>` with `<StatusBadge status={r.status} />`.

- [ ] **Step 3: Replace hardcoded colors**

Replace `border-slate-200` → `border-border`, `text-slate-900` → `text-text`, `text-slate-500` → `text-text-muted`.

- [ ] **Step 4: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/owner/restocks/index.tsx
git commit -m "refactor(owner): restocks/index use StatusBadge, tokenize colors"
```

### Task 5.4: Tokenize restocks/show.tsx

**Files:**
- Modify: `resources/js/pages/owner/restocks/show.tsx`

**Goal:** Replace hardcoded colors, remove shadow-sm.

- [ ] **Step 1: Read restocks/show.tsx**

- [ ] **Step 2: Replace hardcoded colors**

Replace `border-slate-200` → `border-border`, `text-slate-950` → `text-text`, `text-slate-500` → `text-text-muted`, `shadow-sm` → remove.

- [ ] **Step 3: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/restocks/show.tsx
git commit -m "refactor(owner): tokenize restocks/show colors"
```

### Task 5.5: Convert distributions/index.tsx to use StatusBadge

**Files:**
- Modify: `resources/js/pages/owner/distributions/index.tsx`

**Goal:** Replace manual `statusStyles` map with `StatusBadge`.

**Note:** Same merge precedence issue as restocks. `preparing`, `shipped`, `completed` resolve via ORDER_STATUSES but labels are identical.

- [ ] **Step 1: Read distributions/index.tsx**

- [ ] **Step 2: Replace manual status badge with StatusBadge**

Remove `statusStyles` map. Import `StatusBadge`. Replace `<span className={statusStyles[d.status]}>` with `<StatusBadge status={d.status} />`.

- [ ] **Step 3: Replace hardcoded colors**

- [ ] **Step 4: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/owner/distributions/index.tsx
git commit -m "refactor(owner): distributions/index use StatusBadge, tokenize colors"
```

### Task 5.6: Tokenize distributions/show.tsx

**Files:**
- Modify: `resources/js/pages/owner/distributions/show.tsx`

**Goal:** Replace hardcoded colors with tokens.

- [ ] **Step 1: Read distributions/show.tsx**

- [ ] **Step 2: Replace hardcoded colors**

- [ ] **Step 3: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/distributions/show.tsx
git commit -m "refactor(owner): tokenize distributions/show colors"
```

---

## Batch 6: Analitik (6 pages)

### Task 6.1: Tokenize analytics/index.tsx

**Files:**
- Modify: `resources/js/pages/owner/analytics/index.tsx`

**Goal:** Replace hardcoded colors with tokens.

- [ ] **Step 1: Read analytics/index.tsx**

- [ ] **Step 2: Replace hardcoded colors**

Replace `border-zinc-200` → `border-border`, `text-zinc-500` → `text-text-muted`, `text-slate-500` → `text-text-muted`, `text-slate-900` → `text-text`, `bg-emerald-600` → `bg-primary`, `bg-zinc-100` → `bg-surface-muted`.

- [ ] **Step 3: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/analytics/index.tsx
git commit -m "refactor(owner): tokenize analytics/index colors"
```

### Task 6.2: Tokenize reports/index.tsx

**Files:**
- Modify: `resources/js/pages/owner/reports/index.tsx`

**Goal:** Replace hardcoded colors with tokens.

- [ ] **Step 1: Read reports/index.tsx**

- [ ] **Step 2: Replace hardcoded colors**

Replace `border-slate-200` → `border-border`, `text-slate-400` → `text-text-subtle`, `text-slate-600` → `text-text-muted`, `text-slate-900` → `text-text`, `bg-emerald-600` → `bg-primary`, `bg-emerald-50` → `bg-primary-light`, `text-emerald-800` → `text-primary`.

- [ ] **Step 3: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/reports/index.tsx
git commit -m "refactor(owner): tokenize reports/index colors"
```

### Task 6.3: Tokenize stock-movements/index.tsx

**Files:**
- Modify: `resources/js/pages/owner/stock-movements/index.tsx`

**Goal:** Replace hardcoded colors with tokens.

- [ ] **Step 1: Read stock-movements/index.tsx**

- [ ] **Step 2: Replace hardcoded colors**

Replace `border-slate-200` → `border-border`, `text-slate-900` → `text-text`, `text-slate-400` → `text-text-subtle`, `text-slate-500` → `text-text-muted`.

- [ ] **Step 3: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/stock-movements/index.tsx
git commit -m "refactor(owner): tokenize stock-movements/index colors"
```

### Task 6.4: Convert order-reports/index.tsx to OwnerPageShell

**Files:**
- Modify: `resources/js/pages/owner/order-reports/index.tsx`

**Goal:** Convert from `OwnerLayout` direct to `OwnerPageShell` (or keep `OwnerLayout` with `FilterChips` if that's the pattern for filter-below-header pages).

- [ ] **Step 1: Read order-reports/index.tsx**

- [ ] **Step 2: Decide layout pattern**

This page uses `OwnerLayout` with `headerBelow` for `FilterChips`. This is consistent with the customer pattern. Keep as-is but verify tokens are correct.

- [ ] **Step 3: Verify tokens are correct**

The file already uses `text-text`, `border-border`, `bg-white` ✓. Verify no hardcoded colors remain.

- [ ] **Step 4: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/owner/order-reports/index.tsx
git commit -m "refactor(owner): verify order-reports/index tokens"
```

### Task 6.5: Tokenize order-reports/show.tsx

**Files:**
- Modify: `resources/js/pages/owner/order-reports/show.tsx`

**Goal:** Replace hardcoded colors with tokens.

- [ ] **Step 1: Read order-reports/show.tsx**

- [ ] **Step 2: Replace hardcoded colors**

- [ ] **Step 3: Build verify**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/order-reports/show.tsx
git commit -m "refactor(owner): tokenize order-reports/show colors"
```

---

## Final Verification

### Task 7.1: Full build verify

- [ ] **Step 1: Run full build**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -10
```

Expected: No TypeScript errors.

- [ ] **Step 2: Run Steve Jobs Design Review on key pages**

Review dashboard, orders/index, finance/index, outlets/show for consistency.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "refactor(owner): complete UI/UX consistency audit across all 37 pages"
```
