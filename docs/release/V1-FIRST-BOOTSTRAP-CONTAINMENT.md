# V1.0 first-bootstrap publication — executable containment procedure

Status: **GO-WITH-MITIGATION — PROCEDURE COMPLETE, NOT AUTHORIZED FOR EXECUTION.**
Owner risk acceptance is recorded in §9. This document still authorizes nothing: every
step is gated by a STOP condition and a separate owner authorization. Production
publication remains on **HOLD**.

Scope: the *first* installation of the admission-bootstrap artifact onto production
`334637a9`, where the deployed code has **no** maintenance exceptions and **no**
admission gate. This is a one-time procedure; after this release is installed the
constraints in §7 no longer apply.

Verified inputs (do not re-derive):

| Input | Value |
| --- | --- |
| Production release | `334637a9e8cd2ba639c557e4be80d4a19fdfc92d` |
| Production DB | `u399215191_dombi_pr_1023` |
| Candidate artifact | `14170454946` |
| Candidate application SHA | `d4b018b06cd5915ce8a88fa1277e6007e479640b` |
| Candidate archive SHA-256 | `5094f82b4be5a59308322475883601304ea0cc862af45f255e30ebb5c9084adf` |
| Checkpoint tool / lock | provisioned, verified 2026-11-15 |
| Production caches | `config.php` + `routes-v7.php` **ACTIVE** |
| Routes | 308, method/URI/middleware unchanged |

---

## 1. Why `artisan down` is not used here

On the deployed code `PreventRequestsDuringMaintenance` is global and the application
registers **no** `except` list:

```
$ grep -c preventRequestsDuringMaintenance bootstrap/app.php   # on 334637a9
0
```

`health: '/up'` is registered without exempt middleware. So `artisan down` on the *old*
code returns the maintenance response for **`/up`**, **`/payment/doku/notify`** and
**`/payment/doku/redirect`**. That converts a code-swap into a DOKU intake outage plus a
lost health signal, for a window with no durable record of what was dropped.

The exceptions that would narrow this are introduced **by this very release**, so they
cannot protect their own installation. This is the bootstrap paradox, and this procedure
resolves it by not entering maintenance mode at all.

**Standing rule 2 of `V1-MAINTENANCE-RUNBOOK.md` ("Never run `php artisan down`") is
binding here.** §P3.2 of that runbook is available only *after* this release is deployed.

---

## 2. Writer inventory — what can be paused, what cannot

| Writer | Control available on deployed code | Decision |
| --- | --- | --- |
| Scheduled commands (15 events) | `php artisan schedule:pause` (DB-cache flag) | **PAUSE** |
| Queue workers (`queue:work --stop-when-empty`) | the worker is *invoked* by cron as a scheduled task, so `schedule:pause` prevents **new** invocations. It does **not** stop or signal an already-running child: `SchedulePauseCommand` only writes a cache flag, and `--stop-when-empty` exits on its own when the queue drains | **NO NEW DRAIN — observe existing child exit** |
| Customer HTTP browsing / sessions | none that is safe (see §1) | **REMAIN LIVE** |
| **Customer checkout / order / payment initiation** | none on deployed code — `CheckCustomerAdmission` does not exist yet, `ADMISSION_CUSTOMER_CHECKOUT` has no reader | **REMAIN LIVE — this is the accepted risk** |
| **DOKU `/payment/doku/notify`** | none; must stay reachable | **REMAIN LIVE — must not be interrupted** |
| **DOKU `/payment/doku/redirect`** | none; writes on every request | **REMAIN LIVE** |
| Session writes (`SESSION_DRIVER=database`) | none | **REMAIN LIVE** (ordinary GETs write) |
| Runtime logs (`storage/logs/`) | none; tolerated by publisher `volatile_policy` | **REMAIN LIVE** (append-only allowance) |
| **Laravel caches** (`config.php`, `routes-v7.php`) | must be *preserved*, not paused | **PRESERVE — invariant** |

Two writer classes are **structurally uncontrollable** without new infrastructure:
customer checkout and DOKU callbacks. No in-repo mechanism can hold either on `334637a9`.
Do not assume DOKU retries: retry/resend semantics are **unevidenced** in this repository
(`V1-WRITER-CONTAINMENT.md`). Do not assume store-closing hours reduce traffic — that is
a business assumption, not an engineering control.

---

## 3. Why this risk is bounded (the justification for GO-with-mitigation)

The candidate's runtime delta against production is **four files**:

```
app/Http/Middleware/CheckCustomerAdmission.php   (new)
config/admission.php                             (new)
bootstrap/app.php                                (+17: one use, one alias, exceptions block)
routes/web.php                                   (5 route bindings)
```

Everything on the DOKU and payment-critical path is **byte-identical** to production:

```
app/Services/DokuWebhookIngressService.php
app/Http/Controllers/DokuPaymentController.php
app/Models/PaymentWebhookLog.php
app/Services/PaymentObservabilityService.php
app/Services/DokuService.php
=> git diff 334637a9 d4b018b0 -- <above>   # empty
```

And critically: **with both caches preserved, the swap is invisible.** `RouteServiceProvider`
loads `routes-v7.php` and never evaluates `routes/web.php`; `LoadConfiguration` loads
`config.php` and never reads `config/*.php`. Publication therefore changes no reachable
behaviour until a cache rebuild is deliberately performed.

Bounded exposure, stated plainly:

- **Failure mode** if the publisher dies mid-way: the five admission-gated routes may
  return `500` until the class file lands, because `routes/web.php` would be re-evaluated
  only after a cache rebuild — which this procedure does **not** run during the swap.
  `/up` and both DOKU routes stay `200`/`400`-class throughout.
- **Duration** of any intermediate state: file-level `os.replace` per file, ~27 ms each,
  four files.
- **Reversibility**: yes — see §8 rollback.
- **Money/order integrity**: no schema change, no migration, no DOKU code change, no
  payment-state mutation by publication. Publication writes only the four managed files.

**Residual risk that cannot be engineered away:** a customer can complete a *new* checkout
during the swap window, because admission does not exist on the old code. This is a
bounded, non-destructive exposure: orders created during the window are normal orders
handled by unchanged code. It is not data loss and it is not money loss — but it is real
and must be accepted explicitly (§9).

---

## 4. Preflight — all read-only, no mutation

Record every value. A blank field is a failed gate.

| # | Check | Command / source | Gate |
| --- | --- | --- | --- |
| A1 | Host + account | `hostname && id -un` | `id-dci-web1981…` / `u399215191` |
| A2 | Deployed SHA | `cat public/build/RELEASE_SHA` | `334637a9e8cd2ba639c557e4be80d4a19fdfc92d` |
| A3 | DB identity | `config('database.connections.mysql.database')` via a read-only artisan tinker call | `u399215191_dombi_pr_1023` |
| A4 | Caches present | `ls -l bootstrap/cache/{config.php,routes-v7.php}` — **record size + mtime + sha256** | both present |
| A5 | Cache invariants | `configurationIsCached()` and `routesAreCached()` | both `true` |
| A6 | Route inventory | `php artisan route:list --json` → count + `method+uri+middleware` digest | `308`; digest recorded |
| A7 | `/up` | `curl -sS -o /dev/null -w '%{http_code}\n' https://app.dombicenter.com/up` | `200` |
| A8 | DOKU reachability (**no controller execution**) | `curl -X PUT https://app.dombicenter.com/payment/doku/notify` | `405` |
| A9 | Payment inventory | operator read-only DB session: counts of `payment_attempts` by `creation_state` (`created`, `initiated`, `pending`, `unknown`, legacy) | recorded |
| A10 | **DOKU transaction export** | external provider export covering the window | **NO-GO without it** |
| A11 | Scheduler heartbeat | `cronjob_*.log` mtimes + `laravel.log` recent scheduled entries | advancing |
| A12 | Admission files absent | `config/admission.php`, `CheckCustomerAdmission.php` | both absent (confirms old code) |

> **Probe rule (binding).** Never use `HEAD`, `GET` or `POST` against
> `/payment/doku/notify`, `/payment/doku/redirect`, or any checkout/order/payment route.
> `HEAD` is routed to the `GET` controller. On `/payment/doku/redirect` the controller
> executes `PaymentWebhookLog::create(...)` **unconditionally** on every request, before
> any validation, then marks it `rejected`. On `/payment/doku/notify` the row is written
> only after signature verification, but a request still triggers
> `PaymentObservabilityService::event(...)`. `PUT` → `405` is the only zero-write probe:
> the router rejects the method before the controller runs. See
> [V1-PROBE-INCIDENT-20261116.md](V1-PROBE-INCIDENT-20261116.md).

**STOP** if any of: host/account mismatch · SHA unexpected · DB mismatch · either cache
missing or changed unexpectedly · route count ≠ 308 or middleware digest drifted ·
`/up` ≠ 200 · DOKU `PUT` ≠ 405 · payment inventory unobtainable · **no DOKU export** ·
admission files already present.

---

## 5. Caches are an invariant, not a step

Publication **must not** add, replace or remove `bootstrap/cache/config.php` or
`bootstrap/cache/routes-v7.php`. They are protected generated cache, outside the artifact
payload. Record `sha256` + `mtime_ns` of both before (§4 A4) and after (§7 V3).

If either changes during publication, **STOP** and escalate — do not "fix" it by
rebuilding, because a rebuild is the activation step and must be deliberate and verified.

**This invariant holds after a partial failure too.** If publication dies mid-way,
`bootstrap/cache/config.php` and `routes-v7.php` must be **left exactly as they were**.
Do not clear, rebuild, or delete them as part of triage — they are the only reason the
application is still serving consistent routes and configuration from unchanged cached
code. Clearing them would force `routes/web.php` and `config/*.php` to be re-evaluated
against a half-replaced tree, which is strictly worse than the failed state.

---

## 6. The sequence

Two clocks are in play and they must not be conflated:

- **Scheduler-drain observation**: ≥3 consecutive scheduled intervals, using
  `orders:expire-pending` (`everyMinute()`) as the heartbeat ⇒ 3 intervals ≈ 3 minutes
  minimum. This proves **only** that the scheduler is no longer dispatching work. It is
  **not** evidence that the queue is quiescent, and it must not be described as such:
  `schedule:pause` prevents new `queue:work` invocations but cannot stop a child that is
  already running, and jobs already reserved may still execute.
- **Checkpoint + approval freshness**: capture must complete within 15 minutes of
  publication, and the approval must be issued no more than 15 minutes before, with
  `expires_utc ≤ issued + 15 min`. These two clocks overlap, so the drain observation
  must happen **before** the checkpoint, not inside the 15-minute fuse.

If the 15-minute fuse lapses, **discard and restart from step 4**. Never extend an
approval.

### Stage 1 — Bind the artifact (repository change, separate authorization)

1. **Owner authorization A-1.** Merge/publish the repin so the production tool's
   `CANDIDATE` equals `14170454946` / `d4b018b0…` / `5094f82b…`.
   The repin is already committed on `docs/v1-release-docs-and-pin-20261116`
   (`c32cc581`); it is **not** on `develop` and **not** on the host.
   *Note: repinning invalidates every existing checkpoint manifest, because `candidate`
   is embedded in the manifest and compared on load and at authorize time. This is by
   design.*

### Stage 2 — Contain writers (state-changing, authorization A-2)

2. **Owner authorization A-2** for the maintenance window, explicitly scoped to:
   `schedule:pause`, drain observation, checkpoint capture, signed approval, artifact
   publication, cache rebuild, verification, `schedule:resume`. **No `artisan down`.**
   **No migration.** **No `.env` change.**

3. Pause the scheduler:
   ```bash
   php artisan schedule:pause      # writes illuminate:schedule:paused = true (DB cache)
   ```
   Evidence: `schedule:list` reflects paused; flag readable.

4. Observe **three consecutive clean intervals (~3 min)** as *scheduler-drain* evidence.
   All three scheduler criteria must hold across the three intervals:
   - `cronjob_*.log` mtimes stop advancing for scheduled-command output;
   - no new `orders:expire-pending completed` entries in `laravel.log`;
   - no scheduled task starts while the pause flag is set (a task that starts anyway is
     an immediate STOP — nothing opts into `evenWhenPaused()`).

   **STOP** if the pause flag is unreadable, or any scheduled task starts after the pause.

   **Queue is a separate, weaker check.** `schedule:pause` cannot stop a running child, so
   treat the queue as *observed*, not *proven quiescent*:
   - `queue-work.log` mtime static for the same three intervals;
   - no `processing` claim newer than 5 minutes.

   **STOP** if a `processing` claim is newer than 5 minutes. An already-running
   `queue:work --stop-when-empty` child finishing its current batch is expected: it exits
   on its own when the queue drains. Record its exit; do not kill it. A *new* drain
   starting is not acceptable and is a STOP.

   State the residual honestly in the evidence record: after three clean intervals the
   scheduler is drained, but **the queue is not provably idle**. Reserved jobs may still
   execute against replaced code — that is an accepted, recorded risk (§9), not a gate
   that has been satisfied.

> Do not pause before the DOKU export and payment inventory exist (§4 A9/A10). The
> export is the only external record of in-flight invoices.

### Stage 3 — Fresh checkpoint + signed approval (authorization A-3)

5. **Owner authorization A-3** covers one checkpoint capture and one signed approval.

6. Capture against the paused, drained tree:
   ```bash
   python3 -I -B <private>/filesystem_checkpoint.py capture --approval <private>/capture-approval.json
   # -> checkpoint_id=  manifest_sha256=
   ```
   Requirements: private approval under `/home/u399215191/private-backups`,
   `independent_verifier != operator`, all 8 `FLAGS` true, all 8 `EVIDENCE` non-empty,
   timestamps within 15 minutes, shared lock present, `publisher_lock_path` exact.

7. Verify the checkpoint:
   ```bash
   python3 -I -B <private>/filesystem_checkpoint.py verify --checkpoint <id> --manifest-sha256 <sha>
   # expect MANAGED_INVENTORY_MATCH_KEEP_HELD
   ```

8. Produce and **sign** the publication approval (fields are the closed set from
   `CODE_PUBLISHER.md`): `publisher_sha256`, `manifest_sha256`, `prior_operations`,
   `artifact_application_sha=d4b018b0…`, `artifact_sha256=5094f82b…`,
   `artifact_entries_sha256`, `publication_plan_sha256`, `removals`, `volatile_policy`,
   plus all 8 `FLAGS` and 8 `EVIDENCE`, and `effective_identity`.

   Expected plan for this artifact: **2 replacements** (`bootstrap/app.php`,
   `routes/web.php`), **2 additions** (`CheckCustomerAdmission.php`,
   `config/admission.php`), **0 removals**.

**STOP** if: capture fails, verify ≠ `MANAGED_INVENTORY_MATCH_KEEP_HELD`, the plan shows
any removal, any file outside the four appears, or the approval cannot be signed.

### Stage 4 — Publish (authorization A-3 continues, inside the 15-minute fuse)

9. Confirm the fuse is still valid (capture completed < 15 min ago).

10. Publish:
    ```bash
    python3 <private>/code_publisher.py publish --production \
      --checkpoint <id> --manifest-sha256 <sha> \
      --approval <private>/publication-approval.json \
      --signature <private>/publication-approval.sig \
      --approval-key <private>/<key> \
      --archive <private>/release.tar.gz --checksum <private>/release.sha256
    ```
    Expected: `CODE_PUBLISH_COMPLETE_KEEP_HELD`. Any other result is a **STOP**.

11. Confirm the reported `additions` / `replacements` / `removals` equal the approved
    plan **exactly**.

### Stage 5 — Activate caches (deliberate, ordered, verified)

12. Verify both caches are **unchanged** from §4 A4 (this is the invariant check). If
    either changed, STOP.

13. Rebuild in this exact order — config first, route second:
    ```bash
    php artisan config:cache
    # verify: app.env=production, db=u399215191_dombi_pr_1023
    php artisan route:cache
    ```
    Rationale: the reverse order produces a route cache referencing a middleware class
    before the config that configures it; and rebuilding routes before the class exists
    yields `500` on the five gated routes.

14. Verify activation:
    ```bash
    # gated route count must transition 0 -> 5
    php artisan route:list --json   # 308 routes; 5 carry admission.customer
    config('admission.customer_checkout')  # expected 'open' (fail-open by default)
    ```

### Stage 6 — Verify, then resume

> **Precondition:** Stage 5 completed and step 14 verified 308 routes with 5 carrying
> `admission.customer`. If publication reported `FAILED_OR_INTERRUPTED_KEEP_HELD`, this
> stage does **not** run — go to §7.

15. `curl /up` → `200`; `curl -X PUT /payment/doku/notify` → `405`. Nothing else.

16. Confirm no new `orders` / `payment_attempts` / `payment_webhook_logs` rows are
    attributable to this task (compare to §4 A9/A11 baseline; the only expected new
    webhook rows are genuine DOKU traffic).

17. Resume the scheduler:
    ```bash
    php artisan schedule:resume
    ```
    Confirm the flag is cleared and scheduled output resumes within 2 intervals.

18. **Owner authorization A-4** to reopen/leave admission — this procedure leaves
    `ADMISSION_CUSTOMER_CHECKOUT` untouched (default `open`). Reopening is a separate
    decision.

---

## 7. STOP conditions

**Before any mutation:** any §4 gate fails · no DOKU export · pause flag unreadable ·
drain not observed for 3 intervals · checkpoint capture > 15 min old · approval expired
or verifier == operator · plan not exactly 2+2+0.

**During publication:** any `target_drift` / `artifact_content` / `publication_drift` ·
any write outside the approved plan · `bootstrap/cache` mtime or digest changed · process
dies and reports `FAILED_OR_INTERRUPTED_KEEP_HELD`.

**After partial failure — nothing is automatic.** The publisher does **not** roll back.
State is `FAILED_OR_INTERRUPTED_KEEP_HELD`. In that state the following are **prohibited**
without a fresh, separately authorized recovery decision:

- **no cache clearing or rebuilding** (`config:clear`, `route:clear`, `config:cache`,
  `route:cache`) — the preserved caches are what keeps the half-replaced tree serving
  consistent behaviour (§5);
- **no scheduler resume** (`schedule:resume`) — resuming would let scheduled tasks run
  against an unreviewed tree;
- **no publication retry** — the operation directory is single-use
  (`publication_approval_used`), and a retry needs a fresh capture **and** a fresh
  approval, so a blind re-run will simply abort;
- **no manual file replacement, `git pull`, `rsync`/`scp`, or hand-editing** to "finish"
  the publication.

Required instead: keep the scheduler paused, **retain the failure evidence** (the
operation directory with `authorization.json`, `pre-state.json`, `journal.jsonl`,
`outcome.json`), record `/up` and DOKU reachability state, and escalate to the separately
authorized checkpoint/recovery path. Recovery is its own authorization and its own
reviewed procedure — not an extension of this one.

**Retained evidence is mandatory.** Do not delete the operation directory, do not delete
webhook rows written during the window, and do not "tidy" logs. The failure record is the
input to the recovery decision.

**Any time:** `/up` ≠ 200 · DOKU `PUT` ≠ 405 · unexpected `payment_webhook_logs` growth ·
money counts drift from §4 A9 · a scheduled task runs while paused.

---

## 8. What can be restored automatically vs what cannot

| State | Restorable automatically? |
| --- | --- |
| Scheduler pause | **Yes — but only after a clean, completed publication.** After a partial failure it is **prohibited** (§7): resuming would run scheduled tasks against a half-replaced tree. |
| Cache activation | **Yes — but only when activation itself succeeded and must be undone.** After a partial failure, clearing or rebuilding caches is **prohibited** (§5, §7). |
| Files replaced by publisher (partial) | **No** — no automated rollback. Requires the separately authorized checkpoint/recovery path. |
| DOKU callbacks missed at the edge | **No** — and this procedure is designed so this does **not** happen (no `artisan down`) |
| Orders created during the window | **No** — they are legitimate orders; not rolled back |
| Webhook rows written by genuine DOKU traffic | **No** — audit data; retained |

During a **clean** publication, the two states an operator is most likely to need —
scheduler resume and cache de-activation — are cheap and reversible. That is deliberate:
the irreversible part is confined to file replacement, which is why the plan is 4 files
with 0 removals.

**This table does not apply while a failure is unreviewed.** The moment the publisher
reports `FAILED_OR_INTERRUPTED_KEEP_HELD`, every "Yes" above becomes a **No** — the
system is kept exactly as found, held, and handed to separately authorized recovery.
The distinction matters: "reversible" describes the successful path, not the failed one.

---

## 9. Owner risk acceptance (recorded) and its limits

### 9.1 What the owner has accepted

Recorded 2026-11-16. These are decisions, not defaults:

| # | Accepted | Meaning |
| --- | --- | --- |
| R1 | **Checkout may remain open during the initial bootstrap** | On `334637a9` there is no admission gate. A customer may complete a new checkout during the window; those orders are handled by unchanged code and are **not** rolled back. |
| R2 | **DOKU intake remains live** | `/payment/doku/notify` and `/payment/doku/redirect` must stay reachable throughout. Intake is never deliberately interrupted. |
| R3 | **No `artisan down`** | Maintenance mode is not used for this publication (see §1). |
| R4 | **Caches are preserved** | `config.php` and `routes-v7.php` stay byte-identical through publication and through any partial failure (§5). |
| R5 | **Queue may not be provably idle** | After three clean scheduler intervals the scheduler is drained; reserved jobs may still execute. Accepted and recorded, not gate-satisfied. |
| R6 | **Publication is not automatically reversible** | After the first file replacement, recovery requires separate authorization. |
| R7 | **DOKU retry/resend is not relied upon** | Provider retry semantics remain unevidenced in this repository. |

### 9.2 What is NOT accepted

The acceptance above is narrow. The following remain **hard prohibitions**, not accepted
risks. Any of them occurring is an immediate STOP and an incident:

- **Data loss** — loss or corruption of orders, payments, webhook records, uploads,
  sessions, logs, or persistent storage.
- **False DOKU acknowledgement** — returning `2xx` to a notification that was not
  persisted. The ingress contract returns `503` when persistence fails and never
  `2xx` for an unpersisted callback. This must not change.
- **Uncontrolled payment writes** — any payment state change not produced by the existing
  verified code path. Explicitly includes `doku:mark-paid`, which writes payment state
  with no DOKU verification whatsoever and is **prohibited** in this window.
- **Silent interruption of DOKU intake** — e.g. entering maintenance mode on old code,
  which would 503 both DOKU routes (§1).
- **Security-contract weakening** — no relaxation of publisher validation, approval
  binding, ownership/mode checks, or path restrictions.

### 9.3 Mandatory gates that risk acceptance does not waive

Acceptance of R1–R7 does **not** substitute for any of these. All remain required:

- **DOKU transaction export** covering the window — **NO-GO without it**;
- **pre-window payment inventory** across all non-final states (`created`, `initiated`,
  `pending`, `unknown`, legacy);
- fresh checkpoint within the 15-minute fuse;
- signed publication approval with the exact closed field set;
- the §4 preflight gates and the §7 STOP conditions.

### 9.4 Risk acceptance is not publication approval

**Accepting the risk authorizes nothing.** It is a precondition, not a permission. Actual
publication still requires its own separately signed approval bound to
`artifact_application_sha=d4b018b0…` and `artifact_sha256=5094f82b…`, plus the
checkpoint, the lock, and the window authorization. A signed risk acceptance cannot be
substituted for a signed publication approval, and neither one authorizes recovery.

### 9.5 Signed acknowledgement (to be completed at A-2)

> I accept R1–R7 above for the single first installation of `d4b018b0` onto `334637a9`.
> I confirm that data loss, false DOKU acknowledgement, uncontrolled payment writes, and
> silent interruption of DOKU intake are not accepted, and that the mandatory gates in
> §9.3 remain in force. I understand this acceptance is not publication approval.

Boundaries:

- **In scope:** one publication of `d4b018b0` onto `334637a9`, one cache rebuild, one
  scheduler pause/resume cycle.
- **Out of scope:** migrations, `.env` changes, `artisan down`, cron edits, admission
  state changes, any second publication, staging or sibling `apidombi`.
- A signed approval is permission for **this** publication only. It is not permission for
  recovery, rollback, or any other production action.

---

## 10. Residual risks that remain after this procedure

1. **First-window DOKU exposure is not zero.** Intake stays reachable; that is the
   mitigation. Provider retry remains unevidenced.
2. **In-flight request containment is UNKNOWN** — no request-drain instrumentation exists.
   Requests already executing when files are replaced complete against mixed code.
3. **In-flight queue jobs** may still execute after the pause; only new drains stop.
4. **Pre-deploy window (P3.5) remains UNAVAILABLE** — nothing here closes it. This
   procedure only avoids *adding* an outage to it.
5. **OPcache semantics are UNKNOWN.** Production runs PHP via LSAPI; when a file is
   replaced on disk, the previously compiled unit may continue to serve until OPcache
   revalidates or the worker pool recycles. This can only *delay* activation, never
   accelerate it, so it does not widen the failure window — but it means the exact moment
   new code becomes reachable is not deterministic and must not be asserted. Verify
   observable behaviour (§6 Stage 5/6), never timing.
6. **Sibling `apidombi`** shares the account and is out of scope; its load is unaffected
   but unverified.
7. **Two audit rows** from the 2026-11-16 probe incident are retained deliberately.
8. **Cache rebuild is an activation step with no rollback of its own** — `route:clear`
   returns to uncached dynamic loading, which is safe but means the old behaviour returns.

---

## 11. Remaining prerequisites and the one next action

Risk acceptance (§9.1) is recorded. Publication approval is **not**. Outstanding
prerequisites, in dependency order:

| # | Prerequisite | Owner of the action |
| --- | --- | --- |
| P1 | Adopt the repin so the production checkpoint tool recognises `d4b018b0` (A-1). Committed on `docs/v1-release-docs-and-pin-20261116` (`c32cc581`); not on `develop`, not on host. | repo review + merge |
| P2 | **DOKU transaction export** for the window | external provider / operator |
| P3 | Pre-window payment inventory (§4 A9) | operator read-only DB session |
| P4 | Signing key available for approval HMAC | separately authorized provisioning |
| P5 | Fresh checkpoint inside the 15-minute fuse (A-3) | operator + independent verifier |
| P6 | Signed publication approval bound to `d4b018b0…` / `5094f82b…` | operator key holder |

**One next action:** complete **P2 — obtain the DOKU transaction export.** It is the
single precondition this document cannot satisfy, and A-2 must not be requested without
it. Everything else is either already available (P1 is committed and reviewable) or is
downstream of P2.

Publication itself remains **HOLD**.
