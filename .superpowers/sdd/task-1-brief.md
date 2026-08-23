## Task 1: Characterization and invariant test suite

**Files:**
- Create: `tests/Feature/PaymentProductionInvariantTest.php`

Scope revision: existing six payment test files already provide overlapping coverage and are not modified. Consolidated invariant characterization belongs in new dedicated test file to keep task diff minimal and avoid unrelated churn.

**Interfaces:**
- Consumes current controllers/services and existing factories.
- Produces executable regression cases for later schema/service work.

- [ ] **Step 1: Add failing tests for current financial risks**

Cover duplicate SUCCESS, amount mismatch settlement, aggregate projection, duplicate retry, ambiguous creation, late success, refund obligation uniqueness, and paid-state regression. Assert current failures explicitly so later tasks have measurable targets.

- [ ] **Step 2: Run focused tests**

Run: `php artisan test tests/Feature/PaymentProductionInvariantTest.php`
Expected: failures for missing canonical attempt/projection behavior.

- [ ] **Step 3: Commit characterization tests**

```bash
git add tests/Feature tests/Unit
git commit -m "test: characterize production payment invariants"
```

