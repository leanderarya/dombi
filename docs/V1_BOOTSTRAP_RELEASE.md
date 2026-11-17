# V1.0 bootstrap release integration and first-deployment envelope

Status: **PREPARED / INACTIVE.** No Git publication, activation, reviewer change,
SSH write or deployment has been performed. Both production activation constants
remain `False` and `PRODUCTION_DEPLOY_ENABLED` remains unset.

## 1. Payload identity

`main` at `e20213a7` differs from the accepted staging candidate
`220a0190ec57c8ed64f5792dcaa10c7ca906f2b7` in exactly **six** artifact files:

| File | Change |
| --- | --- |
| `app/Http/Middleware/CheckCustomerAdmission.php` | new — per-route admission gate |
| `config/admission.php` | new — defaults to `held` |
| `bootstrap/app.php` | maintenance exceptions for `up` and the two DOKU URIs; admission alias |
| `routes/web.php` | admission on checkout/order/pay only; DOKU callbacks untouched |
| `app/Models/Order.php` | candidate revision |
| `app/Http/Controllers/Owner/FinanceSettlementController.php` | candidate revision |

After integrating those six files at candidate content, the local tree's artifact
payload is **byte-identical to `220a0190`**: 482 payload files compared, **0
differ**, **0 missing**, and a reverse check found no candidate-only file absent
here.

### What this proves, and what it does not

This is **code equivalence**. It is not staging acceptance. The receipt
`14310493554` certifies the candidate *as deployed and exercised on staging*; it
does not transfer to a new commit, and no staging run has exercised this
combination of main's history plus the six files.

`main` carries 16 commits the candidate's branch does not, including production
hardening (DOKU invoice namespace isolation, owner bootstrap/recovery, scoped DB
grants). Every one of those files is **byte-identical** in the candidate, so the
integration loses no main-only fix and reintroduces no swapped-out code.

## 2. Schema and environment compatibility

- **No migration is added or changed.** `git diff main..candidate -- database/` is
  empty. Bootstrap execution therefore includes no schema step, and the existing
  production database is untouched.
- `config/admission.php` reads `env('ADMISSION_CUSTOMER_CHECKOUT', 'held')`. The
  production `.env` has **no** such key, so the effective value is `held` —
  checkout stays closed with no `.env` edit required.
- `.env.example` says `open`, which is the developer default, not the production
  default. This discrepancy is intentional (example file for fresh installs) but
  is worth noting: copying `.env.example` over production would open admissions.

## 3. Callback and maintenance safety

- `/payment/doku/notify` and `/payment/doku/redirect` are registered with **no**
  admission middleware and are asserted so by test.
- `preventRequestsDuringMaintenance` exempts exactly `up`,
  `payment/doku/notify`, `payment/doku/redirect` — exact paths, no wildcards. If an
  operator ever runs `artisan down`, health and in-flight callbacks survive while
  everything else is closed.

## 4. Workflow change in this integration

The `gate` job no longer declares `environment: production`.

It reads a source constant and a repository variable and consumes **no secrets**,
so binding it to a protected environment made every push to `main` wait on a human
reviewer merely to evaluate a boolean. That is now proven directly: the run
triggered by PR #55's merge sat `waiting` on `required_reviewers: 1`.

| Job | Environment | Secrets | Effect |
| --- | --- | --- | --- |
| `gate` | none | none | completes as soon as CI runs |
| `deploy` | `production` | SSH set | still requires the reviewer |
| `rollback` | `production` | SSH set | still requires the reviewer |

A disabled gate now finishes, writes `enabled=false`, and the `deploy` job is
**skipped** by `needs`+`if` — never run, not merely failed.

### Consequence for later releases

While the `production` environment keeps `required_reviewers: 1`, **every**
automatic `main` deployment will pause for approval. That is a deliberate second
control. It must be changed by an explicit owner decision, not silently. This
document does not propose changing it.

## 5. Inactive-trigger evidence

- `PRODUCTION_DEPLOY_ACTIVATED = False` in `production_deploy_transport.py` and
  `production_ssh_transport.py`; no `= True` in non-test source.
- `PRODUCTION_DEPLOY_ENABLED` unset.
- In-process: `run_phase('deploy', …)` raises
  `production_transport_not_activated` with **0 subprocess calls**.
- Push to `main` with activation off cannot reach a host step.

## 6. Backup and recovery gates (reused, not new)

`scripts/recovery/single_owner_deploy.py`, unchanged by this integration:

| Gate | Behaviour |
| --- | --- |
| Capacity refusal | `insufficient_space` before any directory is created when free space ≤ `2×payload + backup + 1 MiB` |
| Backup | digest-verified `0600` tar of every file the deploy may overwrite, written **before** the first rename |
| Protected paths | `.env*`, `storage/`, `database/` (except `database/migrations`), `public/storage`, `.git`, `node_modules` never written, archived or restored |
| Rollback | restores that exact operation; repeatable; refuses a tampered backup |
| Dropped files | reported in `stale_not_removed`, preserved, never silently deleted |
| Failure | journals `AUTHORIZED_NOT_COMPLETED`, never claims completion |

**Not claimed:** tree-atomic replacement (the host needs a real app-root directory,
so the mixed-code window is bounded to the rename loop, not zero), and worker
adoption (the pipeline never restarts workers; whether a long-lived daemon exists
is unverified).

## 7. Verification performed

```
php -l (6 payload files)                                        # no syntax errors
python3 -m unittest discover -s scripts/ci -p 'test_*.py'       # 78 passed
python3 -m unittest discover -s scripts/recovery -p 'test_*.py' # 21 passed
release.py pack/verify roundtrip                                # PASS, 509 runtime files
payload byte-equivalence vs 220a0190                            # 482 files, 0 differ
git diff --check                                                # OK
workflow YAML parse, no duplicate keys                           # OK
```

No PHP feature suite ran here: `vendor/` is absent in this worktree, so Laravel
tests need a CI run. That is the one unproven local dimension.

## 8. First-deployment envelope (separate approval)

**Publication envelope (this PR).**

> Authorized: publish the eight-file bootstrap integration (six payload files, the
> `deploy-production.yml` gate change and its test) to `main` as one pull request,
> with both activation constants `False`, `PRODUCTION_DEPLOY_ENABLED` unset, and no
> environment, secret or reviewer change.
>
> Not authorized: merge, activation, dispatch, or host access.

**Activation envelope (later, distinct).**

> Authorized: flip both `PRODUCTION_DEPLOY_ACTIVATED` constants to `True`, set
> `PRODUCTION_DEPLOY_ENABLED = true`, approve the `production` environment review
> for exactly one run, and allow one deployment of that merge commit to
> `/home/u399215191/dombicenter.com/public_html/app` with checkout HELD, no
> migration, no cache command, no worker restart and no DOKU probe.
>
> Not authorized: a second deployment, any rollback not required by a failed
> verification, or reopening admissions.

## 9. STOP conditions

- Any payload file not byte-identical to the accepted candidate.
- A migration, `.env` value or storage path in the integration.
- A DOKU callback route gated by admission, or dropped from maintenance exceptions.
- Either activation constant `True` before activation approval.
- `gate` declaring a protected environment again.
- Artifact name not `release-<merge sha>`.
- Backup digest mismatch or a deploy without `outcome.json`.
