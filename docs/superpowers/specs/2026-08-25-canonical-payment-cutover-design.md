# Canonical Payment Cutover Design

## Decision

Make `PaymentAttempt` the only runtime payment source and `RefundObligation` the only runtime refund source for staging canonical-only operation. Keep legacy models, tables, and migrations for audit and rollback. Do not touch production data.

## Runtime boundary

- Checkout, webhook, status sync, and payment transitions read/write `PaymentAttempt`.
- Runtime does not create, query, or require `payment_transactions`.
- Legacy backfill remains an explicit maintenance command only.
- Legacy refund repair remains available only as an explicit compatibility operation; normal refund flow uses `RefundObligation`.

## Verifier

Replace cutover-parity verification with canonical runtime verification:

- legacy writes resolve to `false`;
- canonical payment attempts have valid order/invoice/amount/currency state;
- refund obligations reference valid attempts and orders;
- no `PAYMENT_CUTOVER_AT` requirement;
- no dependency on legacy transaction rows.

Keep command name compatibility where practical, but change description/output to canonical verification.

## Staging cleanup

Add protected command for staging legacy data cleanup. It must:

- require `APP_ENV=staging`;
- require a MySQL database name matching configured staging identity;
- require explicit `--confirm-staging`;
- print row counts before deletion;
- delete legacy transaction data and legacy payment fields only from staging;
- never drop tables or migrations;
- refuse production, testing, unknown, or mismatched database targets.

Cleanup is executed only after tests and deployment verification pass.

## Verification

Required before completion:

- targeted canonical payment tests;
- full PHP test suite;
- migration parity/disposable database check;
- frontend format/typecheck/build/lint checks available in repository;
- canonical verifier command;
- staging deployment health check;
- staging data cleanup command with explicit confirmation;
- post-cleanup canonical payment smoke test.

No production cleanup or deployment is part of this task.
