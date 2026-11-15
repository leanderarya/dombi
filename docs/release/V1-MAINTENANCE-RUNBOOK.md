# Dombi V1.0 after-hours maintenance runbook

Status: **DOCUMENTATION ONLY — EXECUTION NO-GO.** This runbook is prepared against
merged `develop` `b92e8d3b`. It authorizes nothing. Every phase below is gated by a
STOP condition, and several are currently **blocked by missing controls** (see
[Blockers](#blockers)). Do not execute a phase whose gate is not green.

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

## Phase P3 — Web/DOKU containment **[STATE-CHANGING]** — **BLOCKED**

**No verified admission control exists on this account.** The application defines no
deploy-independent gate; `artisan down` is forbidden because it blocks `/up` and the
DOKU endpoints, and it also writes no durable record for rejected callbacks.

| # | Action | Status |
| --- | --- | --- |
| P3.1 | Close customer admission with an **external** boundary (vhost/`.htaccess` deny) that preserves an operator smoke path | **UNAVAILABLE — requires provider-supported mechanism not established** |
| P3.2 | Decide DOKU disposition: edge-reject **with a maintained rejection ledger**, or durable intake | **UNAVAILABLE — no non-mutating intake mode exists; retry semantics unevidenced** |
| P3.3 | Record chosen DOKU disposition + merchant-confirmed retry deadline | pending |

**Never** treat any of these as callback safety: `schedule:pause`, a quiet queue,
maintenance mode, a 503 alone, or "DOKU will retry". DOKU retry/resend behaviour is
**not evidenced in this repository**.

**STOP gate (hard):** if P3.1 and P3.2 are not both satisfied with recorded evidence,
**do not proceed to P5 or P6**. Execution stops here by design.

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
| P5.2 | Provision shared lock (separate authorization; `0600` regular single-link, no symlink) | `lock=` — **currently ABSENT** |
| P5.3 | Provision tool into `private-backups` and pin its digest | `tool_sha256=` — **currently not provisioned** |
| P5.4 | Write approval JSON (no generator exists) | `approval_sha256=` `independent_verifier=` `issued_utc=` |
| P5.5 | Capture | `python3 -I -B <tool> capture --approval <private>/capture-approval.json` → `checkpoint_id=` `manifest_sha256=` |
| P5.6 | Verify | `python3 -I -B <tool> verify --checkpoint <id> --manifest-sha256 <sha>` → expect `MANAGED_INVENTORY_MATCH_KEEP_HELD` |

**STOP if:** lock missing · tool digest unpinned · approval older than 15 minutes or
issued in the future · verifier equals operator · any flag/evidence missing ·
`CHECKPOINT_ABORT` · verify returns anything other than
`MANAGED_INVENTORY_MATCH_KEEP_HELD`.

**Reversal:** none needed — capture is additive and private. Delete nothing.

---

## Phase P6 — Code-only publication **[STATE-CHANGING]** — **BLOCKED**

**There is no production publication path.** `code_publisher.py` `main()` prints
`PUBLISHER_DISABLED; no production publication path exists; keep doors held` and exits 1,
and `require_fixture_policy()` refuses the production identity from any caller.

**And the payload source is wrong for a release.** `publish()` stages from
`<checkpoint>/code.tar.gz` (`code_publisher.py:292`), i.e. it republishes the
**checkpoint's own contents** — the pre-change baseline. It cannot install a candidate
artifact from the release pipeline. As merged, this tool is a *restore* primitive, not a
release primitive; publishing the checkpoint back is a no-op. A code-only release needs a
publisher whose payload is the verified artifact, still bound to the same checkpoint,
approval and shared lock.

| # | Action | Status |
| --- | --- | --- |
| P6.1 | Obtain a reviewed production publisher bound to the checkpoint + approval + shared lock, **staging the verified artifact payload** (not the checkpoint's own archive) | **MISSING CONTROL** |
| P6.2 | Publish managed code only, under the shared lock | `published_sha=` — **cannot run** |
| P6.3 | Expect `CODE_PUBLISH_COMPLETE_KEEP_HELD`; any other result = STOP | pending |

**Prohibited substitutes:** `rsync`/`scp` by hand, editing files in place, `git pull` in
the web root, running the GitHub workflow, or restoring the historical recovery tool.

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
| B1 | **No deploy-independent admission/writer gate.** `artisan down` is unusable (blocks `/up` and DOKU, no durable rejection record). | app has no maintenance `except`; global `PreventRequestsDuringMaintenance` |
| B2 | **No DOKU containment disposition.** No non-mutating intake mode; DOKU retry/resend semantics unevidenced. A callback without `Request-Id` is rejected `400` **before** any row is written. | `DokuWebhookIngressService::receive()` |
| B3 | **Shared publisher lock absent** on the host, so `capture` will abort (`publisher_lock`). | `Policy.lock` required; observed absent |
| B4 | **Checkpoint tool not provisioned** in `private-backups` with a pinned digest. | only historical recovery tools present |
| B5 | **No authenticated approval generator/signer.** Approvals are operator attestations; `independent_verifier` is a name, not a verified identity. | `authorize()` |
| B6 | **Publisher is fixture-only and restores the wrong payload.** CLI is an unconditional refusal; `require_fixture_policy()` refuses production; and `publish()` stages the checkpoint's own `code.tar.gz`, so it cannot install a candidate artifact. | `code_publisher.py` `main()`, `require_fixture_policy()`, `:292` |
| B7 | **Publisher cannot create or prune paths.** Missing managed files and removal of obsolete files both abort; a code-only release that adds/removes files cannot complete. | `publication_plan()` `missing_target_entry` / `unexpected_target_inventory` |
| B8 | **Web-worker DB identity UNKNOWN.** Never assume LSAPI workers run the NEW schema; workers older than the last `.env` change may still hold the previous schema. | prior read-only smoke test |
| B9 | **Two identical cron entries.** `schedule:pause` covers both via shared cache, but the duplicate remains unexplained. | `cronjob_oGUFKybU14`, `cronjob_ZwUE8CLMt5` |
| B10 | **Sibling `apidombi` app** uses a different database on the same account; containment scope unverified. | prior evidence |
| B11 | **Restore drill not required but also not available** if code rollback proves insufficient. Waivers preserved; this remains a residual risk, not a new gate. | existing waivers |

**Small step that unblocks the most:** provision the **shared publisher lock** (B3) under
separate authorization — it is the single prerequisite that makes `inspect --plan` →
`capture` → `verify` executable and is required by every existing checkpoint control.

**Smallest implementation step for B6/B7:** one reviewed production publisher mode that
(a) is selected by explicit production policy plus approval binding, not a bypass flag,
(b) stages the **verified candidate artifact** rather than the checkpoint archive,
(c) creates only approval-listed managed paths whose parents validate, and
(d) removes only approval-listed managed paths. No deployment enablement.

---

## Readiness

| Dimension | Result |
| --- | --- |
| Documentation readiness (this runbook) | **PASS** — phases, gates, evidence fields and reversals defined; commands match current source |
| Execution readiness | **FAIL** — B1–B10 open |
| Scheduler pause capability | **PASS** — `schedule:pause`/`resume`, all 15 events covered |
| Scheduler pause as writer containment | **FAIL by definition** — scheduled entrypoints only |
| Maintenance mode as containment | **FAIL** — blocks `/up` and DOKU; no durable rejection record |
| DOKU callback safety | **UNKNOWN** — retry semantics unevidenced |
| Deployment authorization | **NOT GRANTED** — out of scope |

No production access, no state change, no Artisan/SQL/PHP execution, no cron or DOKU
action was performed in producing this document.
