# Task 11 Report

## Scope
- `RefundService` now writes destination data to locked canonical obligations, transitions pending→in_progress, pending→rejected, in_progress→pending, and in_progress→completed, including proof/reference/note; Order fields remain compatibility projections.
- Canonical obligation amount binds refund projection and lifecycle validation to selected payment attempt.
- Payload, finance filters, and proof delivery read canonical obligation state/data with legacy fallback only for compatibility.
- Synthetic legacy attempts carry provenance and verified=false and are excluded from trusted attempt selection.
- Order selected obligation resolution is reason-scoped and deterministic by non-synthetic payment attempt.
- No DOKU refund invocation added.

## Verification
- Refund suite: 99 passed, 247 assertions.
- `composer run lint:check`: passed.
- `graphify update .`: passed.

## Changed files
- `app/Services/RefundService.php`
- `app/Services/RefundPayloadService.php`
- `app/Http/Controllers/Owner/FinanceSettlementController.php`
- `app/Http/Controllers/RefundProofController.php`
- `app/Models/Order.php`
- `app/Models/PaymentAttempt.php`
- `tests/Feature/RefundObligationTest.php`
