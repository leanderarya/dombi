# Customer Pages iOS HIG Consistency Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize all customer-facing pages to follow iOS HIG consistently — one back button pattern, one section container, one text color system, one label style, one active state pattern.

**Architecture:** Extract shared components (StepHeader, StepButton) from duplicated code. Replace all raw `text-slate-*`/`text-zinc-*` with semantic design tokens (`text-text`, `text-text-muted`, `text-text-subtle`). Replace all raw `<section>` containers with `<SectionCard>`. Standardize back button to SVG chevron.

**Tech Stack:** React 19, Inertia.js, TailwindCSS v4

---

## Inconsistency Summary (from audit)

| Pattern | Severity | Canonical | Deviations |
|---------|----------|-----------|------------|
| Back button icon | HIGH | SVG chevron (`M15 19l-7-7 7-7`) | 3 implementations: inline SVG, `‹` char, Lucide ArrowLeft |
| Section containers | HIGH | `<SectionCard>` | 2/9 pages use it; 7 use raw sections with 5+ border colors |
| Text colors | HIGH | `text-text`, `text-text-muted`, `text-text-subtle` | 4 pages use `slate-*`, 1 uses `zinc-*`, 2 mix both |
| StepHeader/StepButton | HIGH | Shared component | Copy-pasted 3 times with diverging code |
| Sticky footer | MEDIUM | `border-t border-border` | 3 use border, 1 uses shadow |
| Label style | MEDIUM | `text-[13px] text-text-subtle` | 3 sizes: `[11px]`, `xs`, `[13px]` |
| Active states | MEDIUM | `active:opacity-80` | 4+ patterns: opacity, bg-zinc, bg-emerald, text-emerald |
| Touch targets | LOW | 44pt minimum | Hero dots (home) are 8px |

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `resources/js/components/customer/step-header.tsx` | Shared checkout step header |
| `resources/js/components/customer/step-button.tsx` | Shared checkout sticky footer button |

### Modified Files
| File | Changes |
|------|---------|
| `resources/js/pages/customer/product-detail.tsx` | Back button, text colors, labels, active states |
| `resources/js/pages/customer/checkout/index.tsx` | Extract StepHeader/StepButton, text colors |
| `resources/js/pages/customer/checkout/customer.tsx` | Extract StepHeader/StepButton, text colors |
| `resources/js/pages/customer/checkout/payment.tsx` | Extract StepHeader/StepButton, back button, text colors, shadow |
| `resources/js/pages/customer/orders/index.tsx` | Back button, text colors, labels, active states |
| `resources/js/pages/customer/orders/show.tsx` | Back button, text colors, labels, active states |
| `resources/js/pages/customer/profile.tsx` | Text colors, labels |

---

### Task 1: Extract shared StepHeader component

**Files:**
- Create: `resources/js/components/customer/step-header.tsx`

- [ ] **Step 1: Create the shared component**

```tsx
import { router } from '@inertiajs/react';

interface Props {
    title: string;
    step: string;
    backHref: string;
}

export default function StepHeader({ title, step, backHref }: Props) {
    return (
        <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur px-4 py-3">
            <div className="mx-auto flex max-w-lg items-center justify-between">
                <button
                    type="button"
                    onClick={() => router.visit(backHref)}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-text active:opacity-80"
                    aria-label="Kembali"
                >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="text-center">
                    <h1 className="text-base font-semibold text-text">{title}</h1>
                    <p className="text-[13px] text-text-subtle">{step}</p>
                </div>
                <div className="h-11 w-11" />
            </div>
        </header>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/components/customer/step-header.tsx
git commit -m "feat: extract shared StepHeader component for checkout pages"
```

---

### Task 2: Extract shared StepButton component

**Files:**
- Create: `resources/js/components/customer/step-button.tsx`

- [ ] **Step 1: Create the shared component**

```tsx
interface Props {
    label: string;
    disabled: boolean;
    processing: boolean;
    onClick: () => void;
}

export default function StepButton({ label, disabled, processing, onClick }: Props) {
    return (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
            <div className="mx-auto max-w-lg">
                <button
                    type="button"
                    onClick={onClick}
                    disabled={disabled}
                    className="flex min-h-14 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-white active:opacity-80 disabled:bg-surface-muted disabled:text-text-subtle"
                >
                    {processing ? 'Memproses...' : label}
                </button>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/components/customer/step-button.tsx
git commit -m "feat: extract shared StepButton component for checkout pages"
```

---

### Task 3: Standardize checkout/index.tsx

**Files:**
- Modify: `resources/js/pages/customer/checkout/index.tsx`

- [ ] **Step 1: Import shared components**

Add imports:
```tsx
import StepHeader from '@/components/customer/step-header';
import StepButton from '@/components/customer/step-button';
```

- [ ] **Step 2: Remove local StepHeader and StepButton functions**

Delete the local `StepHeader` function (lines 231-246) and `StepButton` function (lines 248-263).

- [ ] **Step 3: Replace `‹` character in any remaining back button**

Already done in previous refactor — verify SVG chevron is used.

- [ ] **Step 4: Replace raw `text-slate-*` with design tokens**

Replace all instances:
- `text-slate-900` → `text-text`
- `text-slate-500` → `text-text-muted`
- `text-slate-700` → `text-text`
- `text-zinc-700` → `text-text`

- [ ] **Step 5: Replace raw `<section>` with SectionCard**

The items section already uses SectionCard. Verify no raw sections remain.

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/customer/checkout/index.tsx
git commit -m "refactor: checkout/index.tsx — shared StepHeader/StepButton, design tokens"
```

---

### Task 4: Standardize checkout/customer.tsx

**Files:**
- Modify: `resources/js/pages/customer/checkout/customer.tsx`

- [ ] **Step 1: Import shared components**

Add imports:
```tsx
import StepHeader from '@/components/customer/step-header';
import StepButton from '@/components/customer/step-button';
```

- [ ] **Step 2: Remove local StepHeader and StepButton functions**

Delete the local `StepHeader` function (lines 317-332) and `StepButton` function (lines 334-349).

- [ ] **Step 3: Replace raw `text-slate-*` with design tokens**

Replace all instances:
- `text-slate-900` → `text-text`
- `text-slate-500` → `text-text-muted`
- `text-slate-600` → `text-text-muted`
- `text-slate-700` → `text-text`
- `text-slate-400` → `text-text-subtle`

- [ ] **Step 4: Replace raw `<section>` with SectionCard**

Already partially done. Verify all sections use SectionCard.

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/customer/checkout/customer.tsx
git commit -m "refactor: checkout/customer.tsx — shared components, design tokens"
```

---

### Task 5: Standardize checkout/payment.tsx

**Files:**
- Modify: `resources/js/pages/customer/checkout/payment.tsx`

- [ ] **Step 1: Import shared components**

Add imports:
```tsx
import StepHeader from '@/components/customer/step-header';
import StepButton from '@/components/customer/step-button';
```

- [ ] **Step 2: Remove local StepHeader and StepButton functions**

Delete the local `StepHeader` function and `StepButton` function.

- [ ] **Step 3: Replace `‹` character with SVG chevron**

The StepHeader now handles this — just use the shared component.

- [ ] **Step 4: Replace raw `text-slate-*` with design tokens**

Replace all instances:
- `text-slate-900` → `text-text`
- `text-slate-500` → `text-text-muted`
- `text-slate-600` → `text-text-muted`
- `text-slate-700` → `text-text`
- `text-slate-400` → `text-text-subtle`

- [ ] **Step 5: Replace shadow footer with border**

The StepButton now handles this — just use the shared component.

- [ ] **Step 6: Add spacer for sticky footer**

Add `<div className="h-24" />` before `</CustomerMobileLayout>`.

- [ ] **Step 7: Commit**

```bash
git add resources/js/pages/customer/checkout/payment.tsx
git commit -m "refactor: checkout/payment.tsx — shared components, design tokens, spacer"
```

---

### Task 6: Standardize product-detail.tsx

**Files:**
- Modify: `resources/js/pages/customer/product-detail.tsx`

- [ ] **Step 1: Replace back button color and active state**

Find the back button and update:
```tsx
// BEFORE
className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 active:bg-zinc-100"

// AFTER
className="flex h-11 w-11 items-center justify-center rounded-lg text-text active:opacity-80"
```

- [ ] **Step 2: Replace raw `text-slate-*` with design tokens**

Replace all instances:
- `text-slate-900` → `text-text`
- `text-zinc-500` → `text-text-muted`
- `text-zinc-600` → `text-text-muted`
- `text-slate-400` → `text-text-subtle`
- `text-zinc-400` → `text-text-subtle`

- [ ] **Step 3: Replace `active:bg-zinc-50` with `active:opacity-80`**

Replace all instances of `active:bg-zinc-50` and `active:bg-zinc-100`.

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/customer/product-detail.tsx
git commit -m "refactor: product-detail.tsx — back button, design tokens, active states"
```

---

### Task 7: Standardize orders/index.tsx

**Files:**
- Modify: `resources/js/pages/customer/orders/index.tsx`

- [ ] **Step 1: Replace Lucide ArrowLeft with SVG chevron**

Find the back button and replace:
```tsx
// BEFORE
import { ArrowLeft } from 'lucide-react';
...
<ArrowLeft className="h-5 w-5" />

// AFTER
<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
</svg>
```

- [ ] **Step 2: Replace back button active state**

```tsx
// BEFORE
className="... active:bg-zinc-100"

// AFTER
className="... active:opacity-80"
```

- [ ] **Step 3: Replace raw `text-slate-*` with design tokens**

Replace all instances:
- `text-slate-900` → `text-text`
- `text-slate-500` → `text-text-muted`
- `text-slate-400` → `text-text-subtle`

- [ ] **Step 4: Replace label style**

```tsx
// BEFORE
className="text-[11px] font-bold uppercase tracking-wider text-slate-400"

// AFTER
className="text-[13px] text-text-subtle"
```

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/customer/orders/index.tsx
git commit -m "refactor: orders/index.tsx — back button, design tokens, label style"
```

---

### Task 8: Standardize orders/show.tsx

**Files:**
- Modify: `resources/js/pages/customer/orders/show.tsx`

- [ ] **Step 1: Replace Lucide ArrowLeft with SVG chevron**

Same as Task 7.

- [ ] **Step 2: Replace back button active state**

Same as Task 7.

- [ ] **Step 3: Replace raw `text-slate-*` with design tokens**

Replace all instances:
- `text-slate-900` → `text-text`
- `text-slate-500` → `text-text-muted`
- `text-slate-600` → `text-text-muted`
- `text-slate-400` → `text-text-subtle`
- `text-zinc-200` → `border-border`

- [ ] **Step 4: Replace label style**

Same as Task 7.

- [ ] **Step 5: Replace `active:bg-slate-50` with `active:opacity-80`**

Replace all active:bg-* patterns with `active:opacity-80`.

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/customer/orders/show.tsx
git commit -m "refactor: orders/show.tsx — back button, design tokens, label style, active states"
```

---

### Task 9: Standardize profile.tsx

**Files:**
- Modify: `resources/js/pages/customer/profile.tsx`

- [ ] **Step 1: Replace raw `text-zinc-*` with design tokens**

Replace all instances:
- `text-zinc-900` → `text-text`
- `text-zinc-500` → `text-text-muted`
- `text-zinc-600` → `text-text-muted`
- `text-zinc-400` → `text-text-subtle`

- [ ] **Step 2: Replace label style**

```tsx
// BEFORE
className="text-xs font-bold uppercase tracking-wider text-zinc-400"

// AFTER
className="text-[13px] text-text-subtle"
```

- [ ] **Step 3: Replace `active:bg-zinc-50` with `active:opacity-80`**

Replace all active:bg-* patterns.

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/customer/profile.tsx
git commit -m "refactor: profile.tsx — design tokens, label style, active states"
```

---

### Task 10: Full verification

- [ ] **Step 1: Run PHP tests**

```bash
php artisan test
```
Expected: All tests PASS.

- [ ] **Step 2: Run TypeScript check**

```bash
npm run types:check
```
Expected: No new errors.

- [ ] **Step 3: Run lint**

```bash
npm run lint:check
```
Expected: No new errors.

- [ ] **Step 4: Run build**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 5: Commit if needed**

```bash
git add -A
git commit -m "fix: address lint/type issues from customer pages HIG consistency"
```

---

## Design Token Reference

| Token | Value | Usage |
|-------|-------|-------|
| `text-text` | Primary text | Headings, values, labels |
| `text-text-muted` | Secondary text | Descriptions, metadata |
| `text-text-subtle` | Tertiary text | Section labels, timestamps |
| `border-border` | Standard border | Cards, separators |
| `bg-surface` | Card background | Cards, sections |
| `bg-surface-muted` | Subtle background | Disabled states |
| `bg-primary` | Primary action | CTA buttons |
| `active:opacity-80` | Press feedback | All interactive elements |

## Active State Rules

| Element Type | Active State |
|-------------|-------------|
| Cards / List rows | `active:opacity-80` |
| Primary buttons | `active:opacity-80` |
| Secondary buttons | `active:opacity-80` |
| Icon buttons | `active:opacity-80` |
| Links | `active:opacity-80` |

**No exceptions.** All interactive elements use `active:opacity-80`.
