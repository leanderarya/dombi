# Task 12 Report

## Findings fixed

- CI workflow now runs on pull requests and pushes to `main`/`master`, enabling MySQL/PostgreSQL Task 12 matrix execution.
- Fulfilment migration checks duplicate `order_completed` keys before MySQL ALTER/trigger/index DDL.
- MySQL partial migration reruns safely: existing completion key column is detected, triggers are dropped/recreated, and existing unique index is detected before replacement.
- Migration regression verifies duplicate detection precedes schema alteration and rerunnable trigger handling.

## Verification

- `PaymentFulfilmentConcurrencyTest` — passed, 11 tests / 42 assertions.
- `PaymentCreationIdempotencyTest` + `PaymentRetryTest` — passed, 30 tests / 76 assertions.
- `composer run lint:check` — passed.
- `graphify update .` — passed: 7,213 nodes, 18,392 edges, 475 communities; aggregated graph HTML generated.
- Production CI matrix remains configured for MySQL 8.4 and PostgreSQL 16; local driver: MySQL.
