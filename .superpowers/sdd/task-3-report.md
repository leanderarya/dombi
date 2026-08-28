# Task 3 report

Added focused coverage for DOKU reconciliation and late callbacks:

- Unknown attempts receive 24-hour reconciliation deadline.
- Unknown attempts past deadline transition to failed and expire non-terminal order.
- Already expired attempts are idempotent and not transitioned again.
- Reconciliation preserves existing deadlines and records `next_reconciliation_at` backoff.
- Expiry sweep fixtures prove only due `unknown` attempts expire; future unknown and due non-unknown attempts remain unchanged.
- Late success on expired order remains terminal and creates exactly one `late_payment` RefundObligation.
- Late refund assertions cover order terminal state, invoice identity, attempt identity, amount, currency, reason/source, pending status, and idempotent reuse.

Production code unchanged; existing implementation satisfies scenarios.

Checks:

- `php -l tests/Feature/DokuReconciliationTest.php` passed.
- `php -l tests/Unit/CanonicalPaymentTransitionServiceTest.php` passed.
- `git diff --check` passed.
- Focused PHPUnit unavailable: `vendor/bin/phpunit` is not installed.
- `graphify update .` passed; graph rebuilt with 7,304 nodes and 18,673 edges.
