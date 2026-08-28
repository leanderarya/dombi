# Order Cancellation PWA Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return customers to `/customer/orders` through Inertia after successful cancellation without full reload or manual URL mutation.

**Architecture:** Keep existing cancellation dialog and endpoints. Centralize post-success navigation in `useOrderCancel`; authenticated cancellation uses Inertia callbacks, and recovery cancellation uses `router.visit` after a successful fetch.

**Tech Stack:** Laravel, React, TypeScript, Inertia.js, PHPUnit.

## Global Constraints

- Preserve existing cancellation validation and error messages.
- Do not open a new tab or window.
- Do not change cancellation business rules or endpoints.
- Do not use `window.location.reload()` for cancellation success.

---

### Task 1: Remove URL mutation and add Inertia success navigation

**Files:**
- Modify: `resources/js/pages/customer/orders/show.tsx:98-102`
- Modify: `resources/js/hooks/use-order-actions.ts:49-87`

**Interfaces:**
- `useOrderCancel(...).cancel(reason, note, last4Hp)` remains unchanged.
- Produces navigation to `/customer/orders` with `{ replace: true }` after successful cancellation.

- [ ] **Step 1: Remove `history.replaceState` effect**

Delete the `useEffect` that calls `window.history.replaceState` for confirmation orders. Detail route must remain truthful until cancellation succeeds.

- [ ] **Step 2: Navigate recovery cancellation through Inertia**

After `data.success` in `useOrderCancel`, replace:

```ts
window.location.reload();
```

with:

```ts
router.visit('/customer/orders', { replace: true });
```

- [ ] **Step 3: Add authenticated cancellation success callback**

Use `router.post` with `onSuccess`:

```ts
router.post(`/customer/orders/${orderId}/cancel`, { reason, note }, {
    onSuccess: () => router.visit('/customer/orders', { replace: true }),
});
```

If the controller already redirects to the order list, preserve that response and avoid duplicate navigation; inspect response behavior before choosing whether the callback should be omitted. The required observable result is one SPA navigation to `/customer/orders`.

- [ ] **Step 4: Run focused checks**

Run:

```bash
rg "history\.replaceState|window\.location\.reload" resources/js/pages/customer/orders/show.tsx resources/js/hooks/use-order-actions.ts
npm run types:check
npm run lint:check
npm run format:check
```

Expected: no cancellation URL mutation/reload, all checks pass.

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/customer/orders/show.tsx resources/js/hooks/use-order-actions.ts
git commit -m "fix: keep order cancellation in PWA"
```

---

### Task 2: Review cancellation behavior

**Files:**
- Test/verify: existing cancellation feature tests and browser staging flow.

- [ ] **Step 1: Run cancellation feature tests**

```bash
php artisan test --filter='CancelOrder|OrderCancellation'
```

Expected: existing cancellation tests pass.

- [ ] **Step 2: Verify manually**

For authenticated order and confirmation/recovery order:

1. Open order detail.
2. Click Batalkan Pesanan.
3. Select reason.
4. Submit.
5. Confirm no new tab/window opens.
6. Confirm destination is `/customer/orders`.
7. Confirm browser remains in PWA shell.

- [ ] **Step 3: Commit any test-only adjustment**

Only if an existing test directly asserts the old reload/URL behavior, update that assertion to expect `/customer/orders` SPA navigation and commit separately.
```

