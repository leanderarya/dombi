# Spec: Refund Feature Completion and Lifecycle Hardening

Date: 2026-07-24
Status: Approved
Author: brainstorming + owner
Depends on: `docs/superpowers/specs/2026-07-24-manual-refund-process-design.md`

## Problem

Manual refund foundation exists, but feature is incomplete across Owner, Outlet, Customer, and guest tracking.

Current blindspots include:

- Customer refund form submits to order ID `0`.
- Customer terminal orders are difficult to reopen from order history.
- Outlet has no refund tracking despite triggering refunds through rejection or cancellation.
- Owner refund workspace is hidden from normal finance navigation and lacks complete operational states.
- Guest cancellation is still possible even though guest must not request refund or cancel an order.
- Guest prepaid order can enter refund after outlet/system action, but owner has no workflow to enter guest destination.
- Refund timeline is reconstructed from mutable order columns and cannot represent retries or rollback.
- `refund_in_progress` has no recovery path.
- Full encrypted destination values can leak through serialized `Order` models to roles that do not need them.
- Proof files are public.
- DOKU redirect fallback can trust unsigned success state.
- Late successful payment from expired payment state can miss refund queue.
- Owner completion can overwrite refund snapshot using current order total.
- Refund notifications and navigation are incomplete.
- Refund-related pages lack role-specific end-to-end coverage.

## Goals

- Complete refund tracking and actions for Owner, Outlet, registered Customer, and guest tracking.
- Preserve one full refund per order; no partial or multiple refund scope.
- Make refund lifecycle recoverable, auditable, and race-safe.
- Prevent guest cancellation and guest-initiated refund actions.
- Let owner enter destination for guest refunds after phone verification.
- Expose only role-appropriate refund data.
- Make refund proof private and authorization-protected.
- Complete all cancellation, rejection, expiry, and late-payment entry points.
- Standardize stock-related rejection/cancellation copy as `Stok Tidak Tersedia`.

## Non-Goals

- DOKU refund API or automatic money movement.
- Partial refund.
- Multiple refunds per order.
- Outlet processing refund money.
- Guest editing destination or requesting refund.
- Automatic bank/e-wallet account verification.
- Customer dispute or chargeback subsystem.

## Architectural Decision

Continue storing current refund snapshot on `orders`. Add immutable `refund_status_histories` rows for lifecycle events.

This preserves existing full-refund implementation while solving repeated transition and rollback history. A separate `refunds` aggregate remains deferred until partial or multiple refunds become real requirements.

## Canonical Lifecycle

```text
paid order cancelled/rejected/expired
  -> refund_pending

refund_pending
  registered customer:
    destination missing -> awaiting_customer
    destination complete -> ready
  guest:
    owner contacts guest
    owner submits destination -> ready

ready
  -> owner starts
  -> refund_in_progress

refund_in_progress
  -> owner completes with proof
  -> refunded

refund_in_progress
  -> owner rolls back with required reason:
      retry
        -> refund_pending
        -> destination remains valid
        -> ready
      fix_destination
        -> refund_pending
        -> destination marked invalid
        registered customer edits destination
        guest destination edited by owner

refund_pending
  -> owner rejects with standard reason
  -> refund_rejected

refund_rejected with eligible reason
  -> destination corrected
  -> refund_pending
```

### Derived queue states

Queue state is derived from payment status and destination validity:

| Queue | Condition |
|---|---|
| Menunggu Data Customer | `refund_pending`, registered customer, `refund_destination_status` is `missing` or `invalid` |
| Menunggu Kontak Guest | `refund_pending`, guest, `refund_destination_status` is `missing` or `invalid` |
| Siap Diproses | `refund_pending`, `refund_destination_status = valid` |
| Sedang Diproses | `refund_in_progress` and `refund_started_at > now() - 24 hours` |
| Perlu Tindakan | `refund_failed`, or `refund_in_progress` with `refund_started_at <= now() - 24 hours` |
| Selesai | `refunded` |
| Ditolak | `refund_rejected` |

`awaiting_customer` and `ready` are UI/queue states, not new `payment_status` values.

Add `orders.refund_destination_status` as nullable string with canonical values `missing`, `valid`, or `invalid`. New refund requests initialize it to `missing`; successful destination submission sets it to `valid`; rollback `fix_destination` sets it to `invalid`. Existing rows are backfilled: destination submitted/type present becomes `valid`, otherwise `missing`.

A refund is operationally stale after 24 hours in `refund_in_progress`. Staleness changes queue placement only; it does not mutate status automatically.

## Lifecycle Invariants

- Refund amount is snapshotted when refund is requested.
- Completion uses existing `refund_amount`; it must not overwrite snapshot from current `order.total`.
- Refund request amount must be greater than zero and cannot exceed original paid total.
- Owner cannot start without complete valid destination.
- Outlet cannot start, reject, rollback, or complete financial refund.
- Registered customer can edit destination only before processing or after eligible correction request.
- Guest cannot submit or edit destination.
- Owner can submit/edit destination only for guest refund.
- `refund_in_progress` can transition only to `refunded` or rollback to `refund_pending`.
- Direct `refund_in_progress -> refund_rejected` is forbidden.
- Rollback requires mode and reason.
- Every successful lifecycle event creates exactly one history row.
- Failed conditional transition creates no success notification or history row.
- Duplicate trigger creates one refund request, history event, and notification.

## Refund Status History

Create `refund_status_histories`.

### Columns

- `id`
- `order_id` foreign key, cascade delete
- `from_status` nullable string
- `to_status` string
- `event` string
- `actor_type`: `customer`, `guest`, `outlet`, `owner`, `system`
- `actor_id` nullable unsigned bigint
- `reason_code` nullable string
- `note` nullable text
- `metadata` nullable JSON
- `created_at`

No `updated_at`; history is immutable.

### Events

- `refund_requested`
- `destination_submitted`
- `destination_updated`
- `guest_destination_submitted_by_owner`
- `guest_destination_updated_by_owner`
- `processing_started`
- `processing_rolled_back`
- `refund_rejected`
- `refund_reopened`
- `refund_completed`
- `refund_failed`

### Metadata safety

History metadata may include:

- destination type
- rollback mode
- refund amount
- source entry point
- proof presence boolean
- transfer reference presence boolean

History metadata must not contain:

- full account number
- full e-wallet number
- proof path
- raw DOKU payload
- secrets or tokens

### Atomicity

Refund status transition and history row are written in one DB transaction. If either write fails, neither persists.

## Entry Points

### Customer cancellation

Registered customer only. Paid order cancellation creates refund. Unpaid order cancellation does not.

Guest cancellation route is removed. Guest cancellation controller action retains an authorization guard returning 403 if reached through stale clients or compatibility routes. Guest cannot request refund.

### Outlet rejection

Paid pending-confirmation order rejection creates refund. Unpaid order rejection does not.

### Outlet cancellation

Paid accepted order cancellation creates refund. Unpaid accepted order must not be reachable because outlet cannot confirm or progress unpaid orders.

### Expiry

Paid order expiry creates refund. Unpaid order expiry does not.

### Late payment

Late successful payment for terminal order statuses creates refund:

- `cancelled_by_customer`
- `cancelled_by_outlet`
- `rejected_by_outlet`
- `expired`

Previous payment status can be `pending`, `failed`, or `expired`. Transition matrix must support verified late success from `expired -> paid`, followed immediately by refund pending for terminal order.

### Manual mark-paid command

Manual command must use shared payment transition flow. It cannot directly overwrite terminal/refund payment states.

## Guest Rules

An order is treated as guest when its related `Customer` has no linked `user_id`. This is the canonical registered-vs-guest check for refund queues and authorization.

- Guest cannot cancel order.
- Guest cannot request refund.
- Guest cannot submit/edit refund destination.
- Guest can view read-only refund status, amount, and safe timeline through recovery token.
- Guest cannot view destination or proof.
- If outlet/system triggers refund for prepaid guest order, owner contacts guest using order phone.
- Owner records verified bank/e-wallet destination.
- Guest tracking displays: `Tim Dombi akan menghubungi nomor pesanan untuk konfirmasi tujuan refund.`

## Destination Data

### Types

Bank:

- bank name
- account number
- account holder

E-wallet:

- provider
- registered number
- holder name

### Storage

Destination fields remain encrypted at rest using Laravel encrypted casts and `TEXT` columns.

### Validation

- Type must be `bank` or `ewallet`.
- Selected type fields required.
- Unselected type fields prohibited and cleared.
- Owner guest-destination action uses same validation rules as registered customer action.
- Owner cannot submit guest destination for registered customer orders.
- Registered customer cannot submit destination for guest orders.

### Role visibility

| Role | Destination visibility |
|---|---|
| Owner | Full values |
| Registered customer | Masked values after submit |
| Guest | None |
| Outlet | None |

Full values must not appear in Customer, guest, or Outlet Inertia page JSON.

## Rollback

Owner can rollback `refund_in_progress`.

### Modes

`retry`:

- destination remains valid
- status becomes `refund_pending`
- queue becomes `ready`

`fix_destination`:

- status becomes `refund_pending`
- destination validity is reset/invalidated
- registered customer must edit destination
- owner must edit guest destination

### Required fields

- `mode`: `retry` or `fix_destination`
- `reason`: required string, max 500

### Stored result

- History event `processing_rolled_back`
- Actor owner ID
- Rollback mode in safe metadata
- Reason in history note
- Current `refund_started_at` and `refund_started_by` cleared
- Previous processing attempt preserved only in history

## Rejection

Standard rejection reasons remain:

- `invalid_destination`
- `incomplete_destination`
- `payment_unverified`
- `duplicate_refund`
- `other`

Rules:

- Reject only `refund_pending`.
- Reject only after destination exists, except explicit operational legacy repair controlled by owner.
- `other` requires note.
- Eligible reasons remain invalid/incomplete destination.
- Eligible correction reopens through destination update and creates `refund_reopened` history.
- Rejection history remains immutable; current rejection snapshot can be cleared when reopened.

## Stock Reason Standardization

Canonical copy: `Stok Tidak Tersedia`.

Replace `Stok Habis` in:

- outlet cancellation reasons
- outlet rejection/cancellation dialogs
- order history display where reason comes from enumerated business copy
- customer and guest tracking copy
- tests and fixtures

Existing historical free-text values are not migrated. UI may normalize known legacy value `Stok Habis` to canonical display.

## Owner Experience

### Navigation

Refund becomes tab under `Keuangan` alongside Tagihan, Pembayaran, and Rekening.

`/owner/refunds` remains backward-compatible and renders or redirects to finance refund tab. Owner navigation marks Keuangan active for refund route.

### Queue

Tabs with counts:

- Menunggu Data Customer
- Menunggu Kontak Guest
- Siap Diproses
- Sedang Diproses
- Perlu Tindakan
- Selesai
- Ditolak

Requirements:

- pagination rendered
- filter query preserved
- order code links to owner order detail
- status badge visible
- amount uses refund snapshot
- timeline summary visible
- translated rejection labels
- responsive cards and 44px minimum action targets
- `aria-current` on selected filter

### Registered customer refund actions

- Awaiting destination: monitor only.
- Ready: Start or Reject.
- In progress: Complete or Rollback.
- Completed: view authorized proof, reference, note, timeline.
- Rejected: view translated reason, note, timeline.

### Guest refund actions

- Awaiting contact: enter bank/e-wallet destination after phone verification.
- Destination ready: edit destination, Start, or Reject.
- In progress: Complete or Rollback.
- Guest destination dialog displays customer name and phone, plus explicit verification acknowledgement.

### Sensitive destination treatment

- Full destination only in owner response.
- Number uses `break-all`.
- Copy action labels what was copied.
- Sensitive-data hint: `Gunakan hanya untuk proses refund order ini.`
- Full destination is excluded from notifications and history metadata.

### Complete action

- Proof image required, max 2 MB.
- Reference optional, max 255.
- Note optional, max 500.
- Completion uses `refund_amount` snapshot.
- Proof write and transition failure cleanup remain race-safe.

## Outlet Experience

### Orders list

History orders show refund badge derived from payment status:

- Menunggu Data Refund
- Siap Diproses
- Sedang Diproses
- Selesai
- Ditolak
- Perlu Tindakan

### Order detail

Read-only refund panel:

- refund amount
- current translated status
- safe timeline
- no destination
- no proof
- no transfer reference

### Trigger feedback

When outlet rejects/cancels:

- paid order success copy states refund otomatis masuk antrean owner
- unpaid order success copy states no refund is required

Outlet cannot mutate refund lifecycle.

### Data boundary

Outlet controller returns explicit refund-safe payload. Do not serialize destination/proof fields in full order model.

## Registered Customer Experience

### Order history

- Terminal order cards remain clickable.
- Refund badge shown independently from order status.
- Clicking opens detail.

### Order detail

Refund card receives actual `order.id`.

Fixes:

- no `orderId={0}`
- destination type is part of submitted form state before request
- `Select` uses existing component API correctly
- initial label/holder/provider used for edit
- masked number is never submitted as actual number
- number re-entry required during edit unless backend supports unchanged-number semantics explicitly

States:

1. Pending without destination
2. Pending with destination
3. In progress
4. Completed
5. Rejected and correctable
6. Rejected final
7. Failed/perlu tindakan, if legacy status appears

Display:

- refund amount
- translated status
- masked destination where permitted
- timeline
- timestamps
- rejection reason/note
- proof through authorized endpoint after completion
- transfer reference/note when completed

Refund guidance takes precedence over terminal order guidance when refund workflow exists.

### Payload safety

Customer order detail uses explicit order/refund DTO. Full encrypted destination values must not appear anywhere in page props.

## Guest Tracking Experience

Public recovery-token tracking includes read-only refund payload:

- refund amount
- translated status
- safe timeline
- no destination
- no proof
- no mutation actions

Guest cancellation UI and endpoint are absent/forbidden.

## Proof Security

### Storage

New refund proofs are stored on Laravel `local` disk under `refund-proofs/{order_id}/`. Persisted new paths are prefixed `private:`; existing unprefixed paths are treated as legacy `public` disk paths.

Existing public proof records remain readable through compatibility lookup until migrated, but direct public URL is no longer returned to pages.

### Download endpoint

Authenticated streaming controller authorizes:

- Owner: any refund proof.
- Registered customer: own order only.
- Outlet: forbidden.
- Guest: forbidden.

Endpoint never accepts raw storage path from request. It resolves proof path from authorized order.

### Migration strategy

No bulk move required in first release. New files are private. Existing public paths are served through compatibility lookup, then can be migrated separately.

## Payment and DOKU Hardening

### Redirect

DOKU redirect query status is not authoritative. Redirect may:

- look up order
- call verified status API
- display pending/error state if verification fails

It must not mark paid from unsigned `status=SUCCESS` fallback.

### Payment ownership

Order ownership/recovery authorization happens before payment method mutation, transaction deletion, or payment session creation.

Fresh order age alone is not authorization. Guest pay/poll requires recovery token/session binding.

### Unpaid outlet progression

Outlet cannot confirm or progress unpaid order through direct endpoints. Payment guard exists in request/service layer.

### Status alignment

Add `Settled = 'settled'` to PHP `PaymentStatus`. `settled` is terminal for payment collection but not a refund workflow state. The accessor must parse every value allowed by the database enum without throwing.

Legacy `refund_failed` remains visible in owner queue and customer/outlet safe status display.

## Notifications

### Customer notification retrieval

Notification controller must query registered customer notifications through `customer_id`, not only `user_id`.

### Navigation

Refund notification opens:

- registered customer: `/customer/orders/{order_id}`
- owner: finance refund tab/filter

### Owner operational notifications

Owner receives notification when:

- refund requested
- registered customer destination becomes ready
- rejected refund is resubmitted
- guest refund requires contact

### Idempotency

Each lifecycle notification stores `refund_history_id` in notification data. Before insertion, the service checks for an existing notification with the same type, entity order ID, recipient, and `refund_history_id`. Notification is created only after successful transition/history write.

## Error Handling

- Share `flash.error` through Inertia middleware.
- Invalid/stale state displays actionable toast.
- File-storage failure does not transition refund.
- Lost CAS deletes newly stored proof.
- History failure rolls back state mutation.
- Unauthorized proof request returns 403/404 without exposing path.
- Invalid destination does not alter existing valid destination.
- Owner rollback cannot run after completion.
- Guest mutation routes return 403 or 404.

## Testing

### Lifecycle and history

- Every allowed transition writes one ordered history row.
- Forbidden transition writes no history.
- Duplicate entry trigger writes one request/history/notification.
- Rollback retry preserves destination.
- Rollback fix invalidates destination.
- Reopen creates history while preserving prior rejection history.
- Completion preserves refund snapshot amount after order total changes.

### Entry point matrix

- Paid/unpaid registered customer cancellation.
- Guest cancellation forbidden.
- Paid/unpaid outlet rejection.
- Paid/unpaid outlet cancellation.
- Paid/unpaid expiry.
- Late payment after each terminal status.
- Late payment from previous `expired` payment state.
- Manual mark-paid uses shared flow.
- Unpaid outlet order cannot progress.

### Owner

- Queue default/filter counts and membership.
- Registered and guest awaiting queues separated.
- Pagination links rendered.
- Guest destination owner-only.
- Start/reject/complete/rollback action authorization.
- `other` rejection note required.
- Completion proof private and snapshot amount preserved.
- Race-lost completion removes file.
- `refund_failed` visible.

### Customer

- Actual order ID used by destination form.
- All lifecycle payloads and UI states.
- Terminal history card remains clickable.
- Refund badge displayed.
- Full destination absent from page JSON.
- Corrected destination reopens refund.
- Authorized proof download.
- Refund notification navigates to detail.

### Guest

- Cancel route forbidden.
- Tracking displays read-only status, amount, timeline.
- Destination/proof/actions absent.

### Outlet

- Paid rejection/cancellation shows refund tracking.
- Unpaid rejection/cancellation shows no refund.
- Safe payload excludes destination and proof.
- Timeline read-only.
- Stock reason canonical copy.

### Security

- Forged DOKU redirect success cannot mark paid.
- Unauthorized payment mutation leaves order unchanged.
- Fresh-order age alone does not authorize guest payment.
- Outlet cannot progress unpaid order.
- Private proof access matrix.

### Verification

- Refund-focused PHP tests.
- Full PHP suite.
- Frontend production build.
- TypeScript check for changed refund files or project-wide typecheck if baseline permits.
- Browser-level or component coverage for critical Owner/Outlet/Customer refund flows where project tooling supports it.

## Success Criteria

- Owner can discover, process, rollback, reject, and complete every eligible refund.
- Registered customer can submit destination and track full lifecycle.
- Guest cannot cancel/request refund but can track system-triggered refund read-only.
- Owner can enter guest destination after phone verification.
- Outlet can track refund status without financial destination/proof exposure.
- All stock-unavailable copy is consistent.
- Every refund event has immutable safe history.
- No role receives unnecessary sensitive refund data.
- Proof access is authorization-protected.
- Every terminal order/payment entry point produces correct refund behavior.
- Duplicate/racing requests preserve one valid lifecycle and one event record.
