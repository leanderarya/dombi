# Active Refund Order Card Design

**Date:** 2026-07-27
**Status:** Awaiting user review

## Problem

Refund-active orders now appear in Pesanan Aktif, but `ActiveOrderCard` still treats them like ordinary terminal operational orders:

1. Card status comes from `order.status`, so customers see cancellation/rejection status instead of refund progress.
2. `OrderCardShell` disables card navigation when operational status is terminal.
3. `ActiveOrderCard` does not accept or render the backend `refund_badge` payload.
4. Authenticated Customer Orders already receives `refund_badge`, but Guest Recovery does not format or return it.

## Approved Behavior

For payment statuses `refund_pending`, `refund_in_progress`, `refund_rejected`, and `refund_failed`:

- Show primary badge: **Proses Refund**
- Show secondary detail below badge/header:
  - `refund_pending` → backend label such as **Menunggu Diproses**
  - `refund_in_progress` → **Sedang Diproses**
  - `refund_rejected` → **Refund Ditolak**
  - `refund_failed` → **Refund Gagal**
- Entire card is clickable even though operational `order.status` is terminal
- Authenticated click target: `/customer/orders/{id}`
- Guest/recovered click target: `/track/{recovery_token}`

Ordinary active-order cards retain current status, actions, and click behavior.

## Architecture

### Backend Payload

Continue using the existing backend-owned `refund_badge` contract:

```php
[
    'payment_status' => $order->payment_status,
    'queue_state' => $refundPayloads->queueState($order),
    'status_label' => $refundPayloads->statusLabel($order),
]
```

Customer Orders already attaches this payload. Guest Recovery will inject `RefundPayloadService`, format the same payload, and include it in each formatted order.

No refund-label mapping is duplicated in React.

### ActiveOrderCard

Extend the order type with optional:

```ts
refund_badge?: {
    payment_status: string
    queue_state: string
    status_label: string
} | null
```

Derive:

```ts
const refundBadge = order.refund_badge ?? null
const hasActiveRefund = Boolean(refundBadge)
```

When `hasActiveRefund`:

- Override the visible status badge with **Proses Refund**
- Render `refundBadge.status_label` as secondary contextual text
- Suppress payment retry, payment waiting, cancellation, and ordinary tracking action branches that do not apply to terminal refund orders
- Show one lightweight action label, **Lihat Refund**, only if needed for clarity; approved interaction remains full-card click, so no separate button is required
- Pass `clickable={true}` to `OrderCardShell`

### OrderCardShell

No component API change is needed. It already supports an explicit `clickable` override:

```tsx
<OrderCardShell clickable={hasActiveRefund ? true : undefined} />
```

This overrides terminal-status auto-disable only for refund-active cards.

## Visual Hierarchy

Refund-active card header:

```text
DOMBI-XXXX                  [Proses Refund]
27 Jul 2026
↻ Sedang Diproses
```

Color treatment:

- Primary badge: blue/info treatment
- Secondary detail:
  - pending/in-progress: blue or amber based on queue state
  - rejected/failed/action-required: red
- Keep existing card border, product, outlet, fulfillment, and total layout
- Do not add another bordered sub-card

## Interaction Rules

- Card link wraps the full card through `OrderCardShell`
- Nested action links/buttons must not appear for active refund cards, avoiding invalid nested anchors and accidental cancellation/payment actions
- Keyboard and touch navigation inherit the existing Link behavior
- Touch target is the complete card

## Data Flow

### Authenticated Customer Orders

```text
OrderController
  → attaches refund_badge through RefundPayloadService
  → customer/orders/index.tsx
  → ActiveOrderCard
  → clickable detail page
```

### Guest Recovery

```text
GuestOrderRecoveryService
  → injects RefundPayloadService
  → formatOrder adds refund_badge
  → RecoverySheet result
  → customer/orders/index.tsx
  → ActiveOrderCard
  → clickable /track/{recovery_token}
```

## Test Design

1. Customer Orders active refund payload includes `refund_badge` with backend status label.
2. Guest recovery active refund payload includes the identical `refund_badge` shape.
3. `ActiveOrderCard` source/behavior renders **Proses Refund** and `status_label` when payload exists.
4. Active refund passes `clickable={true}` to `OrderCardShell`.
5. Active refund suppresses cancellation/payment retry/payment waiting actions.
6. Ordinary active orders keep current badge and actions.
7. Production build passes.

## Files Expected to Change

- `app/Services/GuestOrderRecoveryService.php`
- `resources/js/components/customer/active-order-card.tsx`
- `resources/js/pages/customer/orders/index.tsx` only if its TypeScript order contract needs `refund_badge`
- `tests/Feature/ActiveRefundOrderVisibilityTest.php`
- Focused frontend source-contract test only if an existing frontend test pattern exists

## Non-Goals

- Do not alter refund lifecycle or visibility scopes
- Do not change history cards
- Do not add a third order tab
- Do not add a separate refund button or modal
- Do not duplicate refund status mapping in frontend
- Do not change order detail/refund cards

## Success Criteria

- Active refund cards visibly say **Proses Refund**
- Secondary refund status is accurate and backend-owned
- Entire card opens order/refund detail for authenticated and recovered guest flows
- Invalid ordinary order actions are absent on refund-active cards
- Non-refund active cards remain unchanged
