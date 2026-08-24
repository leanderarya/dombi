# Task 11 Report

## Scope
- Finance base query now starts from shared `withCanonicalRefund` selector; queue filters/counts remain canonical status constrained.
- Payload selected obligation is cached per Order, keeping canonical status mapping at response boundary.
- `startAndComplete` locks and gates canonical obligation status first; legacy payment status only fallback when obligation absent.
- Synthetic provenance excluded from canonical selector.

## Verification
- Refund suite: 104 passed, 272 assertions.
- `composer run lint:check`: passed.
- `graphify update .`: passed.
