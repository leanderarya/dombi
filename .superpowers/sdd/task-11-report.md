# Task 11 Report

## Scope
- Refund requests now create canonical `RefundObligation` records through `RefundObligationService`.
- Existing `Order` refund fields and history remain compatibility projections for current manual workflow.
- Legacy paid orders without payment attempts receive synthetic attempts marked `synthetic_legacy_refund` and `verified=false`; they are never selected as verified payment attempts.
- Order obligation relation is constrained to the order's selected refund reason.
- No DOKU refund invocation added.

## Verification
- `php artisan test tests/Feature/RefundServiceTest.php tests/Feature/RefundRouteContractTest.php tests/Feature/CustomerRefundExperienceTest.php tests/Feature/RefundObligationTest.php --compact` — 79 passed, 213 assertions.
- `composer run lint:check` — passed.
- `graphify update .` — passed.

## Changed files
- `app/Services/RefundService.php`
- `app/Models/Order.php`
- `tests/Feature/RefundObligationTest.php`
