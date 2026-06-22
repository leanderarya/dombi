# Checkout Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the visual design of the Dombi checkout flow to feel like a modern consumer app without changing the 3-step structure.

**Architecture:** Redesign the shared StepHeader component to include a visual progress indicator. Polish the cart, customer info, and payment pages with consistent spacing, typography, and premium styling.

**Tech Stack:** React 19, Inertia.js, TailwindCSS v4, Lucide React

---

## File Map

### Files to Modify
| File | Responsibility |
|------|---------------|
| `resources/js/components/customer/step-header.tsx` | Add visual progress indicator |
| `resources/js/components/customer/step-button.tsx` | Premium gradient style |
| `resources/js/pages/customer/checkout/index.tsx` | Cart page visual polish |
| `resources/js/pages/customer/checkout/customer.tsx` | Customer info visual polish |
| `resources/js/pages/customer/checkout/payment.tsx` | Payment page visual polish |

---

### Task 1: Redesign StepHeader with Progress Indicator

**Files:**
- Modify: `resources/js/components/customer/step-header.tsx`

- [ ] **Step 1: Read the current StepHeader**

Read `resources/js/components/customer/step-header.tsx` to understand the current implementation.

- [ ] **Step 2: Replace with progress indicator design**

```tsx
import { router } from '@inertiajs/react';
import { Check } from 'lucide-react';

interface StepConfig {
    label: string;
}

interface Props {
    title: string;
    currentStep: number;
    steps: StepConfig[];
    backHref: string;
}

export default function StepHeader({ title, currentStep, steps, backHref }: Props) {
    return (
        <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
            <div className="mx-auto max-w-lg px-4 py-3">
                {/* Top row: back button + title */}
                <div className="flex items-center justify-between mb-3">
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
                    <h1 className="text-base font-semibold text-text">{title}</h1>
                    <div className="h-11 w-11" />
                </div>

                {/* Progress indicator */}
                <div className="flex items-center justify-center gap-1">
                    {steps.map((step, index) => {
                        const isCompleted = index < currentStep;
                        const isCurrent = index === currentStep;
                        const isFuture = index > currentStep;

                        return (
                            <div key={step.label} className="flex items-center">
                                {/* Step circle */}
                                <div className="flex flex-col items-center">
                                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                                        isCompleted
                                            ? 'bg-emerald-600 text-white'
                                            : isCurrent
                                                ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-600'
                                                : 'bg-zinc-100 text-zinc-400'
                                    }`}>
                                        {isCompleted ? (
                                            <Check className="h-3.5 w-3.5" />
                                        ) : (
                                            index + 1
                                        )}
                                    </div>
                                    <span className={`mt-1 text-[10px] font-medium ${
                                        isCurrent ? 'text-emerald-700' : isCompleted ? 'text-text' : 'text-text-subtle'
                                    }`}>
                                        {step.label}
                                    </span>
                                </div>

                                {/* Connector line */}
                                {index < steps.length - 1 && (
                                    <div className={`mx-1 h-0.5 w-8 rounded-full mb-4 ${
                                        isCompleted ? 'bg-emerald-600' : 'bg-zinc-200'
                                    }`} />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </header>
    );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run types:check`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add resources/js/components/customer/step-header.tsx
git commit -m "feat: redesign StepHeader with visual progress indicator"
```

---

### Task 2: Update Checkout Pages to Use New StepHeader

**Files:**
- Modify: `resources/js/pages/customer/checkout/index.tsx`
- Modify: `resources/js/pages/customer/checkout/customer.tsx`
- Modify: `resources/js/pages/customer/checkout/payment.tsx`

- [ ] **Step 1: Update checkout/index.tsx**

Find the StepHeader usage and update the props:

```tsx
// BEFORE
<StepHeader title="Checkout" step="1 dari 3" backHref="/customer/products" />

// AFTER
<StepHeader
    title="Checkout"
    currentStep={0}
    steps={[
        { label: 'Keranjang' },
        { label: 'Info' },
        { label: 'Bayar' },
    ]}
    backHref="/customer/products"
/>
```

- [ ] **Step 2: Update checkout/customer.tsx**

Find the StepHeader usage and update:

```tsx
// BEFORE
<StepHeader title="Customer & Delivery" step="2 dari 3" backHref="/customer/checkout" />

// AFTER
<StepHeader
    title="Informasi"
    currentStep={1}
    steps={[
        { label: 'Keranjang' },
        { label: 'Info' },
        { label: 'Bayar' },
    ]}
    backHref="/customer/checkout"
/>
```

- [ ] **Step 3: Update checkout/payment.tsx**

Find the StepHeader usage and update:

```tsx
// BEFORE
<StepHeader title="Pembayaran" step="3 dari 3" backHref="/customer/checkout/customer" />

// AFTER
<StepHeader
    title="Pembayaran"
    currentStep={2}
    steps={[
        { label: 'Keranjang' },
        { label: 'Info' },
        { label: 'Bayar' },
    ]}
    backHref="/customer/checkout/customer"
/>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npm run types:check`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/customer/checkout/
git commit -m "feat: update checkout pages to use visual progress indicator"
```

---

### Task 3: Polish Cart Page Visual Design

**Files:**
- Modify: `resources/js/pages/customer/checkout/index.tsx`

- [ ] **Step 1: Update item cards styling**

Find the `CheckoutItemCard` usage and update the container:

```tsx
// BEFORE
<SectionCard label="Pesanan" className="mt-5">

// AFTER
<div className="mt-5 rounded-2xl bg-white p-4">
    <h2 className="text-[13px] font-semibold text-text-subtle mb-3">Pesanan</h2>
```

Close with `</div>` instead of `</SectionCard>`.

- [ ] **Step 2: Update subtotal display**

Find the subtotal section and make it more prominent:

```tsx
// BEFORE
<span className="text-xl font-bold tabular-nums text-text">{formatCurrency(subtotal)}</span>

// AFTER
<span className="text-2xl font-bold tabular-nums text-text">{formatCurrency(subtotal)}</span>
```

- [ ] **Step 3: Update fulfillment cards**

Find the `FulfillmentCard` component and update styling:

```tsx
// BEFORE
className={`min-h-[88px] w-full rounded-xl border p-4 text-left transition-all active:opacity-80 ${
    active ? 'border-emerald-500 bg-emerald-50' : 'border-border bg-white'
}`}

// AFTER
className={`min-h-[88px] w-full rounded-2xl p-4 text-left transition-all active:opacity-80 ${
    active
        ? 'bg-emerald-50 ring-2 ring-emerald-500'
        : 'bg-white border border-border'
}`}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npm run types:check`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/customer/checkout/index.tsx
git commit -m "refactor: cart page visual polish — premium card styling"
```

---

### Task 4: Polish Payment Page Visual Design

**Files:**
- Modify: `resources/js/pages/customer/checkout/payment.tsx`

- [ ] **Step 1: Update total card styling**

Find the total card section and make it more premium:

```tsx
// BEFORE
<section className="mt-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">

// AFTER
<section className="mt-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-500 p-5 text-white">
```

Update the text colors inside to white:

```tsx
// BEFORE
<div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">

// AFTER
<div className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">
```

```tsx
// BEFORE
<span className="text-sm font-semibold text-emerald-900">Total</span>
<span className="text-xl font-bold tabular-nums text-emerald-900">{formatCurrency(total)}</span>

// AFTER
<span className="text-sm font-semibold text-white">Total</span>
<span className="text-2xl font-bold tabular-nums text-white">{formatCurrency(total)}</span>
```

- [ ] **Step 2: Update payment options styling**

Find the payment options and update the selected state:

```tsx
// BEFORE
className={`flex min-h-[68px] w-full items-center justify-between rounded-xl border px-4 text-left transition-all active:opacity-80 ${
    form.data.payment_method === option.value ? 'border-emerald-500 bg-emerald-50' : 'border-border bg-white'
}`}

// AFTER
className={`flex min-h-[68px] w-full items-center justify-between rounded-2xl px-4 text-left transition-all active:opacity-80 ${
    form.data.payment_method === option.value
        ? 'bg-emerald-50 ring-2 ring-emerald-500'
        : 'bg-white border border-border'
}`}
```

- [ ] **Step 3: Update CTA button**

Find the StepButton and update to show total prominently:

```tsx
// The CTA label is already built by buildCtaLabel function
// Just ensure the button style is updated in step-button.tsx
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npm run types:check`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/customer/checkout/payment.tsx
git commit -m "refactor: payment page visual polish — premium total card"
```

---

### Task 5: Polish StepButton Component

**Files:**
- Modify: `resources/js/components/customer/step-button.tsx`

- [ ] **Step 1: Update button styling**

```tsx
// BEFORE
className="flex min-h-14 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-white active:opacity-80 disabled:bg-surface-muted disabled:text-text-subtle"

// AFTER
className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 active:opacity-80 disabled:from-zinc-300 disabled:to-zinc-300 disabled:shadow-none disabled:text-zinc-500"
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run types:check`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/customer/step-button.tsx
git commit -m "refactor: StepButton premium gradient style"
```

---

### Task 6: Full Verification

- [ ] **Step 1: Run PHP tests**

Run: `php artisan test`
Expected: All tests PASS.

- [ ] **Step 2: Run TypeScript check**

Run: `npm run types:check`
Expected: No new errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint:check`
Expected: No new errors.

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit if needed**

```bash
git add -A
git commit -m "fix: address lint/type issues from checkout visual polish"
```
