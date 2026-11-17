# Cutover callback and worker procedure (V1.0)

Bounded operator procedure for the single production host. It exists so that the
publisher's `cutover` attestation can pin one reviewed document by digest. Pinning
proves *which* procedure was approved; it does not prove anyone executed it.

Scope: `app.dombicenter.com` only. Nothing here applies to staging.

## Hard rules

- **No global maintenance mode.** `php artisan down` is forbidden. It closes the
  whole site, including DOKU callbacks, and it is not reversible by the publisher.
- **Checkout admission is per-route.** `CheckCustomerAdmission` is attached to
  checkout, order and payment-initiation routes only. Never to `/payment/doku/*`,
  `/customer/orders/{order}/track`, or health endpoints.
- **Callbacks stay open.** `/payment/doku/notify` and `/payment/doku/redirect` must
  remain registered without the admission middleware for the whole window.
- **No schema or data command.** No `migrate`, `db:wipe`, `migrate:fresh`, seeding
  or SQL. The release is code-only; the database is the existing one.
- **`.env`, database and storage are never touched** by publication or recovery.

## Preconditions (owner, before the window)

1. Verified checkpoint exists for the current code, captured under the shared lock.
2. Signed approval covers: candidate application SHA, artifact archive digest,
   checkpoint id + manifest digest, and the `cutover` attestation.
3. Approval key custody confirmed; the key is `0600`, outside the app root and
   outside `private-backups`.
4. Queue worker supervisor identity known (command name and log path).
5. Someone other than the executing operator has reviewed this procedure.

## Window procedure

1. **Drain (hold admission, not the site).**
   Set `ADMISSION_CUSTOMER_CHECKOUT=held` in `.env`, then rebuild only the config
   cache: `php artisan config:cache`. New checkout and payment initiation return
   the maintenance message. Existing orders, tracking, and DOKU callbacks keep
   working.
2. **Prove callbacks are ungated.** Record `php artisan route:list --path=payment/doku`
   output showing both routes present with no `admission.customer` middleware.
   This is evidence to archive; it is not something the publisher verifies.
3. **Publish code.** Run the gated publisher once, with the signed approval:
   `python3 scripts/recovery/code_publisher.py publish --production ...`.
   Success means `CODE_PUBLISH_COMPLETE_KEEP_HELD` and a `rollback.json` in the
   operation directory. It does not mean the site is healthy.
4. **Warm caches for the new code.** `php artisan config:cache`, `route:cache`,
   `view:cache`. Route and config caches must be rebuilt so workers and web
   processes load the published code, not the previous opcache entries.
5. **Adopt workers.** Restart the queue workers under the existing supervisor:
   `php artisan queue:restart`. Confirm every worker process has a start time
   after the publication, and that no worker is still running the old release.
6. **Verify before reopening.**
   - `/up` and `/api/health` return 2xx.
   - `php artisan queue:work --once` style probe or supervisor log shows a job
     processed by a new worker.
   - A test DOKU callback (sandbox or replay of an already-initiated payment)
     lands and is persisted. Do not create new payment attempts while held.
   - `.env`, `storage/app/public` and the database file are unchanged by the
     publication, except for the deliberate `ADMISSION_CUSTOMER_CHECKOUT` edit.
7. **Reopen admission.** Set `ADMISSION_CUSTOMER_CHECKOUT=active`, run
   `php artisan config:cache` again, and place one real checkout to confirm.

## Rollback

1. Keep admission held; do not reopen.
2. Read `rollback.json` from the publication operation directory.
3. Run `scripts/recovery/filesystem_checkpoint.py recover` with the recorded
   confirmation string: `RECOVER <root> TO CHECKPOINT <id> <manifest-sha256>`.
   Recovery restores managed code only; `.env`, database and storage are preserved.
4. Rebuild caches and restart workers again (`config:cache`, `route:cache`,
   `view:cache`, `queue:restart`).
5. Verify `/up` + health, then reopen admission only on an explicit decision.

## Stop conditions

- Any DOKU callback fails to persist, or either callback route becomes gated.
- A worker is still on the old release after adoption.
- Checkpoint archive or manifest digest does not match.
- `.env`, database or storage content changes unexpectedly.
- Publication reports anything other than `CODE_PUBLISH_COMPLETE_KEEP_HELD`.
- A second publication is needed while a prior operation is unfinished.
