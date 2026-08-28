# Delivery Default Address Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let delivery checkout continue with an auto-selected default address without requiring a manual click.

**Architecture:** Reuse existing checkout customer submission/session path rather than adding an endpoint. Auto-selection fills the same complete form state as manual selection; submit persists `address_id`, address fields, and coordinates before payment progression.

**Tech Stack:** Laravel, React, TypeScript, Inertia.js, PHPUnit.

## Global Constraints

- Preserve manual address selection behavior.
- Persist `address_id`, address fields, and coordinates.
- Reuse existing backend checkout session flow; no new endpoint unless proven necessary.
- Keep delivery serviceability and validation checks.
- Do not modify payment rules.

---

### Task 1: Characterize current auto-selection and session behavior

**Files:**
- Read: `resources/js/pages/customer/checkout/customer.tsx:120-257`
- Read: `app/Http/Controllers/Customer/CheckoutController.php:298-449`
- Test: `tests/Feature/CheckoutAddressPersistenceTest.php`

- [ ] **Step 1: Read existing persistence test and identify request contract**

Confirm exact route, payload, session key, and expected `checkout.location` fields used by existing tests.

- [ ] **Step 2: Add failing feature test**

Add a test that posts a delivery customer payload representing an auto-selected default address and asserts session location contains its `address_id`, address fields, latitude, and longitude. Use existing factories/helpers and route names from the current test suite.

- [ ] **Step 3: Run focused test**

```bash
php artisan test tests/Feature/CheckoutAddressPersistenceTest.php
```

Expected: new regression test fails if auto-selected flow does not persist through the existing request path.

- [ ] **Step 4: Commit test**

```bash
git add tests/Feature/CheckoutAddressPersistenceTest.php
git commit -m "test: cover default delivery address persistence"
```

---

### Task 2: Make auto-selected address follow persisted form flow

**Files:**
- Modify: `resources/js/pages/customer/checkout/customer.tsx:150-257`
- Modify: `app/Http/Controllers/Customer/CheckoutController.php:298-449` only if Task 1 proves payload/session gap.

**Interfaces:**
- Existing `applySavedAddress(addr)` remains source for both manual and automatic selection.
- Existing customer checkout submit persists `checkout.location`.

- [ ] **Step 1: Trace state update ordering**

Verify `applySavedAddress` writes one complete `CustomerForm` object, including `address_id`, address text, recipient fields, latitude, and longitude. Verify auto-selection does not mark itself complete before the form update is committed.

- [ ] **Step 2: Implement minimal synchronization fix**

Use the existing submit/session path. If auto-selection currently only calls `router.reload`, ensure it does not depend on reload to persist state. Keep quote reload after form state is established; do not add a duplicate persistence endpoint.

- [ ] **Step 3: Preserve explicit user choice**

Keep `userChoseLocation.current`, `autoApplied.current`, and draft guards so manual selection is not overwritten by the effect.

- [ ] **Step 4: Run regression test**

```bash
php artisan test tests/Feature/CheckoutAddressPersistenceTest.php
npm run types:check
npm run lint:check
npm run format:check
```

Expected: all pass.

- [ ] **Step 5: Commit implementation**

```bash
git add resources/js/pages/customer/checkout/customer.tsx app/Http/Controllers/Customer/CheckoutController.php
 git commit -m "fix: persist auto-selected delivery address"
```

---

### Task 3: Verify checkout paths

**Files:**
- Test/verify: `tests/Feature/CheckoutAddressPersistenceTest.php`, delivery checkout UI.

- [ ] **Step 1: Run focused and full relevant tests**

```bash
php artisan test tests/Feature/CheckoutAddressPersistenceTest.php
```

- [ ] **Step 2: Verify manually**

1. Add item to cart.
2. Choose Delivery.
3. Leave default address untouched.
4. Confirm address, coordinates, and delivery quote load.
5. Click Continue once.
6. Confirm checkout reaches payment/DOKU.
7. Repeat with manual address selection and confirm unchanged behavior.

- [ ] **Step 3: Verify repository state**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and only intended files changed.
