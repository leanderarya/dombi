# Dombi Launch Delivery Design

**Date:** 2026-07-27
**Status:** Approved for planning
**Target:** First production launch

## Objective

Support pickup and delivery from one outlet on launch day while keeping delivery
operations simple enough for a solo developer to verify and operate.

Delivery supports both Dombi couriers and external Gojek/Grab couriers. Assignment
is always manual. Payment is online-only.

## Launch Constraints

- One active outlet.
- Customer address must be inside a configured service zone/radius.
- Customer delivery fee is fixed by that zone/radius.
- No COD.
- No automatic courier selection.
- No dynamic courier pricing or courier API integration.
- No live GPS tracking, route optimization, or multi-stop delivery.
- Courier shift, invitation, and approval are not launch dependencies.

## Roles and Authority

### Customer

- Selects pickup or delivery.
- Provides a valid delivery address.
- Sees the fixed delivery fee before payment.
- Pays online before fulfillment begins.
- Tracks order and delivery status.

### Outlet Operator

- Processes paid orders.
- Selects a Dombi courier or records Gojek/Grab details manually.
- Records the actual external courier cost.
- Updates external deliveries to completed, failed, or returned.
- Cannot assign a courier belonging exclusively to another outlet.

### Dombi Courier

- Sees only deliveries assigned to them.
- Manually confirms pickup, delivery start, completion, failure, or return.
- Does not use live GPS tracking in the launch scope.

### Owner

- Configures delivery zones/radii and fixed customer fees.
- Monitors orders, delivery outcomes, and external courier costs.
- Handles exceptions and financial reconciliation.

## Customer Flow

1. Customer selects delivery and provides an address.
2. The system validates the address against configured service zones/radii.
3. The system shows the fixed delivery fee.
4. The system validates stock and creates the order.
5. Customer pays online.
6. A verified payment moves the order into outlet fulfillment.
7. An unpaid order cannot be assigned or dispatched.

Addresses outside the service area are rejected before payment.

## Outlet Assignment Flow

After the order is paid and prepared, the operator selects one path.

### Dombi Courier

1. Operator selects an eligible Dombi courier.
2. The system records courier identity, assigning operator, and timestamp.
3. The courier sees the assigned task.
4. The courier updates the lifecycle manually.

### Gojek/Grab

1. Operator selects the external provider.
2. Operator records courier identity or order reference when available.
3. Operator records the actual external courier cost.
4. The operator controls the lifecycle based on manual confirmation.

External couriers do not receive a Dombi account or application access.

## Delivery Lifecycle

```text
ready → assigned → picked_up → delivering → completed
                                          ↘ failed → returned
```

Rules:

- Only paid orders can enter `assigned`.
- Assignment must not create duplicate delivery records.
- A Dombi courier can mutate only their assigned delivery.
- An external delivery can be mutated only by an authorized outlet operator or owner.
- Terminal transitions record actor identity and timestamp.
- `failed` and `returned` require a reason.
- Reassignment after pickup requires an explicit recovery action.

## Pricing and Financial Data

Two values remain separate:

1. **Customer delivery fee:** calculated from the zone/radius and frozen before payment.
2. **Actual external courier cost:** entered after booking Gojek/Grab.

Changing actual courier cost must never change the amount already charged to the
customer. The difference is operational margin data, not a payment adjustment.

## Failure Handling

| Failure | Required behavior |
|---|---|
| Address outside service area | Reject before payment |
| Payment pending/failed | Do not allow assignment |
| Dombi courier unavailable | Select another eligible or external courier |
| External booking unavailable | Keep order ready and contact customer manually |
| Delivery failed | Record reason and prevent silent completion |
| Return to outlet | Record timestamp and require reconciliation |
| Duplicate request | Do not duplicate assignment, status effects, or financial records |

## Security and Data Invariants

1. Users cannot read or mutate deliveries outside their authority.
2. Customer delivery fees are calculated by the server.
3. Actual courier cost is editable only by authorized internal roles.
4. Paid amount, delivery fee, and external cost remain independently auditable.
5. Every status mutation records actor and time.
6. Illegal or repeated state transitions fail safely.
7. Customer address and contact data are exposed only to fulfillment roles.

## Required Test Matrix

### Automated

- Address inside/outside configured zone.
- Server-side fixed fee calculation and client tampering rejection.
- Unpaid order assignment rejection.
- Manual Dombi courier assignment and ownership.
- Manual external courier creation with actual cost.
- Duplicate/concurrent assignment protection.
- Legal and illegal lifecycle transitions.
- Courier and outlet authorization boundaries.
- Completed, failed, and returned audit data.
- Actual external cost cannot mutate the paid customer amount.

### Staging Smoke

1. Paid delivery completed by a Dombi courier.
2. Paid delivery completed through Gojek/Grab by an outlet operator.
3. Failed Dombi delivery.
4. Failed/returned external delivery.
5. Address outside service radius rejected.
6. Payment pending cannot be dispatched.

## Explicitly Deferred

- Automatic courier assignment.
- Live GPS tracking and customer-facing live map.
- Route optimization and multi-stop routing.
- Dynamic delivery pricing.
- Gojek/Grab API integration.
- COD and courier cash reconciliation.
- Courier shift and availability automation.
- Courier invitation, nomination, and approval as launch requirements.
- Multi-outlet courier allocation.

## Launch Acceptance Criteria

The delivery slice is ready only when:

- the automated matrix is green in reproducible CI;
- both Dombi and external staging journeys pass;
- authorization and duplicate assignment tests pass;
- payment, customer fee, and external cost reconcile;
- failed and returned deliveries have an operator recovery procedure;
- monitoring exposes failed jobs, scheduler state, and application errors;
- the runbook identifies who handles delivery exceptions.
