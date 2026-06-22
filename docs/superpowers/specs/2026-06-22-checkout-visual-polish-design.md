# Checkout Visual Polish — Design Spec

**Date:** 2026-06-22
**Status:** Approved
**Approach:** Visual Polish (no flow changes)

## Overview

Improve the visual design of the Dombi checkout flow to feel like a modern consumer app (Fore Coffee, Grab, Starbucks) without changing the 3-step structure.

## Design Principles

1. **Premium feel** — subtle animations, proper spacing, clean typography
2. **Clear hierarchy** — most important info stands out
3. **Confidence building** — trust signals, clear pricing breakdown
4. **iOS-native patterns** — follow HIG guidelines

## Components to Redesign

### 1. Progress Indicator

**Before:** Text "1 dari 3"
**After:** Visual progress bar

```
[●]─────[○]─────[○]
Keranjang  Info    Bayar
```

- Active step: filled circle (emerald-600) + bold label
- Completed step: filled circle + checkmark
- Future step: empty circle + muted label
- Line: filled if completed, muted if future

### 2. StepHeader Component

**Current:** Simple text header
**New:** Progress indicator + back button

```tsx
<header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-border">
  <div className="flex items-center justify-between px-4 py-3">
    <BackButton />
    <ProgressIndicator current={1} total={3} labels={['Keranjang', 'Info', 'Bayar']} />
    <div className="w-11" /> {/* spacer */}
  </div>
</header>
```

### 3. Cart Page (Step 1)

**Changes:**
- Item cards: `rounded-xl bg-white` (no border)
- Quantity stepper: larger buttons (44px touch target)
- Subtotal: `text-xl font-bold` (more prominent)
- Section spacing: `mb-6` between groups

### 4. Customer Info Page (Step 2)

**Changes:**
- Form fields: consistent `min-h-[44px]`
- Labels: `text-[13px] text-text-subtle`
- Location picker: smaller map preview
- Validation: inline error messages

### 5. Payment Page (Step 3)

**Changes:**
- Total card: sticky footer with gradient
- Payment options: cleaner radio style
- Summary: expandable with smooth animation
- CTA: gradient button with total

### 6. StepButton Component

**Current:** Solid emerald button
**New:** Gradient button with total

```tsx
<button className="bg-gradient-to-r from-emerald-600 to-emerald-500 ...">
  Buat Pesanan Rp 75.000
</button>
```

## Files to Modify

| File | Changes |
|------|---------|
| `components/customer/step-header.tsx` | Add progress indicator |
| `components/customer/step-button.tsx` | Gradient style |
| `pages/customer/checkout/index.tsx` | Cart visual polish |
| `pages/customer/checkout/customer.tsx` | Form visual polish |
| `pages/customer/checkout/payment.tsx` | Payment visual polish |

## Success Criteria

- [ ] Progress indicator shows current step clearly
- [ ] All touch targets ≥ 44pt
- [ ] Consistent spacing (8/16/24px scale)
- [ ] Premium feel (subtle shadows, clean typography)
- [ ] No functional changes (same 3-step flow)
