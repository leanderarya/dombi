# V1.0 admission bootstrap release — main-lineage candidate

Status: **LOCAL CANDIDATE ONLY.** Not built, not pinned, not deployed. No production access,
no artifact build, no `fs.CANDIDATE` change.

Base: deployed `main` tip `334637a9e8cd2ba639c557e4be80d4a19fdfc92d`.
Purpose: make the admission gate available without shipping 36 commits of `develop` drift.

## What this candidate contains

Only the admission surface and its focused tests. Nothing else from `develop`.

| Path | Change | Source |
| --- | --- | --- |
| `app/Http/Middleware/CheckCustomerAdmission.php` | new, 50 lines | identical to `develop` |
| `config/admission.php` | new, 33 lines | identical to `develop` |
| `bootstrap/app.php` | +17: one `use`, one alias, one maintenance-exception block | identical blob to `develop` (`837257a6`) |
| `routes/web.php` | 5 route bindings + comments | identical to `develop` |
| `tests/Feature/CustomerAdmissionGateTest.php` | 9 tests, ported unmodified | `develop` |
| `tests/Feature/MaintenanceExceptionBootstrapTest.php` | **new**, 6 tests | this candidate |

`bootstrap/app.php` and `routes/web.php` on this branch produce the **same blob hashes as
`develop`** for the admission hunks, so the code being reviewed is the code already reviewed.

### Verified absent (no scope leakage)

`git diff --stat` vs base = **2 files changed, 24 insertions, 5 deletions**, plus 3 new files.
No migrations, no `.github/`, no `composer*`, no `package*`, no `scripts/` change.

## Behaviour validated locally

| Behaviour | Test | Result |
| --- | --- | --- |
| Default open (unset/empty/`0`/`false`/typo) | `test_gate_fails_open_for_unset_or_unrecognised_values` | PASS |
| Held blocks checkout | `test_held_admissions_reject_new_checkout_drafts` | PASS |
| Held blocks order/payment initiation | `test_held_admissions_reject_payment_initiation_with_actionable_json` | PASS |
| DOKU notify+redirect exempt from the gate | `test_gate_is_wired_only_to_new_admission_routes_and_never_to_doku_callbacks` | PASS |
| Unpersisted notification never 2xx | `test_unpersisted_notification_is_never_acknowledged` | PASS |
| Only literal `held` closes | `test_gate_closes_only_for_the_held_token` | PASS |
| Maintenance: ordinary requests 503 | `test_ordinary_requests_are_rejected_while_down` | PASS |
| Maintenance: `/up` reachable | `test_health_endpoint_stays_reachable_while_down` | PASS |
| Maintenance: DOKU notify 400 not 503 | `test_doku_notify_is_not_swallowed_by_maintenance` | PASS |
| Maintenance: redirect reachable | `test_doku_redirect_stays_reachable_while_down` | PASS |
| Maintenance: exact-path only | `test_neighbouring_paths_are_not_exempted` | PASS |
| Safe restoration | `test_restoration_returns_to_normal_service` | PASS |

Totals: **9 tests / 61 assertions** (ported) + **6 tests / 19 assertions** (new) = **15 tests /
80 assertions**. Adjacent `DokuWebhookIngressTest` still passes **20/20** on this lineage.

Mutation-checked: deleting the maintenance-exception block fails exactly the two DOKU
reachability tests, so the new tests are load-bearing.

## Compatibility findings

1. **`scripts/ci/` does not exist on `main`.** The artifact/release verifier
   (`scripts/ci/release.py`), `production_code_adapter.py`, and the whole immutable-artifact
   contract are `develop`-only. Any of them may be cited for a `develop` build but **cannot**
   be used to verify a `main`-lineage artifact.
2. **`main`'s `deploy.yml` is preparation-only** (69 lines): it runs `composer install`,
   `npm run build`, writes `public/build/RELEASE_SHA`, and uploads **only `public/build/`**
   as `dombi-v1-assets-<sha>`. It uploads **no code artifact** and makes no server
   connection. So no existing pinned artifact corresponds to this candidate.
3. **`fs.CANDIDATE` stays untouched** (`4ebe5e1d` / `5b5a5445…`). The publisher hard-pins it,
   so this candidate could not be published even if a `develop`-format artifact were built.
   Publishing this candidate requires a **new** pin — a separate reviewed change, explicitly
   out of scope here.
4. Since `main` has no artifact pipeline, getting this candidate to production needs a
   packaging path decision that does **not** yet exist on that lineage.

## Bootstrap-window risk (the documented limitation)

**The deployed code cannot preserve DOKU callback reachability during initial maintenance.**

The deployed release `334637a9` has **no** `preventRequestsDuringMaintenance` exceptions
(verified: `grep` count 0). On today's production, `php artisan down` therefore returns the
maintenance response for:

- `/up` — health probe lost, so a load balancer or uptime check sees the app as down
- `/payment/doku/notify` — in-flight DOKU callbacks rejected at the edge, with no durable
  `payment_webhook_logs` row, so no local record that they ever arrived
- `/payment/doku/redirect` — customer return path broken

Consequence for the **first** deployment of this candidate: the window that installs the
exceptions is itself the window that lacks them. Mitigations, all imperfect:

| Option | Effect | Residual risk |
| --- | --- | --- |
| Deploy **without** maintenance mode | `/up` and DOKU stay reachable | no admission containment during file replacement |
| Use `schedule:pause` only | stops scheduled work | does not stop HTTP or DOKU; not containment |
| Accept edge rejection for the window | fastest | callbacks may be lost with no local record; DOKU retry is unproven |
| Pre-stage then atomic swap | short window | needs a release-symlink change, which the runbook forbids |

There is **no zero-risk option**. The owner must accept one of these explicitly. This
limitation is inherent to the bootstrap and disappears once this candidate is deployed.

## Readiness

**READY FOR GIT INTEGRATION** as a local candidate. Not ready for build or deployment:
no packaging path exists on `main`, `fs.CANDIDATE` is unchanged, and no signed publication
approval or execution authorization exists.

Tests were run against a disposable local database with a worktree-local `vendor/` and a
generated local `.env`; both were removed afterwards.
