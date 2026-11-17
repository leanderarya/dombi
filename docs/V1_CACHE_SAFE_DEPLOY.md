# Cache-safe first deployment (V1.0)

Status: **IMPLEMENTED / NOT AUTHORIZED.** Local implementation and tests only. No
Git publication, activation, cache command on a host, deployment or rollback has
been performed.

## The defect this closes

Production runs `334637a9` with compiled caches from **2026-11-16**:

```
bootstrap/cache/config.php      32,270 B
bootstrap/cache/routes-v7.php  438,576 B
```

Neither contains an `admission` reference. The V1.0 payload adds
`config/admission.php` (default `held`) and admission middleware on checkout
routes — but Laravel loads **compiled** routes and config when they exist. The
artifact ships only `app/ config/ routes/ resources/views/ database/migrations/`
plus five entry files, and `bootstrap/cache/` was treated as protected.

So a source-only deploy would leave the old compiled routes in place, the new gate
would never run, and **checkout would stay open while the config said held**. That
is the failure mode this change exists to prevent.

## What the deployment now does

Publication became a three-phase transaction with one verified baseline:

| Phase | Action | On failure |
| --- | --- | --- |
| 0. Backup | Tar of all managed source **plus** `bootstrap/cache/config.php` and `routes-v7.php`, digest-verified, `0600` | abort before any mutation |
| 1. Stage | Copy every release file into private same-device staging, fsynced | production untouched |
| 2. Commit | Rename-only `os.replace` per file, fsync parent | (interruption leaves backup intact) |
| 3. Rebuild | `config:cache` then `route:cache`, one at a time, exit status checked | **restore source + caches** |
| 4. Prove | Boot the app with the same PHP binary; assert admission resolves `held` and both DOKU routes exist ungated | **restore source + caches** |

`config:cache` is checked before `route:cache` runs, so a broken config cache is
never compounded by a route cache built on top of it.

### Why the caches are in the *same* archive

A source-only backup cannot restore a working runtime. Restoring old source over
rebuilt caches, or new source under old caches, are both broken states. Capturing
both in one digest-verified archive means rollback restores a matched pair or
raises — it cannot half-restore.

Only the two compiled artifacts are treated this way. `packages.php`,
`services.php` and any operator file in `bootstrap/cache` are neither rebuilt nor
archived, and tests assert they survive deploy *and* rollback byte-identically.

### Effective-state proof, not file inspection

`require_effective_held()` boots `bootstrap/app.php` with the resolved PHP binary
and reads the value the framework actually resolved:

```php
$state = strtolower(trim((string) config('admission.customer_checkout', 'held')));
$held  = ! in_array($state, ['active', 'open'], true);
```

plus the registered URIs and middleware for `payment/doku/*`. A config file saying
`held` is not evidence; this is. It refuses when:

- the resolved state is `active`/`open` or anything unrecognized → `admission_not_held`
- either DOKU callback is missing → `doku_route_missing`
- either DOKU callback carries admission middleware → `doku_route_gated`
- the app fails to boot → `effective_state_probe_failed`

## PHP interpreter handling

`resolve_php()` tries `/opt/alt/php83/usr/bin/php`, then `/usr/bin/php8.3`, then
`/usr/bin/php`, and accepts only a binary whose `PHP_VERSION` starts `8.3.`
Anything else is `php_binary_missing_or_wrong_version` — a refusal, not a rebuild
with the wrong interpreter. Preflight resolves it up front so a missing binary is
caught before publication, not after.

## Preserved throughout

`.env`, `database/`, `storage/`, `public/storage`, cron and unrelated
`bootstrap/cache` entries. No `artisan down`/`up`, no migration, no SQL, no queue
restart, no DOKU probe, no cache *clear*.

## Test coverage (94 recovery tests, was 21)

Cache-specific: baseline captures both caches and excludes the operator file;
archive contains source + caches together; rebuild happens only after source
commit and sees the new code; probe runs after rebuild; outcome records
commands + baseline + effective evidence; failure after `config:cache` restores
both; `admission_not_held` restores both and claims no completion; missing DOKU
route aborts and restores; wrong PHP aborts before rebuild; a failed restore is
journalled as `AUTO_RESTORE_FAILED_KEEP_HELD` rather than hidden; rollback
restores caches with source; repeated rollback is idempotent; a tampered baseline
with a swapped cache member is refused; a partial cache write is reverted;
`KeyboardInterrupt` mid-rebuild restores both and never writes `outcome.json`.

Real-helper tests (unstubbed): wrong/missing PHP refused, correct version accepted,
`config:cache` failure stops the sequence, order is config→route, probe refuses
`open`/unknown state/missing callback/gated callback/failed boot, and the child
environment strips secrets.

## Residual risks — unchanged and not claimed away

- **Mixed-code window is not zero.** The host requires a real application root, so
  release-directory symlink activation is unavailable. Phase 2 is rename-only, so
  the window is bounded to the rename loop, but a request spanning it can see a
  mix. Cache content during that window is the *old* compiled cache, which is
  consistent with the old code still being partially served.
- **Callback continuity is untested.** The check is code-level plus route
  registration in a booted app. It cannot prove DOKU delivery, and no probe was run.
- **Worker adoption is unverified.** Queue is cron-driven with no daemon found, so
  workers pick up new code on the next tick. No restart is performed.
- **Account quota still unknown.** CloudLinux LVE quota is unreadable to the
  account; `df` shows 11 TB free on a 21 TB filesystem. The tool's preflight
  (`free > 2×payload + backup + 1 MiB`) passes with ~102,000× headroom on
  filesystem space, but that is **not** an account-quota guarantee and the
  safeguard is not bypassed.

## Envelopes

**PR publication (scoped).**

> Authorized: publish this two-file change (`single_owner_deploy.py` and its test)
> to `main` as one pull request, with both activation constants `False`,
> `PRODUCTION_DEPLOY_ENABLED` unset, and no host access.
>
> Not authorized: merge, activation, dispatch, or any cache command.

**First deployment (separate, later).**

> Authorized: one deployment of `release-<merge sha>` to
> `/home/u399215191/dombicenter.com/public_html/app` with admissions HELD, which
> now includes `config:cache` and `route:cache` under PHP 8.3 after publication,
> followed by the effective-state proof; no migration, no queue restart, no DOKU
> probe.
>
> Not authorized: a second deployment, any cache *clear*, global maintenance mode,
> or a rollback not required by a failed verification.

## STOP conditions

- Effective admission resolves anything other than `held`.
- Either DOKU callback missing, or carrying admission middleware.
- No PHP 8.3 binary resolves.
- Backup digest mismatch, or a baseline whose cache members do not match the archive.
- A cache command fails and the automatic restore also fails.
- Account quota unavailable **and** the operator rejects proceeding on filesystem
  free space alone.
