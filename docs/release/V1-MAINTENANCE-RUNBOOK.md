# Dombi V1.0 after-hours maintenance runbook

Status: **DOCUMENTATION ONLY — EXECUTION NO-GO.** This runbook is prepared against
merged `develop` `2b07ef1c`. It authorizes nothing. Every phase below is gated by a
STOP condition, and several are currently **blocked by missing controls** (see
[Blockers](#blockers)). Do not execute a phase whose gate is not green.

For the short operator decision list, see [V1-WRITER-CONTAINMENT.md](V1-WRITER-CONTAINMENT.md).
That checklist enumerates every writer class with its containment method, evidence and
STOP gate, and carries the DOKU maintenance policy. It summarises this document and does
not replace it.

- Repository: `leanderarya/dombi`
- Production root: `/home/u399215191/domains/dombicenter.com/public_html/app`
- Production DB baseline: `u399215191_dombi_pr_1023`
- Hostinger cron IDs: `cronjob_oGUFKybU14`, `cronjob_ZwUE8CLMt5` (leave **unchanged**)
- Window: after store closing; code-only release; **no migrations, no DB rollback**
- Framework: `laravel/framework` **v13.8.0** (`composer.lock`)

**This runbook must never be read as writer containment.** `schedule:pause` stops only
scheduled entrypoints. Maintenance mode is explicitly **not used** (§P3). Web requests,
DOKU callbacks, in-flight jobs and sibling applications remain live unless separately
contained.

## Standing rules

1. Read-only checks (§P1, §P2) are marked **[READ-ONLY]**. Everything else is
   **[STATE-CHANGING]** and needs the window authorization.
2. Never run `php artisan down` (see §P3).
3. Never delete or edit a Hostinger cron entry.
4. Never run migrations, `migrate:rollback`, `db:wipe`, or a DB restore in this window.
5. Any unexpected output, any non-zero exit, or any `CHECKPOINT_ABORT` /
   `PUBLISHER_DISABLED` ⇒ STOP and escalate (§E).
6. Preserve existing waivers (Hostinger backup/restore-drill waivers, DOKU sandbox
   waiver). This window does **not** re-open them and does **not** require a new
   restore drill.
7. Record every evidence field. An empty field is a failed gate.

## Verified control surface

| Control | Verified how | Consequence for this runbook |
| --- | --- | --- |
| `schedule:pause` / `schedule:resume` | `SchedulePauseCommand`/`ScheduleResumeCommand` registered in `ArtisanServiceProvider`; framework v13.8.0 | Usable for scheduler-level stop |
| Pause flag storage | `ScheduleRunCommand::isPaused()` reads cache key `illuminate:schedule:paused`; default store `env('CACHE_STORE','database')`, table `cache` | Pause is a **DB write**; shared across both cron runners |
| 15 scheduled events | `routes/console.php` | All skipped when paused; no event opts into `evenWhenPaused()` |
| No maintenance bypass in app | no `evenInMaintenanceMode`/`evenWhenPaused` in `app routes config bootstrap` | Pause covers every configured task |
| Maintenance mode blocks HTTP | `PreventRequestsDuringMaintenance` is global; app registers no `except`; `/up` registered without exempt middleware | `artisan down` would block `/up` **and** `/payment/doku/*` ⇒ forbidden |
| Checkpoint CLI | `scripts/recovery/filesystem_checkpoint.py` modes `inspect|verify|capture|recover` | §P5 commands below |
| Publisher has **no production path** | `code_publisher.py` `main()` always prints `PUBLISHER_DISABLED`; `require_fixture_policy()` refuses the production identity | §P6 is **BLOCKED** |
| Shared publisher lock | `Policy.lock` = `<private>/dombi-filesystem-publication.lock` | Must be pre-provisioned; observed **ABSENT** |
| Deploy workflow | `.github/workflows/deploy.yml` ends with a fail-closed `exit 1` | No automatic deployment can occur |

---

## Phase P1 — Preparation **(T-48h, [READ-ONLY])**

| # | Action | Evidence to record |
| --- | --- | --- |
| P1.1 | Freeze candidate SHA and record artifact id / application SHA / archive SHA-256 | `sha=` `artifact=` `archive_sha256=` |
| P1.2 | Confirm `origin/develop` still equals the reviewed baseline | `develop_sha=` |
| P1.3 | `php artisan schedule:list` on the production host | pasted list; count must be **15** |
| P1.4 | Confirm nothing opts out of pause: `grep -rn "evenInMaintenanceMode\|evenWhenPaused" app routes config bootstrap` | must be **no matches** |
| P1.5 | Confirm pause storage: `grep -n "CACHE_STORE\|'default'" config/cache.php` and check production `.env` **key presence only** (never print values) | `cache_store=` |
| P1.6 | Confirm `/up` baseline: `curl -sS -o /dev/null -w '%{http_code}\n' https://app.dombicenter.com/up` | `up_code=` (expect `200`) |
| P1.7 | Record both cron IDs and their **original schedule expression + enabled state** (panel, read-only) | `cron_a=` `cron_b=` |
| P1.8 | Enumerate sibling web apps on the account (`public_html/staging`, `public_html/apidombi`) and decide scope | `siblings_in_scope=` |
| P1.9 | Capture pending-money baseline via the operator's **existing read-only DB session** (no SQL authored here): counts of `payment_webhook_logs` by `status`, `payment_outbox_events` pending, `payment_attempts` in `created|pending|unknown` | five integers |
| P1.10 | Record current `storage/logs/*.log` mtimes | `log_mtime_snapshot=` |

**STOP if:** schedule count ≠ 15 · any bypass attribute present · `cache_store` is not a
shared store (`database`) · `/up` ≠ 200 · sibling apps unexplained · artifacts do not
match the reviewed commit.

## Phase P2 — Pre-window verification **(T-1h, [READ-ONLY])**

| # | Action | Evidence |
| --- | --- | --- |
| P2.1 | Re-run P1.6 and P1.9; compare to baseline | `up_code=` `money_counts=` |
| P2.2 | Confirm no deployment in flight (no active run, no release marker change) | `release_marker_mtime=` |
| P2.3 | Confirm scheduler heartbeat fresh via authenticated `/api/health` if accessible; otherwise record last `laravel.log` scheduled-command timestamp | `heartbeat_age=` |
| P2.4 | Owner sign-off for the window and downtime notice published | `owner_ack=` `notice_utc=` |

**STOP if:** `/up` ≠ 200 · money counts moved without explanation · heartbeat stale ·
no owner acknowledgement.

---

## Phase P3 — Web/DOKU containment **[STATE-CHANGING]** — **PARTIALLY RESOLVED**

An in-app admission gate now exists: `App\Http\Middleware\CheckCustomerAdmission`, attached
per-route to the five checkout/order/payment-initiation routes, controlled by
`ADMISSION_CUSTOMER_CHECKOUT` through `config/admission.php`.

| # | Action | Status |
| --- | --- | --- |
| P3.1 | Close customer admission in-app: set `ADMISSION_CUSTOMER_CHECKOUT=held` and rebuild the config cache | **AVAILABLE — only after this code is deployed** |
| P3.2 | Narrow `artisan down` so `/up` and the two DOKU routes stay reachable: `$middleware->preventRequestsDuringMaintenance(except: ['up','payment/doku/notify','payment/doku/redirect'])` in `bootstrap/app.php` | **AVAILABLE once this release is deployed — see P3.5** |
| P3.3 | DOKU disposition | **DECIDED — keep intake open.** Durable in-app intake; unpersisted notifications never acknowledged; retry/resend are recovery options only. Edge rejection is unavailable (no established provider capability). See [V1-WRITER-CONTAINMENT.md](V1-WRITER-CONTAINMENT.md). |
| P3.4 | Capture the pre-window payment inventory (all non-final states incl. `created`/`initiated`/legacy) and obtain the **DOKU transaction export** | `inventory=` `doku_export=` — **NO-GO without the export** |
| P3.5 | Close the **pre-deploy** window (while old code is still serving) | **UNAVAILABLE — no provider-supported mechanism established** |

**Verified activation / verification / restoration (P3.2):**

```bash
# activate (maintenance window)
php artisan down --retry=15
# verify: 503 for customers, 200 for health, DOKU NOT swallowed by 503
curl -s -o /dev/null -w '%{http_code}\n' https://app.dombicenter.com/           # expect 503
curl -s -o /dev/null -w '%{http_code}\n' https://app.dombicenter.com/up        # expect 200
curl -s -o /dev/null -w '%{http_code}\n' https://app.dombicenter.com/api/health # expect 200 (authenticated path if gated)
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://app.dombicenter.com/payment/doku/notify                              # expect 400, not 503
# restore
php artisan up
curl -s -o /dev/null -w '%{http_code}\n' https://app.dombicenter.com/           # expect 200
```

The `/up` probe is the authoritative health signal during maintenance. A `500` on `/`
immediately after `artisan up` must be investigated before declaring the window closed: the
application can be genuinely up while an unrelated fault (for example a missing or stale
Vite manifest in `public/build`) still breaks page rendering.

**STOP if:** `/up` is not `200` while down · `POST /payment/doku/notify` returns `503`
(routes not exempt) · the DOKU route returns `2xx` for a request with no `Request-Id`
(false acknowledgement) · any path outside the three listed URIs stops returning `503`.

**Why this is exact-match only.** Verified in `Illuminate\Foundation\Http\Middleware\Concerns\ExcludesPaths`:
exception entries are compared with `$request->is($pattern)`, so a wildcard such as
`payment/doku/*` would reopen unrelated routes. The three entries above are the exact URIs.
Method is not part of the match, so both `GET` and `POST` are exempt on the DOKU routes —
which is correct, because DOKU uses `GET` for redirect and `POST` for notify.

**Two hard limits remain.** First, exceptions are evaluated by Laravel middleware, so they
require a working bootstrap: during **in-place file replacement they do not apply**, and the
pre-deploy window (P3.5) is uncovered — neither B1 nor DOKU continuity is fully solved
without deploy-window evidence. Second, holding admissions stops *new* payment attempts only;
payments already initiated at DOKU remain completable by design. If the window requires a
hard money-stop, that is a separate decision and is **not** provided here.


**Gate properties (verified):**
- Default is **OPEN**. Only the literal token `held` (trimmed, case-insensitive) closes the
  gate; unset, empty, `0`, `false`, `closed` or a typo all leave admissions open, so the
  control cannot close production by accident.
- Blocked when held: `POST /customer/checkout`, `/checkout/customer`, `/checkout/payment`,
  `/customer/orders`, `/customer/orders/{order}/pay`.
- **Never** gated: `/payment/doku/notify`, `/payment/doku/redirect`,
  `/customer/orders/{order}/payment-status`, order confirm, product browsing, cart.
- Reversal is a config change plus config-cache rebuild; no code change or redeploy needed.

**Two hard limits remain.** First, this is application code, so it only takes effect once
this release is deployed — it does **not** cover the deploy window itself, which still
needs P3.5. Second, holding admissions stops *new* payment attempts only; payments already
initiated at DOKU remain completable by design. If the window requires a hard money-stop,
that is a separate decision and is **not** provided here.

**Never** treat any of these as callback safety: `schedule:pause`, a quiet queue,
maintenance-mode exceptions, a 503 alone, or "DOKU will retry". DOKU retry/resend
behaviour is **not evidenced in this repository**.

**STOP gate (hard):** if P3.5 is not satisfied with recorded evidence, the pre-deploy
window is uncovered. If P3.3/P3.4 are not recorded, **do not proceed to P6**.

---

## Phase P4 — Scheduler pause and drain **[STATE-CHANGING]** — usable independently of P3

| # | Action | Verification | Reversal |
| --- | --- | --- | --- |
| P4.1 | `php artisan schedule:pause` (production PHP, exact binary per host: `/opt/alt/php83/usr/bin/php`) | command prints "Scheduled task processing has been paused." | `php artisan schedule:resume` |
| P4.2 | Confirm flag: re-run `php artisan schedule:list` shows tasks but no executions begin; `laravel.log` gains no new `orders:expire-pending completed` | `last_sched_log_utc=` | — |
| P4.3 | Confirm Hostinger still invokes `schedule:run` unchanged: `ls -l --time-style=+%Y-%m-%dT%H:%M:%SZ ~/.logs/cronjob_oGUFKybU14 ~/.logs/cronjob_ZwUE8CLMt5` | mtimes **advancing** = cron alive and doing nothing | — |
| P4.4 | Drain window: poll P4.2/P4.3 every 60 s for **≥ 3 consecutive clean minutes** | `drain_clean_since=` | — |

**Drain acceptance:** cron output mtimes still advancing **and** no new scheduled-command
log entries **and** no new `processing`/`claim_token` webhook rows older than 5 minutes.

**Explicitly out of scope of P4:** already-running `schedule:run` children, in-flight
`queue:work --stop-when-empty` (short-lived), in-flight web requests, an in-progress
`payments:reconcile-doku` DOKU HTTP call, and all web-triggered writes. P4 **prevents new
scheduled work only**; it does not drain or contain the web tier.

**STOP if:** `schedule:pause` exits non-zero · flag unreadable · cron mtimes stop
advancing (cron itself broken) · scheduled work continues after 2 minutes.

---

## Phase P5 — Checkpoint **[STATE-CHANGING]** — **BLOCKED**

Requires (all fail-closed in `filesystem_checkpoint.py`): a private approval under
`/home/u399215191/private-backups`, an `independent_verifier` different from the
operator, all 8 `FLAGS` true, all 8 `EVIDENCE` references non-empty, timestamps within
15 minutes, exact candidate pins, and the **shared publisher lock present**.

| # | Action | Command / evidence |
| --- | --- | --- |
| P5.1 | **[READ-ONLY]** produce plan digests | `python3 -I -B <tool> inspect --plan <private>/release-plan.json` → `observed_state_sha256=` |
| P5.2 | Provision shared lock — **dry-run first**, then apply: `python3 -I -B <provisioner> --tool <tool> --private /home/u399215191/private-backups --app-root <app> --create-lock` (add `--apply` only after review) | `lock=` — **currently ABSENT** |
| P5.3 | Provision tool into `private-backups` with a pinned digest (`--publish-tool --expected-tool-sha256 <pin> --apply`) | `tool_sha256=` — **currently not provisioned** |
| P5.4 | Write approval JSON (no generator exists) | `approval_sha256=` `independent_verifier=` `issued_utc=` |
| P5.5 | Capture | `python3 -I -B <tool> capture --approval <private>/capture-approval.json` → `checkpoint_id=` `manifest_sha256=` |
| P5.6 | Verify | `python3 -I -B <tool> verify --checkpoint <id> --manifest-sha256 <sha>` → expect `MANAGED_INVENTORY_MATCH_KEEP_HELD` |

**STOP if:** lock missing · tool digest unpinned · approval older than 15 minutes or
issued in the future · verifier equals operator · any flag/evidence missing ·
`CHECKPOINT_ABORT` · verify returns anything other than
`MANAGED_INVENTORY_MATCH_KEEP_HELD`.

**Reversal:** none needed — capture is additive and private. Delete nothing.

---

## Phase P6 — Code-only publication **[STATE-CHANGING]** — **BLOCKED (production path only)**

The publisher now has an artifact mode, `publish_artifact(policy, checkpoint_id,
manifest_sha256, approval_path, archive_path, checksum_path)`. It validates the
candidate `release.tar.gz` with the release format's own verifier, binds it to the
pre-release checkpoint, and performs approval-scoped additions, replacements and
removals under the shared lock. It is **fixture-only**: `main()` still prints
`PUBLISHER_DISABLED` and exits 1, and `require_fixture_policy()` refuses the production
identity from every caller.

| # | Action | Status |
| --- | --- | --- |
| P6.1 | Obtain a separately authorized production publisher wrapper: same artifact/checkpoint/approval/lock bindings, but with the production policy enabled | **MISSING CONTROL** |
| P6.2 | Publish the approved artifact, under the shared lock | `published_sha=` — **cannot run** |
| P6.3 | Expect `CODE_PUBLISH_COMPLETE_KEEP_HELD`; any other result = STOP | pending |
| P6.4 | Confirm the reported `additions`/`replacements`/`removals` equal the approved plan | exact match required |

**Prohibited substitutes:** `rsync`/`scp` by hand, editing files in place, `git pull` in
the web root, running the GitHub workflow, or restoring the historical recovery tool.

**Runtime log appends during publication.** The publisher tolerates one narrow class of
drift: a `protected` regular file that is a direct child of `storage/logs/` may grow or
change content, provided its inode, device, owner, group, mode and type are unchanged.
That allowance is bound to the approval's `volatile_policy` field and cannot be widened
per run (`volatile_policy_mismatch` otherwise). Everything else still aborts:
`scheduler_pause` is **not** a filesystem guarantee, and log writes are only one writer —
uploads under `storage/app/`, `storage/framework/{cache,sessions,views}`,
`bootstrap/cache`, sessions and database files remain strict. Still prefer a window that
does not overlap `backup:clean` (02:00), `backup:run` (02:30) or `backup:monitor` (03:00):
those write inside `storage/` outside the allowlist and will abort publication.

---

## Phase P7 — Acceptance **[READ-ONLY]**

| # | Check | Pass criterion | Evidence |
| --- | --- | --- | --- |
| P7.1 | `curl -sS -o /dev/null -w '%{http_code}\n' https://app.dombicenter.com/up` | `200` | `up_code=` |
| P7.2 | Authenticated `/api/health` | `database`+`cache`+`storage` healthy; `scheduler` reports paused/stale **as expected** | `health_json=` |
| P7.3 | Deployed file set matches the artifact inventory | exact match, no unexplained extra/missing path | `diff=` |
| P7.4 | Asset manifest matches artifact | match | `manifest_sha=` |
| P7.5 | `storage/`, `.env*`, `bootstrap/cache` untouched | mtimes unchanged vs P1.10 | `mtimes=` |
| P7.6 | Money counts equal P1.9 baseline (no new payments/stock effects) | equal | `counts=` |
| P7.7 | One **sandbox** DOKU canary reconciles to exactly one effect | 1, not 0 / not 2 | `canary=` |

**STOP if:** `/up` ≠ 200 · asset or inventory mismatch · protected paths changed · any
money count drifted · canary duplicates or vanishes.

---

## Phase P8 — Reopening **[STATE-CHANGING, separate authorization]**

Only after P7 is fully green **and** the P3 DOKU disposition is confirmed executed.

| # | Action order | Verification |
| --- | --- | --- |
| P8.1 | Resume scheduler: `php artisan schedule:resume` | prints "resumed"; next cron tick logs scheduled work again |
| P8.2 | Observe 15 minutes: queue drains, `reconcile-doku` logs "No DOKU payments to reconcile." or reconciles cleanly | `observed=` |
| P8.3 | Reconcile the DOKU rejection ledger / late callbacks against merchant records | `ledger=` |
| P8.4 | Remove the external admission boundary | `/` and `/up` reachable; `adm=` |
| P8.5 | Post-window watch 30 min (extend to 2 h if any anomaly) | `watch_start=` `watch_end=` |

**Resume order:** scheduler → payment reconciliation/outbox → queue drain → customer
admission. **Never** reverse: never open admission while reconciliation is unresolved.

---

## Phase E — Failure escalation

| Situation | Action |
| --- | --- |
| Any STOP condition before P5 | Abort. Nothing changed. `schedule:resume`. Record reason. |
| Failure during/after P6 | Keep admissions closed, keep scheduler paused. Do **not** roll back the database. Preserve checkpoint, journal, logs. Restore prior code only from the verified checkpoint under **separate** approval. |
| Unexplained payment/stock row | Open an incident immediately. Preserve all logs, webhook rows and outbox state. Do not retry payment operations. |
| DOKU duplicate or missing effect | Freeze payment creation, preserve invoice/attempt IDs, escalate to merchant contact. Never replay en masse or force status. |
| Scheduler flag unreadable / cache table unavailable | Treat as UNKNOWN containment. Stop and escalate; do not fall back to editing cron. |

**Rollback boundary:** code-only, from the checkpoint. There is no DB rollback in this
runbook. Recovery beyond code is out of scope and needs its own authorization.

---

## Blockers

Execution is **NO-GO** until every item below is closed. These are missing controls,
not documentation gaps.

| # | Blocker | Evidence |
| --- | --- | --- |
| B1 | **No deploy-independent, pre-deploy admission boundary.** An in-app gate exists (P3.1) and `artisan down` now preserves `/up` + DOKU (P3.2), but neither covers the window while old code is still serving, nor in-place file replacement. | `CheckCustomerAdmission`; `preventRequestsDuringMaintenance` in `bootstrap/app.php` |
| B2 | **DOKU policy decided; evidence not yet captured.** Intake stays open, unpersisted notifications are never acknowledged, and retry/resend are recovery options only. Still open: the pre-window non-final-attempt inventory (incl. `created`, `initiated` and legacy invoices), the external DOKU transaction export, and the manual `created`-invoice sweep. `created` attempts are not processed by any scheduled job. | `ReconcileDokuPayment.php:25`; `DokuReconciliationService.php:20`; `DokuService.php:236,605`; [V1-WRITER-CONTAINMENT.md](V1-WRITER-CONTAINMENT.md) |
| B3 | **Shared publisher lock absent** on the host, so `capture` will abort (`publisher_lock`). A provisioning procedure now exists but has not been executed. | `Policy.lock` required; observed absent; `provision_checkpoint_tool.py` |
| B4 | **Checkpoint tool not provisioned** in `private-backups` with a pinned digest. Provisioning procedure exists; not executed. | `provision_checkpoint_tool.py`, `CHECKPOINT_PROVISIONING.md` |
| B5 | **Approvals are not authenticated identity.** The production path now requires an HMAC over the approval bytes, but that authenticates possession of an operator-held symmetric key — not a person, and not `independent_verifier != operator`. | `publish_artifact_production`; `CODE_PUBLISHER.md` |
| B6 | **No authorized production execution.** A production entrypoint exists (`--production` + all fail-closed prerequisites) but `main()` refuses by default and no release authorization has been granted. | `code_publisher.py` `main()` |
| B7 | **Artifact-mode preconditions unprovisioned on the host.** Shared lock absent, checkpoint tool not provisioned, no artifact/checksum receipt or approval key in the private directory. | `Policy.lock`; `artifact_files()`; production key requirement |
| B8 | **Web-worker DB identity UNKNOWN.** Never assume LSAPI workers run the NEW schema; workers older than the last `.env` change may still hold the previous schema. | prior read-only smoke test |
| B9 | **Two identical cron entries.** `schedule:pause` covers both via shared cache, but the duplicate remains unexplained. | `cronjob_oGUFKybU14`, `cronjob_ZwUE8CLMt5` |
| B10 | **Sibling `apidombi` app** uses a different database on the same account; containment scope unverified. | prior evidence |
| B11 | **Restore drill not required but also not available** if code rollback proves insufficient. Waivers preserved; this remains a residual risk, not a new gate. | existing waivers |

**Small step that unblocks the most:** provision the **shared publisher lock** (B3) under
separate authorization — it is the single prerequisite that makes `inspect --plan` →
`capture` → `verify` executable and is required by every existing checkpoint control.

**Next implementation step:** provision the shared publisher lock and a pinned checkpoint
tool under separate authorization using `scripts/recovery/provision_checkpoint_tool.py`
(dry-run first, always). The production publisher entrypoint, artifact transport and
admission gate all now exist and are tested; no deployment enablement is included.

---

## Readiness

| Dimension | Result |
| --- | --- |
| Documentation readiness (this runbook) | **PASS** — phases, gates, evidence fields and reversals defined; commands match current source |
| Artifact publication implementation (fixture-only) | **PASS** — additions, replacements and removals implemented and synthetically tested |
| Production publisher entrypoint | **PASS (not authorized)** — `--production` with fail-closed prerequisites and HMAC approvals; refuses by default |
| Admission gate | **PASS (post-deploy only)** — config-driven, default open, DOKU routes never gated |
| Checkpoint provisioning procedure | **PASS (not executed)** — dry-run-by-default script, doc and tests |
| Execution readiness | **FAIL** — B1–B10 open |
| Scheduler pause capability | **PASS** — `schedule:pause`/`resume`, all 15 events covered |
| Scheduler pause as writer containment | **FAIL by definition** — scheduled entrypoints only |
| Maintenance mode as containment | **FAIL** — blocks `/up` and DOKU; no durable rejection record |
| DOKU callback safety | **UNKNOWN** — retry semantics unevidenced |
| Deployment authorization | **NOT GRANTED** — out of scope |

No production access, no state change, no Artisan/SQL/PHP execution, no cron or DOKU
action was performed in producing this document.
