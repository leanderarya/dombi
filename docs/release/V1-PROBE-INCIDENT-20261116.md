# Incident record — DOKU redirect probes wrote two rejected webhook rows

Date: 2026-11-16 (UTC). Host: `dombi-prod`, account `u399215191`,
root `/home/u399215191/domains/dombicenter.com/public_html/app`.
Deployed release: `334637a9e8cd2ba639c557e4be80d4a19fdfc92d` (unchanged by this incident).

Status: **writes occurred; retained as audit evidence; production unaffected.**

## What happened

During read-only verification of production cache state, two probes were issued against
`/payment/doku/redirect` using `curl -I` (i.e. `HEAD`). The route is registered as
`Route::match(['get', 'post'], '/payment/doku/redirect', …)`, and Laravel routes `HEAD`
requests to the `GET` handler. The controller therefore executed and wrote a
`payment_webhook_logs` row on each probe.

The earlier `PUT /payment/doku/notify` probes (expect `405`) were safe: the router
rejected the method before reaching the controller, so nothing was written.

## Rows created

```
total = 2
id=1  2026-11-16 03:44:44  source=redirect  status=rejected  invoice_number=NULL
id=2  2026-11-16 03:49:40  source=redirect  status=rejected  invoice_number=NULL
```

Both rows are `status='rejected'` with `invoice_number=NULL`: no invoice was matched, no
signature was accepted, and no payment state was touched.

## Blast radius — verified zero on money and orders

| Table | Rows created by these probes |
| --- | --- |
| `orders` | 0 |
| `payment_attempts` | 0 (table total `0`, none updated in the window) |
| `customers` | 0 |
| `payment_webhook_logs` | **2** (the rows above) |

No checkout, order, payment-initiation or notify endpoint was executed. No admission
state, scheduler state or `.env` was changed.

## Decision — retain, do not delete

The two rows are **preserved as audit evidence**. They are not deleted, edited or
suppressed:

- deleting them requires a SQL write that no authorization covers;
- an audit trail of a self-inflicted write is more valuable than a clean-looking table;
- they are inert: `rejected` + `invoice_number=NULL` is not selected by any
  reconciliation path, and does not represent a payment.

Any future cleanup requires its own explicit authorization and must be recorded here.

## Rule adopted

**Never probe production DOKU or payment endpoints with `HEAD`, `GET` or `POST`.**
Both DOKU routes are excluded from maintenance mode and write on every request: a
`payment_webhook_logs` row is created *before* signature verification, and even a
rejected call signs an observability row. `HEAD` is not a safe read-only verb here
because it is routed to `GET`.

The only accepted reachability probe is a method the route does not accept, which the
router rejects without executing the controller:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X PUT \
  https://app.dombicenter.com/payment/doku/notify      # expect 405, never 503
curl -s -o /dev/null -w '%{http_code}\n' -X PUT \
  https://app.dombicenter.com/payment/doku/redirect    # expect 405, never 503
```

`405` proves the route exists and is not maintenance-blocked, with zero database writes.
Never probe `/checkout`, `/orders`, `/customer/orders/*/pay` or any payment-initiation
route at all.

## Documentation correction

`V1-MAINTENANCE-RUNBOOK.md` previously instructed
`curl -X POST https://app.dombicenter.com/payment/doku/notify  # expect 400`. That
instruction is unsafe for the same reason: it reaches the controller and writes a row.
It has been replaced by the `PUT`/`405` form above, and a standing rule now prohibits
direct DOKU/payment probes.

## Relationship to cache preparation

This incident is independent of the 2026-11-16 cache preparation and does not affect its
outcome. It is recorded here because it establishes the probe rule that all later phases
must follow.
