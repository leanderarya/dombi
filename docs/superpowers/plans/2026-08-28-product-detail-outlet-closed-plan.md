# Product Detail Outlet Closed Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Product Detail show and enforce closed-outlet state immediately from the server-provided outlet status.

**Architecture:** Keep backend `is_open` calculation and existing OutletContext/API guards. Pass the existing server prop into Product Detail's internal flow and derive closed state from explicit `false` values from either server or context.

**Tech Stack:** React, TypeScript, Inertia.js, Laravel existing outlet status API.

## Global Constraints

- Treat `is_open === false` as closed.
- Do not treat `undefined` as closed.
- Preserve existing `selectedOutlet` runtime updates.
- Preserve existing add-to-cart and CTA guards.
- Do not change backend operating-hours logic, APIs, middleware, or payment rules.

---

### Task 1: Wire server outlet status into Product Detail

**Files:**
- Modify: `resources/js/pages/customer/product-detail.tsx:173-210`
- Test: existing frontend test location if present; otherwise verify with TypeScript and behavior-focused code inspection.

**Interfaces:**
- `ProductDetail` consumes existing Inertia prop `is_open?: boolean`.
- Internal rendering derives `isOutletClosed` from `is_open === false || selectedOutlet?.is_open === false`.

- [ ] **Step 1: Inspect existing props and internal component signature**

Confirm the controller already sends `is_open`, locate `ProductDetailInner`, and identify every use of `isOutletClosed`, add-to-cart guard, and StickyCTA props.

- [ ] **Step 2: Add explicit prop typing/forwarding**

Add `is_open?: boolean` to the page props and pass it into the internal component. Preserve all existing props and avoid renaming the backend prop.

- [ ] **Step 3: Combine server and context state**

Replace context-only closed-state derivation with:

```tsx
const isOutletClosed =
    is_open === false || selectedOutlet?.is_open === false;
```

Use strict comparison so missing status remains non-closed.

- [ ] **Step 4: Verify existing guards consume combined state**

Confirm `handleAdd`, CTA disabled state, and `Toko Tutup` label continue to consume `isOutletClosed`. Do not duplicate closed-state logic in individual handlers.

- [ ] **Step 5: Run checks**

```bash
npm run types:check
npm run lint:check
npm run format:check
git diff --check
```

Expected: all commands pass.

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/customer/product-detail.tsx
git commit -m "fix: show closed outlet on product detail"
```

---

### Task 2: Verify closed-outlet user flows

**Files:**
- Verify: `resources/js/pages/customer/product-detail.tsx`
- Verify existing backend guard: `app/Http/Middleware/CheckStoreOpen.php`

- [ ] **Step 1: Run frontend checks again from clean diff**

```bash
npm run types:check
npm run lint:check
npm run format:check
git diff --check
```

- [ ] **Step 2: Manual staging verification**

With an outlet currently closed:

1. Open Product Detail directly.
2. Confirm `Toko Tutup` is visible immediately without clicking add-to-cart.
3. Confirm CTA is disabled.
4. Confirm add-to-cart cannot submit.
5. Confirm open outlet still allows normal CTA behavior.
6. Confirm context/API `outlet_closed` updates continue to work.

- [ ] **Step 3: Confirm scope**

```bash
git status --short
git diff --stat
```

Expected: only Product Detail implementation changes, apart from ignored scratch files already present.
