# Product Detail Outlet Closed Status

## Goal

Show outlet-closed status immediately on product detail when the backend already knows the outlet is closed.

## Scope

- Read existing `is_open` prop from `ProductController` in `resources/js/pages/customer/product-detail.tsx`.
- Combine server-provided status with existing `selectedOutlet?.is_open` context status.
- Treat `is_open === false` as closed; do not treat `undefined` as closed.
- Keep existing closed-outlet CTA, add-to-cart guard, API error handler, middleware, and checkout behavior.
- Do not change backend APIs, outlet operating-hours logic, or payment rules.

## Data flow

1. `ProductController` calculates and sends `is_open`.
2. `ProductDetail` receives the prop and passes it to its internal rendering flow.
3. Closed state is true when either authoritative server prop or loaded context outlet explicitly reports `false`.
4. Existing UI displays `Toko Tutup`, disables CTA, and blocks add-to-cart.
5. Context/API updates can still reflect runtime outlet status after page load.

```tsx
const isOutletClosed =
    is_open === false || selectedOutlet?.is_open === false;
```

## Error handling

No change. Server-side `CheckStoreOpen` remains the final guard. Unknown status remains non-closed until an explicit `false` value is available.

## Verification

- Closed server prop immediately renders `Toko Tutup` and disables CTA.
- Open server prop does not show closed state when context is unavailable.
- Context closed state still shows closed state.
- Add-to-cart remains blocked while closed.
- TypeScript, lint, format, and diff checks pass.
