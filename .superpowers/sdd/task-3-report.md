# Task 3 report

Added focused coverage for DOKU reconciliation and late callbacks:

- Unknown attempts receive 24-hour reconciliation deadline.
- Unknown attempts past deadline transition to failed and expire non-terminal order.
- Already expired attempts are idempotent and not transitioned again.
- Late success on expired order remains terminal and creates exactly one `late_payment` RefundObligation.

Production code unchanged; existing implementation satisfies scenarios.

Checks:

- `php artisan test --filter='DokuReconciliation|CanonicalPaymentTransitionService|Refund'` unavailable: artisan has no `test` command.
- `./vendor/bin/phpunit --filter=...` unavailable: vendor dependencies are not installed.
- `git diff --check` passed.
- `graphify update .` pending.
