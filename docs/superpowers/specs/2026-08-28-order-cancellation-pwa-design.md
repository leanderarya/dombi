# Order Cancellation PWA Navigation

## Goal

After a customer cancels an order from its detail page, return to `/customer/orders` without opening a new window or forcing a full browser reload.

## Scope

### Order cancellation navigation

- Keep existing in-page cancellation dialog because cancellation requires reason and, for confirmation pickup orders, last four phone digits.
- Remove manual URL mutation from order detail rendering.
- Navigate with Inertia after successful cancellation.
- Apply same destination to authenticated and confirmation/recovery cancellation flows.
- Preserve existing cancellation endpoints, validation, and error handling.

### Delivery checkout default address

- When delivery checkout auto-selects the suggested/default saved address, persist the complete selected location to the existing checkout session/backend flow.
- Make auto-selected address follow same state and delivery-quote path as manually selected address.
- Do not require the customer to click an already-selected address before continuing.
- Preserve manual address selection and existing location validation.

## Data flow

### Order cancellation

1. Customer opens cancellation dialog.
2. Customer selects reason and submits.
3. Existing cancellation request executes.
4. On success, client navigates to `/customer/orders` with `router.visit('/customer/orders', { replace: true })`.
5. On failure, dialog remains open and displays existing error.

### Delivery checkout address

1. Checkout loads delivery addresses and backend suggestion/default address.
2. Client auto-applies selected address to form state.
3. Client persists selected location through existing checkout location submission/session path.
4. Delivery quote reloads using persisted address coordinates and `address_id`.
5. Continue submits without a manual address click.

Auto-selection must not create a second address-selection protocol or new endpoint unless existing backend flow cannot persist the data.

## Error handling

No change to server-side cancellation behavior. Network or server errors remain in dialog. Navigation happens only after a confirmed successful response.

For delivery checkout, failed persistence or quote refresh must leave the form actionable with the existing validation/error state. Never proceed with an address that is only present in transient client state when backend checkout location is required.

## Verification

- Delivery checkout with a default saved address: continue works without clicking the address first.
- Delivery checkout with manually selected address: behavior remains unchanged.
- Confirm checkout session contains `address_id`, address fields, and coordinates after auto-selection.
- Confirm delivery quote uses auto-selected address.

Run TypeScript, ESLint, Prettier check, and `git diff --check`. Confirm no new tab/window or `window.location.reload()` remains in cancellation success flow.
