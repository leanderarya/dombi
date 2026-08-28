# Order Cancellation PWA Navigation

## Goal

After a customer cancels an order from its detail page, return to `/customer/orders` without opening a new window or forcing a full browser reload.

## Scope

- Keep existing in-page cancellation dialog because cancellation requires reason and, for confirmation pickup orders, last four phone digits.
- Remove manual URL mutation from order detail rendering.
- Navigate with Inertia after successful cancellation.
- Apply same destination to authenticated and confirmation/recovery cancellation flows.
- Preserve existing cancellation endpoints, validation, and error handling.

## Data flow

1. Customer opens cancellation dialog.
2. Customer selects reason and submits.
3. Existing cancellation request executes.
4. On success, client navigates to `/customer/orders` with `router.visit('/customer/orders', { replace: true })`.
5. On failure, dialog remains open and displays existing error.

## Error handling

No change to server-side cancellation behavior. Network or server errors remain in dialog. Navigation happens only after a confirmed successful response.

## Verification

Run TypeScript, ESLint, Prettier check, and `git diff --check`. Confirm no new tab/window or `window.location.reload()` remains in cancellation success flow.
