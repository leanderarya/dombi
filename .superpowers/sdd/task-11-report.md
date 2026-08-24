# Task 11 Report

## Scope
- Refund payloads read selected canonical obligations first, with legacy Order fields as compatibility fallback.
- Finance refund queue filters use canonical obligation statuses and destination presence.
- Proof delivery resolves completed canonical obligation proof, then legacy proof fallback.
- RefundService locks canonical obligation during lifecycle entry where present; legacy Order checks remain compatibility safeguards.
- Synthetic legacy attempts carry `synthetic_legacy_refund` provenance and `verified=false`; verified attempt selection excludes them.
- Order selected obligation resolution is reason-scoped and deterministic by selected non-synthetic payment attempt.
- No DOKU refund invocation added.

## Verification
- Refund suite: `php artisan test tests/Feature/RefundServiceTest.php tests/Feature/RefundRouteContractTest.php tests/Feature/CustomerRefundExperienceTest.php tests/Feature/RefundObligationTest.php tests/Feature/RefundPayloadPrivacyTest.php tests/Feature/RefundProofAccessTest.php --compact` — 99 passed, 247 assertions.
- `composer run lint:check` — passed.
- `graphify update .` — passed.

## Changed files
- `app/Services/RefundService.php`
- `app/Services/RefundPayloadService.php`
- `app/Http/Controllers/Owner/FinanceSettlementController.php`
- `app/Http/Controllers/RefundProofController.php`
- `app/Models/Order.php`
- `app/Models/PaymentAttempt.php`
- `tests/Feature/RefundObligationTest.php`
