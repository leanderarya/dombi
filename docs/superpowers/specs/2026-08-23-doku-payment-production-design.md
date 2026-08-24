# Dombi × DOKU Production Payment Flow

## Status

- Decision: `APPROVE WITH REQUIRED CHANGES`
- Current implementation: `BLOCK PRODUCTION`
- Scope: payment correctness, payment attempts, webhook processing, reconciliation, manual refunds, order/payment synchronization
- Explicitly excluded: automatic DOKU refund API; existing manual refund workflow remains

## 1. Executive Summary

Dombi's current DOKU sandbox flow handles ordinary payment creation, redirect, webhook, and status polling. It is not production-ready because payment history is mutable, webhook idempotency is cache-only, payment state is order-based rather than attempt-based, no scheduled DOKU reconciliation exists, and refund lifecycle is mixed into `orders.payment_status`.

Target model:

```text
Order
 ├── PaymentAttempt A
 ├── PaymentAttempt B
 └── PaymentAttempt C

PaymentAttempt
 └── optional RefundObligation
```

`payment_attempts` is the canonical per-attempt ledger. `orders.payment_status` is a settlement projection. `refund_obligations` is the canonical refund state. Existing order refund columns remain for backward-compatible reads and projections, but are not a second source of truth.

## 2. Verified Current Architecture

### Checkout

`CheckoutController::submit()` validates checkout, creates the order, reserves inventory, calls `DokuService::createPayment()`, and redirects to DOKU. Evidence:

- `app/Http/Controllers/Customer/CheckoutController.php:506`
- `app/Services/OrderService.php:37-120`
- `app/Services/InventoryService.php:26-86`
- `app/Services/DokuService.php:36-117`

Inventory is reserved before DOKU payment creation. DOKU creation failure does not visibly perform immediate reservation cleanup. Checkout idempotency uses a short cache fingerprint rather than a database guarantee.

### Payment creation

`DokuService::createPayment()` generates a request ID, builds the DOKU payload, signs it, posts to `/checkout/v1/payment`, stores a pending `PaymentTransaction`, and updates the order's DOKU ID/payment status. Evidence: `app/Services/DokuService.php:36-117`.

The migration history starts with `midtrans_order_id` and renames it to `doku_order_id`: `database/migrations/2026_07_02_155808_create_payment_transactions_table.php:11-22`, `database/migrations/2026_07_04_000001_rename_midtrans_to_doku.php:15-17`.

### Webhook

`POST /payment/doku/notify` persists a webhook log, validates DOKU identity/timestamp/digest/signature, checks a cache idempotency key, then processes synchronously. Evidence: `app/Http/Controllers/DokuPaymentController.php:16-86`.

The log is durable, but duplicate protection is not: `request_id` is indexed rather than unique and cache check/write can race.

### Redirect and polling

`GET /payment/doku/redirect` does not trust query status. It calls DOKU status API up to three times and then returns the customer to confirmation. Evidence: `app/Http/Controllers/DokuPaymentController.php:88-153`.

`OrderController::paymentStatus()` also synchronizes with DOKU for every eligible poll: `app/Http/Controllers/Customer/OrderController.php:321-344`.

### Retry

`OrderController::pay()` counts attempts, synchronizes pending/failed/expired status, deletes old transactions, clears order DOKU identity, and creates a new payment. Evidence: `app/Http/Controllers/Customer/OrderController.php:240-300`.

This destroys history and can create a second gateway session after the first session's outcome is ambiguous.

### Refund

Current manual refund flow is stored on the order and changes `orders.payment_status` through `refund_pending`, `refund_in_progress`, `refunded`, `refund_rejected`, and legacy `refund_failed`. Evidence:

- `app/Enums/PaymentStatus.php:5-29`
- `app/Services/RefundService.php:33-97`
- `app/Services/RefundService.php:191-385`

Completion records manual proof/reference; it does not call a DOKU refund API: `app/Services/RefundService.php:341-385`.

### Scheduler

Existing scheduler covers order expiry, stale orders, restock checks, and queue worker execution. No DOKU payment reconciliation command is present: `routes/console.php:13-105`.

## 3. Current State Machines

### Order states

Observed order states include:

```text
pending_confirmation
confirmed
preparing
ready_for_pickup
out_for_delivery
completed
cancelled_by_customer
cancelled_by_outlet
rejected_by_outlet
failed_delivery
expired
```

Order transitions are primarily handled by `OrderStatusService` and related controllers/commands.

### Current payment states

```text
pending
paid
settled
failed
expired
refund_pending
refund_in_progress
refunded
refund_rejected
refund_failed
```

Evidence: `app/Enums/PaymentStatus.php:5-19`.

Current normal transitions are:

```text
pending → paid | failed | expired
failed  → paid | expired
expired → paid
```

Evidence: `app/Services/PaymentStatusService.php:66-75`.

### Target payment state model

Payment settlement and operational review are separate dimensions:

```text
settlement_status:
pending
paid
failed
expired
unknown

verification_status:
verified
needs_review

operational_status:
open
settled
```

DOKU `SUCCESS` always records `settlement_status=paid`, even when amount or identity verification fails. A mismatch also sets `verification_status=needs_review` and blocks fulfilment. `settled` is not a DOKU payment result and is not produced by payment success.

Existing `settled` semantics are operational: `OrderStatusService` and outlet/owner settlement flows use it as a collection/operational terminal state after a separate business action. The implementation must identify and preserve that existing transition explicitly; no new DOKU transition may set it. It is terminal for the existing operational projection, does not mean refund completed, and refund obligations never change it. If the audit of those consumers finds no required business event, new payment-attempt records will not use `settled`; historical order values remain readable until separately deprecated.

### Target refund states

```text
pending
in_progress
completed
rejected
needs_review
```

`refund_obligations` is canonical. Existing order refund fields are compatibility projections.

## 4. Confirmed Protections and Limitations

### Correct protections to preserve

- Browser redirect does not directly mark payment paid: `app/Http/Controllers/DokuPaymentController.php:106-145`.
- DOKU signature uses client ID, timestamp, request target, digest, and HMAC: `app/Services/DokuService.php:188-237`.
- Constant-time comparison uses `hash_equals`: `app/Services/DokuService.php:191,215`.
- Payment transitions use compare-and-set behavior: `app/Services/PaymentStatusService.php:36-47`.
- Late payment uses row locking before refund request: `app/Services/DokuService.php:415-426`.
- Refund service uses order locks: `app/Services/RefundService.php:43-46,193-195,348-350`.
- Existing refund workflow supports manual destination, rejection, rollback, and proof completion.

### Required modifications

- Replace cache-only webhook deduplication with durable uniqueness.
- Transition by payment attempt, then project order state.
- Never delete payment attempts.
- Add fulfilment claim protection.
- Verify amount/currency against immutable attempt snapshot.
- Add reconciliation scheduler.
- Separate refund obligations from payment settlement.
- Handle ambiguous create outcomes as `unknown`, not as failure.

## 5. Canonical Identifier Rules

| Identifier | Ownership | Constraint |
|---|---|---|
| `payment_attempts.id` | Dombi | primary key |
| `attempt_key` | Dombi | unique |
| `invoice_number` | Dombi/DOKU | unique per attempt |
| `merchant_request_id` | Dombi | unique per create request |
| webhook deduplication key | Dombi/provider event | unique |
| `doku_order_id` | DOKU/Dombi | unique if one-to-one contract is confirmed |
| `session_id` | DOKU | indexed initially; no global uniqueness until contract evidence |
| `token_id` | DOKU | indexed initially; no global uniqueness until contract evidence |
| `gateway_reference` | DOKU | unique only if DOKU guarantees it |
| refund obligation key | Dombi | unique per payment attempt and reason |

The design must not assume `session_id` or `token_id` are globally unique.

## 6. Proposed Data Model

### `payment_attempts`

Required fields:

```text
id
order_id
attempt_key
invoice_number
merchant_request_id
payment_method
currency
expected_amount
line_items_snapshot
status
status_version
doku_order_id
session_id
token_id
gateway_reference
last_gateway_status
last_gateway_payload
last_status_at
created_at
paid_at
failed_at
expired_at
reconciliation_state
next_reconciliation_at
reconciliation_attempts
fulfilment_claimed_at
fulfilment_claimed_by
```

The amount, currency, fee, discount, voucher, shipping, and line-item snapshot are immutable after creation.

### `refund_obligations`

Required fields:

```text
id
order_id
payment_attempt_id
reason
amount
currency
status
destination fields
requested_at
started_at
completed_at
rejected_at
needs_review_at
actor fields
manual proof fields
transfer reference
notes
status_version
created_at
updated_at
```

Constraints:

```text
foreign key order_id
foreign key payment_attempt_id
unique(payment_attempt_id, reason)
amount > 0
```

### Durable webhook events

Extend `payment_webhook_logs` or introduce a dedicated event table with:

```text
id
deduplication_key
request_id
source
invoice_number
attempt_id
gateway_reference
raw_body_digest
signature_valid
gateway_status
mapped_status
processing_status
received_at
processed_at
attempt_count
next_retry_at
last_error
payload
```

Processing statuses:

```text
received
validated
processing
processed
ignored_duplicate
failed_retryable
failed_permanent
needs_review
```

## 7. Status Classification

| DOKU status | Internal status | Terminal | Retry | Reconcile | Order effect |
|---|---|---:|---|---:|---|
| `SUCCESS` | `paid` | yes | no | no | claim fulfilment only if eligible |
| `PENDING` | `pending` | no | not yet | yes | none |
| `FAILED` | `failed` | yes for attempt | new attempt | optional final check | retry by policy |
| `REJECTED` | `failed` | yes for attempt | new attempt | no unless ambiguous | retry by policy |
| `DENIED` | `failed` | yes for attempt | new attempt | no unless ambiguous | retry by policy |
| `CANCELLED` | `failed` | yes for attempt | new attempt | no unless ambiguous | retry by policy |
| `EXPIRED` | `expired` | yes for attempt | new attempt | no | retry by policy |
| unknown | `unknown` | no | no blind retry | yes | none |
| amount mismatch | `settlement_status=paid`, `verification_status=needs_review` | settlement terminal; review open | no | yes/manual | never fulfil until resolved |
| missing gateway reference | `needs_review` | operational hold | no | yes/manual | never fulfil |

Unknown status must never silently map to a state that can fulfil or downgrade a paid attempt.

## 8. Allowed and Rejected Transitions

Allowed attempt transitions:

```text
pending → paid
pending → failed
pending → expired
pending → unknown
pending → needs_review
unknown → paid
unknown → failed
unknown → expired
unknown → needs_review
failed → paid       // only if later authoritative DOKU result proves success
expired → paid      // late payment; fulfilment rights still separately evaluated
```

Rejected transitions:

```text
paid → pending
paid → failed
paid → expired
paid → unknown
paid → needs_review
failed → pending
expired → pending
```

Stale/out-of-order events are retained for audit but cannot mutate canonical state.

Refund transitions:

```text
pending → in_progress
pending → rejected
pending → needs_review
in_progress → completed
in_progress → pending       // explicit manual rollback
in_progress → needs_review
rejected → pending          // only valid destination correction/resubmission
```

## 9. Transport Adapters and Canonical Transition Service

Separate transport validation from domain state changes.

### Webhook adapter

The webhook adapter owns DOKU transport concerns:

```text
raw body
→ Client-Id validation
→ Request-Timestamp freshness
→ digest/signature validation
→ durable webhook event persistence
```

It must not pass webhook headers into the domain transition service.

### DOKU status adapter

The status adapter authenticates the DOKU Check Status API response, normalizes gateway identifiers, amount, currency, and status, then submits a normalized payment event.

### Canonical transition service

One domain service is used by webhook processing, redirect reconciliation, customer polling, scheduler reconciliation, sandbox command, and admin recovery.

It must:

1. Lock the payment attempt.
2. Lock the order in deterministic order.
3. Validate attempt identity and normalized gateway data.
4. Record authoritative settlement success even when verification is anomalous.
5. Set verification/review status independently from settlement status.
6. Enforce monotonic settlement transition.
7. Claim order fulfilment rights atomically only when verification is valid and the order is eligible.
8. Project aggregate `orders.payment_status` using the rules below.
9. Create one refund obligation for late/duplicate successful payment.
10. Insert durable outbox records.
11. Commit financial truth before notifications/cache updates.

No controller may directly mutate payment settlement state.

## 10. Payment Creation Flow

```text
lock order
→ verify order is payable
→ create payment attempt intent with unique identities
→ commit intent
→ call DOKU
→ persist response
→ return hosted URL
```

Do not hold a database transaction open across the DOKU HTTP call.

An attempt intent is an active attempt before the external call completes. Use explicit creation state:

```text
initiated
created
unknown
failed
```

`initiated` and `created` attempts are active and block another checkout/retry attempt for the same order. A concurrent request must lock the order, observe the active intent, and reconcile or return its existing payment URL; it must not create another intent. Only an explicit definitive failure, or an authoritative reconciliation proving no gateway payment exists, may permit a new attempt.

Definitive response:

```text
success → creation_state=created, settlement_status=pending
4xx business rejection → creation_state=failed, settlement_status=failed
network/application timeout → creation_state=unknown, settlement_status=unknown
```

Timeout does not mean DOKU failed. Reconcile by merchant request ID/invoice before creating another attempt.

## 11. Webhook Flow

```text
receive raw request
→ verify signature and timestamp
→ insert durable event using unique deduplication key
→ acknowledge after persistence
→ process event synchronously or queue it
→ transition through canonical service
```

Cache may optimize duplicate checks but cannot determine correctness.

## 12. Redirect and Polling Flow

Redirect remains a UX signal only:

```text
receive invoice query
→ locate attempt
→ call shared reconciliation service
→ redirect customer
```

Polling may trigger bounded reconciliation for eligible unresolved attempts, but must not call DOKU indefinitely on every browser poll.

## 13. Aggregate Order Payment Projection

`orders.payment_status` is an aggregate projection, never a copy of the last event or last attempt.

Under the order lock, recompute from all non-deleted attempts and fulfilment/review state using this precedence:

```text
1. fulfilment-winning verified paid attempt exists → paid
2. any active initiated/created attempt with unresolved gateway outcome exists → pending
3. any active pending/unknown attempt exists → pending
4. all attempts are expired and no retry remains → expired
5. all attempts are terminal failed/expired and retry policy remains open → failed
6. no payable attempt exists → retain policy-defined order state and flag for review
```

A paid attempt with amount mismatch still contributes financial settlement as paid, but its verification review blocks fulfilment. The projection must not downgrade it because another attempt later reports failed or expired.

Payment attempt updates must call this aggregate projection method rather than assigning their own status directly to the order.

## 14. Reconciliation Strategy

Scheduler selects attempts where:

```text
creation_state in (created, unknown)
and settlement_status in (pending, unknown)
and next_reconciliation_at <= now()
```

Suggested backoff:

```text
0–5 minutes: every 30–60 seconds
5–30 minutes: every 2–5 minutes
30 minutes–24 hours: every 15–30 minutes
after 24 hours: manual review or low-frequency reconciliation
```

Stop automatic reconciliation for:

```text
paid
failed
expired
needs_review
```

All reconciliation results use the same transition service.

## 14. Fulfilment and Duplicate Success

Under order lock:

```text
if fulfilment claimant exists:
    mark attempt paid
    create one refund obligation
else if order is eligible:
    claim fulfilment
    project order payment_status=paid
    transition order as required
else:
    mark attempt paid
    create one refund obligation
```

The first transaction that atomically claims fulfilment rights wins. A losing successful attempt remains `paid`; it is never downgraded to failed.

Required invariant:

```text
one order has at most one fulfilment claimant
```

## 15. Task 14 Observability and Cutover Verification

Every payment lifecycle log is structured on the `operational` channel and excludes raw payloads, signatures, credentials, and secret material. Required fields are `order_id`, `attempt_id`, `invoice_number`, `request_id`, `gateway_reference`, `mapped_status`, `processing_result`, and `error_reason` when available. Metric/event names cover creation failures and timeouts, invalid signatures, unknown statuses, amount mismatches, pending-age breaches, reconciliation failures, late payments, duplicate successes, refund ageing, and needs-review.

Before read-only cutover, run a parity report covering every legacy `payment_transactions` row against one canonical `payment_attempts` row by legacy ID, invoice, order, amount, currency, and settlement state. Compare every legacy refund field to one `refund_obligations` row by order, attempt, amount, currency, destination, and lifecycle state. Unclassified, missing, duplicate, amount, or status mismatches block cutover.

Cutover is read-only only after parity is clean: canonical attempt and refund-obligation writes remain enabled, legacy payment/refund writes are disabled, dual reads are retained for compatibility, and logs/metrics confirm zero legacy writes. Verification must include `php artisan payments:backfill-attempts --dry-run`, `php artisan payments:reconcile-doku --dry-run`, full tests, migration fresh seed, lint, typecheck, and graphify update.

## 16. Retry Strategy

Retry must:

```text
never delete old attempts
never reuse invoice_number
never reuse merchant_request_id
never overwrite gateway payload
```

Under order lock:

```text
reject retry if active pending/unknown attempt exists
reconcile existing attempt first
create one new attempt only after safe resolution
```

If Attempt A and Attempt B both succeed, the first atomic fulfilment claimant wins. The other successful attempt gets exactly one refund obligation with reason `duplicate_success` or `late_payment`.

## 16. Late Payment and Manual Refund

```text
DOKU SUCCESS
→ validate attempt
→ record attempt paid
→ lock order
→ determine order is invalid/terminal or fulfilment already claimed
→ do not fulfil
→ create one refund_obligation pending
→ project legacy order refund fields
```

No automatic refund API is introduced. Existing manual `RefundService` behavior is retained through an adapter that operates on `RefundObligation`.

Legacy fields on `orders` remain readable and are updated as compatibility projections. New decisions read only `refund_obligations`.

## 18. Historical Refund Backfill

Backfill historical payment attempts before backfilling refund obligations. Every refund obligation must have a `payment_attempt_id`.

Sequence:

```text
historical payment_transactions
→ create/backfill payment_attempts
→ deterministically map each legacy refund to its originating attempt
→ create refund_obligations with non-null payment_attempt_id
```

Mapping priority:

1. Existing transaction/order DOKU invoice identity.
2. Successful transaction matching trusted amount and payment timestamp.
3. A synthesized legacy payment attempt created from the order's immutable payment evidence.
4. If no defensible financial origin exists, stop that row in a migration exception report; do not create an orphan refund obligation.

Rules:

- Rerunnable without duplicates.
- Never overwrite canonical obligation data.
- Preserve original timestamps, actors, amounts, reasons, proof, and references.
- Preserve old order fields.
- New code does not use old fields as source of truth.
- No nullable `payment_attempt_id` is introduced for normal or legacy-import obligations.

## 19. `payment_transactions` Compatibility Migration

`payment_attempts` becomes the only writable canonical payment ledger. `payment_transactions` is migrated and then read-only compatibility data.

Migration sequence:

1. Add `payment_attempts` and a mapping column from legacy transaction ID.
2. Backfill one attempt per historical `payment_transactions` row, preserving order, invoice, amount, status, session, token, timestamps, and raw response.
3. Generate deterministic legacy `attempt_key` and `merchant_request_id` only where absent, marked as legacy-origin metadata.
4. Add parity checks for row counts, order references, amount/status, and gateway identity.
5. Add temporary compatibility reads from attempts with fallback to legacy rows.
6. Cut new writes to `payment_transactions`; all new writes go to `payment_attempts`.
7. Keep a temporary read-only mirror/projection only if an unmodified legacy reader requires it. No permanent dual writable source is allowed.
8. After parity monitoring, migrate remaining readers, mark the table deprecated, and remove only in a later separately approved migration.

The cutover must be reversible at the application-read layer, not by writing conflicting records to both tables.

## 20. Amount Integrity

At attempt creation persist:

```text
expected_amount
currency
line-item snapshot
product prices
quantity
discount
voucher
shipping
payment fee
grand total
```

Before fulfilment:

```text
gateway amount == expected_amount
gateway currency == expected currency
```

Mismatch results in:

```text
settlement_status = paid when DOKU SUCCESS is authoritative
actual_gateway_amount is persisted
verification_status = needs_review
fulfilment blocked
no silent refund duplication
preserved evidence
admin reconciliation required
```

An amount mismatch never erases or hides money that DOKU authoritatively reports as received. It blocks fulfilment until resolved.

## 19. Atomicity and Side Effects

Financial transaction includes:

```text
lock attempt
lock order
validate state and amount
write gateway event/status
claim fulfilment or create refund obligation
project order payment status
create outbox records
commit
```

Notifications, cache invalidation, email, push, and external side effects occur after commit. A durable outbox is required before production; queue dispatch is a delivery mechanism, not financial truth. If queue dispatch fails, the committed outbox record remains retryable.

## 20. Webhook Security

Preserve validation of:

```text
Client-Id
Request-Id
Request-Timestamp
raw body digest
request target
HMAC-SHA256
constant-time comparison
```

Required hardening:

- Preserve exact raw request body for digest.
- Store body digest and validation result.
- Do not rely on timestamp freshness as the only replay defense.
- Do not log secrets or full sensitive payloads.
- Confirm DOKU retry timestamp behavior before changing the 300-second window.
- Keep GET endpoint verification behavior only where required by DOKU.

## 21. Database Guarantees

Required unique constraints:

```text
payment_attempts.attempt_key
payment_attempts.invoice_number
payment_attempts.merchant_request_id
webhook_events.deduplication_key
refund_obligations(payment_attempt_id, reason)
```

Required foreign keys:

```text
payment_attempts.order_id → orders.id
refund_obligations.order_id → orders.id
refund_obligations.payment_attempt_id → payment_attempts.id
```

Indexes:

```text
payment_attempts(order_id, status)
payment_attempts(status, next_reconciliation_at)
payment_attempts(doku_order_id)
payment_attempts(gateway_reference)
webhook_events(invoice_number)
webhook_events(processing_status, next_retry_at)
refund_obligations(status, next_action_at)
```

Do not globally unique-constrain DOKU `session_id` or `token_id` without provider-contract evidence.

## 22. Admin Recovery

Admin must view:

```text
payment attempts
DOKU identities
webhook history
mapped statuses
last reconciliation
amount mismatches
refund obligations
```

Admin actions:

```text
check DOKU status
retry reconciliation
mark/escalate needs_review
start/reject/rollback/complete manual refund
```

All actions use domain services. No direct status bypass is allowed.

## 23. Observability

Metrics:

```text
payment_creation_success_total
payment_creation_failure_total
payment_creation_timeout_total
payment_attempts_pending_age
payment_reconciliation_total
payment_reconciliation_failure_total
webhook_received_total
webhook_duplicate_total
webhook_signature_invalid_total
unknown_gateway_status_total
amount_mismatch_total
late_payment_total
duplicate_success_attempt_total
refund_obligation_pending_age
needs_review_total
```

Alerts:

- Amount mismatch
- Stale pending/unknown attempts
- Reconciliation failure spike
- DOKU timeout/5xx spike
- Invalid signature spike
- Late payment anomaly
- Ageing refund obligations
- Duplicate success anomalies

Ordinary safely ignored duplicate webhooks should not page operators.

## 24. Production Configuration

Deployment must reject:

```text
production with sandbox DOKU URL
production with sandbox credentials
missing DOKU credentials
HTTP callback/notify URL
localhost callback/notify URL
callback domain mismatch
```

Required production values:

```text
DOKU_IS_SANDBOX=false
DOKU_CLIENT_ID set
DOKU_API_KEY set
HTTPS callback URL
HTTPS notification URL
DOKU_CURRENCY=IDR
reviewed enabled methods
```

Secrets remain server-side and outside source control/logs.

## 25. Required Test Matrix

### Happy path

- Checkout and payment creation
- Pending attempt
- SUCCESS webhook
- Order confirmed
- `paid_at` populated
- Outlet notification after commit

### Browser and ordering

- Customer closes browser
- Redirect before webhook
- Webhook before redirect
- Redirect pending
- Redirect DOKU timeout
- PENDING → SUCCESS → PENDING
- SUCCESS → EXPIRED

### Duplicate/concurrency

- Duplicate SUCCESS webhook
- Ten concurrent SUCCESS webhooks
- Webhook/redirect race
- Webhook/reconciliation race
- Duplicate checkout
- Two retry requests
- Two attempts SUCCESS

### Failure/security

- FAILED
- REJECTED
- DENIED
- CANCELLED
- EXPIRED
- Unknown status
- Malformed payload
- Invalid client ID
- Invalid digest
- Invalid signature
- Stale timestamp
- Unknown invoice
- Amount mismatch

### Recovery

- Lost webhook
- Reconciliation success
- DOKU timeout
- DOKU 5xx
- Database failure
- Queue unavailable
- Ambiguous payment creation

### Retry

- A expired, B successful
- A expired, B pending, A late SUCCESS
- A SUCCESS, B SUCCESS
- Historical attempts retained

### Late payment/refund

- Invalid order + SUCCESS
- Duplicate late event
- Obligation uniqueness
- Manual refund start
- Manual refund rejection
- Manual rollback
- Manual completion
- Legacy field projection
- Idempotent backfill

### Regression

- paid cannot become pending/failed/expired
- one fulfilment claim
- no duplicate refund obligation
- legacy refund UI remains functional

## 26. Gap Classification

### P0 — Financial correctness

1. Retry deletes attempts: `app/Http/Controllers/Customer/OrderController.php:294-296`.
2. Cache-only webhook deduplication: `app/Http/Controllers/DokuPaymentController.php:60-74`.
3. Order-level rather than attempt-level state: `app/Services/PaymentStatusService.php:12-47`.
4. Refund lifecycle mixed into payment status: `app/Services/RefundService.php:73-79`.
5. No atomic fulfilment claimant for multiple successful attempts.
6. No verified gateway amount comparison before fulfilment.

### P1 — Reliability and recovery

1. No scheduled DOKU reconciliation: `routes/console.php:13-105`.
2. Ambiguous create timeout can lead to duplicate sessions.
3. Payment creation failure reservation cleanup is not explicit.
4. Webhook processing is synchronous and downstream-failure sensitive.
5. Manual refund state needs canonical obligation persistence.

### P2 — Operations

1. Webhook mapped status is not consistently persisted.
2. Gateway reference/audit fields are incomplete.
3. Admin reconciliation visibility is limited.
4. Queue execution depends on scheduler invocation.
5. Redirect performs blocking sleeps.

### P3 — Hardening

1. Production configuration validation.
2. Redacted structured logging.
3. Provider identifier contract tests.
4. Legacy migration cleanup after parity is proven.

## 27. Acceptance Criteria

1. Every retry creates a new immutable attempt.
2. Previous attempts and payloads remain auditable.
3. Duplicate checkout cannot create duplicate active attempts.
4. Duplicate webhooks produce one durable financial transition.
5. Ten concurrent SUCCESS events produce one fulfilment claim.
6. Redirect never directly marks paid.
7. All status sources use one transition service.
8. DOKU SUCCESS with amount mismatch records settlement as paid, preserves actual amount, blocks fulfilment, and creates review evidence.
9. Aggregate order projection follows explicit precedence across all attempts.
10. Paid cannot regress.
11. Lost webhook is recovered by reconciliation.
11. Create timeout does not blindly create another payment.
12. Late success never fulfils an invalid order.
13. One successful attempt creates at most one refund obligation for a reason.
14. Manual refund state is canonical in `refund_obligations`.
15. Legacy order refund fields remain compatible.
16. Queue/notification failure cannot roll back financial truth.
17. Unknown statuses cannot fulfil or downgrade payment.
18. Production config rejects unsafe provider/environment combinations.
19. Required concurrency and failure tests pass.
20. Admin can recover unresolved payments through shared services.

# FINAL DECISION

```text
APPROVE WITH REQUIRED CHANGES
```

## Required Before Production

- Canonical payment attempts.
- Immutable payment history.
- Durable webhook idempotency.
- Atomic attempt/order transition service.
- Fulfilment claim protection.
- Amount snapshot and verification.
- Scheduled reconciliation.
- Ambiguous create handling with explicit creation state.
- Aggregate order payment projection.
- Canonical `refund_obligations`.
- Durable outbox and retryable dispatcher.
- Idempotent legacy refund backfill.
- Manual refund service migration to obligations.
- Production configuration guards.
- Required transaction/concurrency test matrix.

## Recommended After Production

- Async redirect verification.
- Dedicated queue worker process.
- Rich admin reconciliation dashboard.
- Provider contract tests for identifier guarantees.
- Deprecation cleanup of legacy order refund fields.

## No Change Needed

- Browser redirect remains non-authoritative.
- Existing DOKU HMAC approach remains conceptually valid.
- Existing manual refund business workflow remains.
- Automatic DOKU refund API is out of scope.
- Inventory reservation remains in current order workflow unless payment tests expose a payment-critical defect.
