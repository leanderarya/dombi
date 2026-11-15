# Dombi V1.0 — writer containment checklist

Status: **NO-GO.** Containment cannot be fully demonstrated today. This is the short
operator checklist; phases, detailed procedures, recovery rules and waivers remain in
[V1-MAINTENANCE-RUNBOOK.md](V1-MAINTENANCE-RUNBOOK.md). Nothing here replaces that
document, and nothing here authorizes execution.

Prepared against merged `develop` `10b9efdaa37491740f95cf05a9cdd9ca42127b4e`.

Every claim below was checked against source in this repository. No production access,
SSH, SQL, PHP/Artisan, maintenance activation, scheduler pause, cron change, checkpoint
capture, publisher run or deployment was performed.

## Verdict

| Gate | Status | Basis |
| --- | --- | --- |
| Customer HTTP containment | **UNKNOWN** | in-app gate exists but only applies **after** this release is deployed; the pre-deploy window is uncovered |
| DOKU callback containment | **FAIL** | routes are maintenance-exempt and **write on every request**, including rejected ones |
| Queue worker containment | **PASS (conditional)** | `queue:work --stop-when-empty` is itself a scheduled task, so `schedule:pause` stops new drains; an in-flight one must still be observed to exit |
| Scheduled command containment | **PASS (conditional)** | `schedule:pause` is DB-cache-backed and covers all 15 tasks; no task opts out with `evenInMaintenanceMode`/`evenWhenPaused` |
| In-flight request containment | **UNKNOWN** | no request-drain measurement exists; DB-backed sessions also write on ordinary GETs |
| External process containment | **UNKNOWN** | sibling `apidombi` app shares the account and uses a different DB; scope unverified |
| Fresh checkpoint | **FAIL** | none captured; tool and lock are provisioned, but capture needs a signed approval |
| Zero-writer guarantee | **FAIL by design** | no mechanism in this repo can prove zero writers |

**Writer-containment readiness: FAIL.** Two writer classes cannot be held with the
controls that exist today (DOKU callbacks, and admission during the pre-deploy window).

## Writer-by-writer matrix

| # | Writer class | Containment method | Observable evidence | Residual risk | Mandatory STOP |
| --- | --- | --- | --- | --- | --- |
| W1 | Customer HTTP: browsing, cart, sessions | `CheckCustomerAdmission` (`ADMISSION_CUSTOMER_CHECKOUT=held`) blocks the 5 checkout/order/pay routes; `artisan down` blocks everything else | `POST /customer/checkout` → 503 JSON `admission_held`; `/` → 503 while down | DB-backed sessions (`SESSION_DRIVER=database`) mean ordinary GETs still write `sessions`; gate is config-cache dependent | gate not `held`, or config cache not rebuilt, or checkout returns non-503 |
| W2 | **DOKU callbacks** (`/payment/doku/notify`, `/payment/doku/redirect`) | **None available.** Both are in `preventRequestsDuringMaintenance(except: […])`, so `artisan down` does not stop them. They must stay up for in-flight payments | `POST …/notify` without `Request-Id` → 400 (proves route executed, not 503) | **Writes on every request**: a `payment_webhook_logs` row is created *before* signature verification, and even a rejected call signs an observability row via `PaymentObservabilityService::event()` | callback stops being reachable (in-flight payments break) **or** an unpersisted callback is ever acknowledged 2xx |
| W3 | Queue workers | `schedule:pause` stops the cron-invoked `queue:work --tries=3 --stop-when-empty`; there is **no daemon/Horizon** in this repo | `queue-work.log` mtime stops advancing; no `processing` claims newer than 5 min | an already-running `--stop-when-empty` child finishes its batch; jobs already reserved may still execute | a worker still running after 2 intervals |
| W4 | Scheduled commands (15 tasks) | `schedule:pause` → `illuminate:schedule:paused` in the **DB cache** (`CACHE_STORE=database`) | cron output mtimes still advancing while `laravel.log` gains no `orders:expire-pending completed` | pause flag is a DB write itself; if the DB is mid-change the flag may be unreadable; `payments:reconcile-doku` may be inside a DOKU HTTP call | scheduled work resumes after 2 minutes, or flag unreadable |
| W5 | In-flight HTTP requests | `artisan down` rejects **new** requests only | none available; no request-drain instrumentation | requests already executing continue to completion and may write | cannot state when the last in-flight request finished |
| W6 | External: `apidombi` sibling app | out of scope of every control here | none | different DB, same account; independent writers unaffected by this window | sibling app is in scope but not contained |
| W7 | Operator/CLI actions (you) | procedural | run record | a manual SQL/Artisan step bypasses all of the above | any unrecorded manual action |

## Exact containment sequence

Order matters: pause producers before rejecting their work, and never let a producer
resume into a half-closed window.

1. **Record baseline (read-only).** `/up` = 200, log mtimes, and the operator's existing
   read-only DB counts (`payment_webhook_logs` by status, `payment_outbox_events` pending,
   `payment_attempts` in `created|pending|unknown`). No SQL is authored here.
2. **Hold new customer checkout.** Set `ADMISSION_CUSTOMER_CHECKOUT=held` **and rebuild the
   config cache**. Verify `POST /customer/checkout` → 503.
3. **Pause the production scheduler.** `php artisan schedule:pause`. Verify the paused flag
   and confirm the **production** cron entry keeps firing `schedule:run` while executing
   nothing.
4. **Drain.** Poll every 60 s for ≥3 clean intervals: cron mtimes advancing, no new
   scheduled-command log entries, `queue-work.log` static, no `processing` claim newer than
   5 min.
5. **Enter maintenance mode.** `php artisan down --retry=15`. Verify `/` → 503 and `/up` →
   200.
6. **Verify containment** against the matrix above before any checkpoint.
7. **Apply the recorded DOKU disposition** (see below). Policy is decided — intake stays
   open — but the pre-window inventory, the external DOKU export and the `created` sweep
   remain mandatory gates.

### DOKU disposition — FINAL POLICY

**Decision (a) — keep intake open.** DOKU callbacks cannot be paused by anything in this
repository: both routes are exempt from maintenance (`bootstrap/app.php`
`preventRequestsDuringMaintenance(except: ['up','payment/doku/notify','payment/doku/redirect'])`)
and are never behind the admission gate (`routes/web.php:204-205`). Edge rejection
(option b) requires a provider capability that has **not** been established, so it is
unavailable and must not be improvised.

The policy for a code-only window is therefore:

| Rule | Requirement |
| --- | --- |
| Safe ingestion while healthy | Callbacks keep landing and are processed normally while Laravel boots and the DB is reachable. |
| Never acknowledge unpersisted | A notification is only acknowledged after its `payment_webhook_logs` row is committed. `DokuWebhookIngressService::receive()` returns `503` when persistence fails and `500` on an unhandled failure; it never returns 2xx for an unpersisted callback. |
| Fail closed on ambiguity | `400` (missing `Request-Id`), `401` (bad signature), `409` (body conflict) and `422` (historical row) are rejections, not success. |
| Retries are recovery, not delivery | DOKU retry/resend is an optional recovery channel. Its semantics are **unevidenced** in this repository. Never treat "DOKU will retry" as assurance that an event arrived. |
| Accepted cost | The window is **not** zero-writer. Each callback writes a `payment_webhook_logs` row and may write an observability row plus a log line. That is an accepted, recorded risk — see matrix row W2. |
| Reachability is required | If `/payment/doku/notify` stops being reachable, **STOP**: in-flight payments can no longer be confirmed. |

`GET /payment/doku/redirect` must **not** be used as an operator reconciliation tool during
or after the window. It is a customer-facing browser return path that creates a
`payment_webhook_logs` row before calling DOKU and accepts a caller-supplied
`invoice_number` query parameter. Using it to force a status check would be an unapproved
production write triggered by an unauthenticated request, so it is prohibited here.

`php artisan doku:mark-paid` is **prohibited** in this window. It writes
`payment_transactions.status = 'paid'` and synthesizes a `SUCCESS` payload
(`app/Console/Commands/DokuMarkPaid.php:60-64`) with **no DOKU verification whatsoever**.
Using it to "close" an unresolved attempt would fabricate a payment that may never have
occurred, and it is not a reconciliation shortcut.

## Pre-window payment inventory

Record this **before** closing checkout. It is the baseline every post-window comparison
depends on, and it must be captured read-only through the operator's existing DB session.
No SQL is authored here.

**1. Non-final attempts — every state, not just the reconcilable ones.**

| `creation_state` | Why it matters |
| --- | --- |
| `initiated` | Payment creation started but the customer never received a URL. Not selected by `payments:reconcile-doku`, never expired, no deadline. |
| `created` | A DOKU invoice exists. **Neither the scheduled job nor the reconciliation service will process it** — `ReconcileDokuPayment.php:25` and `DokuReconciliationService.php:20` both accept only `pending`/`unknown`. |
| `pending` | Standard awaiting-callback state; automatically reconciled. |
| `unknown` | Ambiguous creation; automatically reconciled until its retry budget or deadline is exhausted. |
| `failed` | Terminal, but may still carry an unpaid DOKU invoice. |
| legacy (non-`DMB1` invoice) | **Unrecoverable by code**: both `checkStatus()` and `reconcilePaymentAttempt()` reject a non-`DMB1` namespace (`DokuService.php:236,605`). Track manually or declare out of scope in writing. |

For each row record: `id`, `order_id`, `invoice_number`, `merchant_request_id`,
`creation_state`, `settlement_status`, `created_at`,
`metadata.reconciliation_deadline_at`, `metadata.reconciliation_attempts`.

**2. Supporting counts:** `payment_webhook_logs` grouped by `status`
(`received`, `processing`, `processed`, `retryable`, `signature_invalid`, `rejected`),
pending `payment_outbox_events`, and related orders (`order_code`, `status`,
`payment_status`, `paid_at`, `confirmation_expires_at`, `total`).

**3. Money and stock baseline:** `outlet_payables` (`type='sale'`) count and sum,
`stock_movements` (`order_completed`) count, `refund_obligations` by status.

**4. External baseline (mandatory, not available from this repository):** export the DOKU
transaction list for the window from the merchant dashboard or settlement report. This is
the only source that can prove no payment exists without a local row. **If this export
cannot be obtained, the window is NO-GO** — the local tables prove identification, never
detection.

## Created-invoice verification (manual, `DMB1` only)

`created` attempts are invisible to automation, so they must be checked by hand. The
procedure is manual comparison against DOKU evidence — **never** a forced status write.

1. Take each `DMB1…` `created` invoice from the pre-window inventory.
2. In the DOKU merchant dashboard or settlement report, locate the transaction by the
   **exact invoice number** sent as `order.invoice_number`.
3. Compare and record side by side: **invoice number** (exact string match), **amount**
   (equal to `payment_attempts.amount_snapshot`, same currency), and **payment status**
   (paid / pending / expired / failed as DOKU reports it).
4. Record the provider reference (`transaction.original_request_id` or `transaction.id`)
   next to the local `gateway_transaction_id` when present.
5. Classify each invoice as **PAID-UNRECORDED**, **PENDING**, or **NOT-PAID**, and add it
   to the private unresolved-invoice tracker.
6. For **PAID-UNRECORDED**, the only correct action is a **separately authorized**
   remediation decision. Do **not** write paid status by hand and do not use
   `doku:mark-paid`.

If DOKU cannot resolve an invoice at all, mark it **UNKNOWN**. An unresolved invoice is
never treated as "probably unpaid".

## Post-window reconciliation

Run after reopening and record every number:

1. Repeat the pre-window inventory (attempts by state, webhook counts, outbox, money and
   stock totals).
2. **Invoice reconciliation:** every invoice in the DOKU export must match exactly one
   local `payment_attempts.invoice_number`, and that attempt's `settlement_status` must be
   terminal (`paid`, `failed` or `expired`) — not `pending` or `unknown`.
3. **Unresolved-invoice tracker:** every non-terminal attempt and every legacy invoice must
   appear with a disposition and an owner. No silent leftovers.
4. **`created` sweep:** every `created` attempt either has a recorded DOKU verdict from the
   procedure above, or is explicitly logged as not-yet-queried.
5. **Webhook residuals:** `payment_webhook_logs` with `status='retryable'` must be zero, or
   each must have a documented substitute query.
6. **Outbox:** pending `payment_outbox_events` must drain to zero (or be explained).
7. **Duplicate-payment protection:** confirm no invoice produced two effects. The guards
   are a unique `request_id`, the `body_digest` conflict check, claim tokens, monotonic
   `settlementRank`, the fulfilment CAS on `fulfilment_claimed_at`, and the unique outbox
   `event_key`. A duplicate callback surfaces as `duplicate_paid_attempt` plus a
   `refund_obligations` row, never as a second stock or payable effect. Any second charge
   still requires a refund decision.
8. **Escalation:** any PAID-UNRECORDED, any duplicate effect, any invoice missing from
   local records, or any `retryable`/`unknown` older than the merchant's retry deadline is
   an **incident**. Freeze new payment creation, preserve invoice/attempt IDs and redacted
   DOKU evidence, and escalate to the merchant contact. Never replay callbacks en masse,
   never force status, never refund twice.

**Never** treat these as proof of payment: a browser redirect, a success screen, a
screenshot, a DOKU retry, or an operator memory.

## Minimum read-only evidence before checkpoint capture

All of the following must be recorded. Any blank field fails the gate.

| Evidence | Source |
| --- | --- |
| `/up` → 200 during maintenance | `curl` |
| `/` → 503 (ordinary customer path closed) | `curl` |
| `POST /payment/doku/notify` → 400, **not** 503 and not 2xx | `curl` |
| Scheduler paused flag readable; cron mtimes advancing | `artisan schedule:list`, `ls -l ~/.logs/cronjob_*` |
| No new scheduled-command log entries for ≥3 intervals | `laravel.log` timestamps |
| `queue-work.log` static; no `processing` claim < 5 min old | log mtime + operator DB counts |
| Money counts equal the recorded baseline | operator read-only DB session |
| Admission gate actually `held` with cache rebuilt | config + a live 503 probe |
| Writer-drain, callback-hold, runtime-identity, schema, preservation, capacity, authority references | the 8 `EVIDENCE` fields the checkpoint approval requires |

The checkpoint tool's approval already demands all 8 `FLAGS` true and all 8 `EVIDENCE`
references non-empty. Two of those — `doku_callback_delivery_safely_held` and
`workers_drained` — cannot be honestly set true under the current controls. That, not
tooling, is why capture is blocked.

## Reopen procedure

1. `php artisan up`; verify `/up` → 200 and `/` → 200.
2. `php artisan schedule:resume`; verify the next cron tick logs scheduled work.
3. Observe 15 minutes: queue drains, `reconcile-doku` reports cleanly.
4. Reconcile the DOKU ledger (or the accepted intake rows) against merchant records.
5. Set `ADMISSION_CUSTOMER_CHECKOUT=open` and rebuild the config cache; verify checkout
   works again.
6. Watch 30 minutes (extend to 2 h on any anomaly).

## Abort procedure

- **Before any mutation:** nothing changed; resume the scheduler if it was paused, restore
  admission, record the reason.
- **After maintenance mode, before publication:** `artisan up`, `schedule:resume`, restore
  admission, record. No code changed, so this is a clean reversal.
- **After publication:** keep admissions closed and the scheduler paused. Do **not** roll
  back the database. Preserve the checkpoint, journals and logs; restore prior code only
  from the verified checkpoint under separate approval.
- Any unexplained payment or stock row: open an incident, preserve all logs, never replay
  payments en masse.

## Provable prerequisites vs owner acceptance

**Provable today (verified in source):** admission gate behaviour and exact gated routes;
maintenance exception list is exact-path and wildcard-free; `schedule:pause` is DB-cache
backed and all 15 tasks are covered with no opt-outs; queue is cron-driven with no daemon;
DOKU routes persist before verification and write on rejection; checkpoint tool digest
`edc305160fe9a298507a3e8538a92a426858e8a7b0439290692314138fc06933` and the shared lock are
provisioned.

**Requires explicit owner acceptance (cannot be proven here):** that the window is not
zero-writer (DOKU intake plus DB-backed sessions); that no in-flight request is writing at
the moment of publication; that `apidombi` is out of scope; that DOKU retry/resend will
cover any rejected callback; that no provider-level maintenance toggle exists. None of
these may be asserted as guarantees.

## Remaining blockers

1. **DOKU pre-window inventory and external export not yet captured** — the disposition is
   decided (intake stays open), but the non-final attempt inventory (including `created`,
   `initiated` and legacy) and the DOKU transaction export are still required, and the
   window is NO-GO without the export.
2. **No fresh checkpoint** and **no signed publication approval** — `doku_callback_
   delivery_safely_held` and `workers_drained` cannot honestly be true.
3. **Pre-deploy admission window uncovered** — the gate only after deploy.
4. **Cron target paths unconfirmed** — two entries; which targets `public_html/app` is
   unproven.
5. **Sibling `apidombi` scope unverified.**

## Smallest safe next action

Confirm from the Hostinger panel which cron ID targets `public_html/app` (gate W4/blocker 4).
It is read-only, needs no provisioning, and it can invalidate the whole containment plan if
it is wrong. Immediately after that, obtain the DOKU transaction export that the
reconciliation procedure depends on.
