# Exchange Mandatory Return-Based Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `ExchangeRequest.return_request_id` mandatory, eliminate standalone exchange (restock-like behavior), enforce value-based exchange with proper stock and settlement handling.

**Architecture:** Three-layer: Service enforcement (ExchangeService creates with return, markship only after return received), Controller query filtering (only eligible returns), Frontend (return selection drives items).

**Tech Stack:** PHP 8.2, Laravel 11, MySQL 8, Inertia + React + TypeScript

## Global Constraints

- No new migration until legacy data cleaned (app-layer validation first)
- `return_request_id` UNIQUE constraint uses DB transaction + lockForUpdate, not just exists() check
- Value-based exchange: `replacement_quantity` NOT bounded by return quantity, settlement handles difference
- Return items matched via aggregation per variant (SUM), not per-row
- Return linked to Exchange MUST NOT create settlement adjustment (already true)
- `return_value` = snapshot from ReturnRequest.total_value (not recalculated)
- Exchange create only after Return `received_at_center`
- Exchange markShipped only after Return `received_at_center` or `completed`
- All existing exchange tests that create standalone exchange (no return_request_id) must be updated to use linked return

---
### Task 1: Audit Command — Detect Orphan Exchanges

**Files:**
- Create: `app/Console/Commands/AuditOrphanExchanges.php`

**Interfaces:**
- Produces: Artisan command `exchange:audit-orphans` that scans exchange_requests table, groups by status, outputs counts per status

- [ ] **Step 1: Create the command file**

```php
<?php

namespace App\Console\Commands;

use App\Models\ExchangeRequest;
use Illuminate\Console\Command;

class AuditOrphanExchanges extends Command
{
    protected $signature = 'exchange:audit-orphans';

    protected $description = 'Audit ExchangeRequest records without return_request_id for migration planning';

    public function handle(): int
    {
        $orphans = ExchangeRequest::whereNull('return_request_id')->get();
        $grouped = $orphans->groupBy('status');

        $this->info('=== Orphan Exchange Audit (no return_request_id) ===');
        $this->newLine();

        if ($orphans->isEmpty()) {
            $this->info('No orphan exchanges found. Safe to add NOT NULL constraint.');
            return self::SUCCESS;
        }

        $total = $orphans->count();
        $this->warn("Total orphans: {$total}");

        $rows = [];
        foreach (ExchangeRequest::ALL_STATUSES as $status) {
            $count = $grouped->get($status)?->count() ?? 0;
            if ($count > 0) {
                $rows[] = [$status, $count];
            }
        }
        $this->table(['Status', 'Count'], $rows);

        $this->newLine();
        $this->warn('Action needed before migration:');
        $this->line('- submitted/approved/preparing: cancel or create linked return');
        $this->line('- shipped/received: reconcile physical stock first');
        $this->line('- completed: DO NOT modify (already affected settlement)');
        $this->line('- rejected/cancelled: exempt from UNIQUE constraint (NULL allowed)');

        return self::SUCCESS;
    }
}
```

- [ ] **Step 2: Register the command in `routes/console.php`** (add after existing Schedule lines)

```php
Artisan::command('exchange:audit-orphans', function () {
    $this->call(\App\Console\Commands\AuditOrphanExchanges::class);
})->describe('Audit orphan exchanges without return_request_id');
```

- [ ] **Step 3: Verify command runs**

Run: `php artisan exchange:audit-orphans`
Expected: Shows "No orphan exchanges found" (fresh DB) or table with counts.

- [ ] **Step 4: Commit**

```bash
git add app/Console/Commands/AuditOrphanExchanges.php routes/console.php
git commit -m "feat: add exchange audit command for orphan detection"
```

---
### Task 2: ExchangeService — createRequest Enforce return_request_id

**Files:**
- Modify: `app/Services/ExchangeService.php`
- Test: `tests/Feature/ExchangeWorkflowHardeningTest.php`

**Interfaces:**
- Consumes: `ReturnRequest::class`, `ProductVariant::class`, `ExchangeRequest::class`
- Produces: `createRequest(Outlet, User, array): ExchangeRequest` — throws ValidationException if:
  - `return_request_id` missing
  - Return not found / different outlet / not `received_at_center`
  - Return already used by another exchange
  - Items don't match Return items (aggregated per-variant quantity check)
- Removes: `assertOutletHasAvailableStock()` call (validation now via return items)

- [ ] **Step 1: Write failing tests for createRequest validations**

Update `tests/Feature/ExchangeWorkflowHardeningTest.php` — add these test methods after existing tests:

```php
public function test_create_exchange_requires_return_request_id(): void
{
    $context = $this->makeContext();

    $this->expectException(\Illuminate\Validation\ValidationException::class);
    $this->expectExceptionMessage('return_request_id');

    app(ExchangeService::class)->createRequest($context['outlet'], $context['outletUser'], [
        'items' => [['product_variant_id' => $context['exchangeVariant']->id, 'quantity' => 2]],
    ]);
}

public function test_create_exchange_rejects_return_from_different_outlet(): void
{
    $context = $this->makeContext();
    $otherContext = $this->makeContext();
    $return = $this->createReceivedReturn($context, quantity: 2);

    $otherContext['outletUser']->forceFill(['outlet_id' => $otherContext['outlet']->id])->save();

    $this->expectException(\Illuminate\Validation\ValidationException::class);
    $this->expectExceptionMessage('return_request_id');

    app(ExchangeService::class)->createRequest($otherContext['outlet'], $otherContext['outletUser'], [
        'return_request_id' => $return->id,
        'items' => [['product_variant_id' => $otherContext['exchangeVariant']->id, 'quantity' => 2]],
    ]);
}

public function test_create_exchange_rejects_return_not_received_at_center(): void
{
    $context = $this->makeContext();
    $return = app(ReturnService::class)->createRequest($context['outlet'], $context['outletUser'], [
        'reason' => 'slow_moving',
        'items' => [['product_variant_id' => $context['returnVariant']->id, 'quantity' => 2]],
    ]);
    $return = app(ReturnService::class)->approveRequest($return, $context['owner']);
    // status is 'approved', not 'received_at_center'

    $this->expectException(\Illuminate\Validation\ValidationException::class);
    $this->expectExceptionMessage('return');

    app(ExchangeService::class)->createRequest($context['outlet'], $context['outletUser'], [
        'return_request_id' => $return->id,
        'items' => [['product_variant_id' => $context['exchangeVariant']->id, 'quantity' => 2]],
    ]);
}

public function test_create_exchange_rejects_quantity_exceeding_return(): void
{
    $context = $this->makeContext();
    $return = $this->createReceivedReturn($context, quantity: 2); // only 2 items returned

    $this->expectException(\Illuminate\Validation\ValidationException::class);
    $this->expectExceptionMessage('quantity');

    app(ExchangeService::class)->createRequest($context['outlet'], $context['outletUser'], [
        'return_request_id' => $return->id,
        'items' => [['product_variant_id' => $context['returnVariant']->id, 'quantity' => 3]], // 3 > 2
    ]);
}

public function test_create_exchange_allows_replacement_qty_greater_than_return_qty(): void
{
    // Value-based: replacement_quantity is free, settlement handles difference
    $context = $this->makeContext();
    $return = $this->createReceivedReturn($context, quantity: 2);

    $exchange = app(ExchangeService::class)->createRequest($context['outlet'], $context['outletUser'], [
        'return_request_id' => $return->id,
        'items' => [[
            'product_variant_id' => $context['returnVariant']->id,
            'quantity' => 2,
            'replacement_variant_id' => $context['exchangeVariant']->id,
            'replacement_quantity' => 10, // > 2, value-based allowed
        ]],
    ]);

    $this->assertNotNull($exchange);
    $this->assertSame(10, $exchange->items->first()->replacement_quantity);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test tests/Feature/ExchangeWorkflowHardeningTest.php --filter="test_create_exchange" --verbose`

Expected: Some PASS (already exists with return), some FAIL (new validations not yet implemented).

- [ ] **Step 3: Implement createRequest validation**

Replace the `createRequest` method in `app/Services/ExchangeService.php`:

```php
public function createRequest(Outlet $outlet, User $requester, array $data): ExchangeRequest
{
    return DB::transaction(function () use ($outlet, $requester, $data) {
        if (empty($data['return_request_id'])) {
            throw ValidationException::withMessages([
                'return_request_id' => ['Exchange harus merujuk ke return yang sudah diterima di pusat.'],
            ]);
        }

        $return = ReturnRequest::lockForUpdate()->findOrFail($data['return_request_id']);

        if ((int) $return->outlet_id !== (int) $outlet->id) {
            throw ValidationException::withMessages([
                'return_request_id' => ['Return terkait tidak tersedia untuk outlet ini.'],
            ]);
        }

        if ($return->status !== ReturnRequest::STATUS_RECEIVED_AT_CENTER) {
            throw ValidationException::withMessages([
                'return_request_id' => ['Return harus sudah diterima di pusat sebelum ditukar.'],
            ]);
        }

        // UNIQUE check: return already used by another exchange
        $existingExchange = ExchangeRequest::where('return_request_id', $return->id)->lockForUpdate()->first();
        if ($existingExchange) {
            throw ValidationException::withMessages([
                'return_request_id' => ['Return ini sudah digunakan untuk penukaran lain.'],
            ]);
        }

        // Item validation: aggregate by variant, ensure exchange qty <= return qty
        $returnItemsByVariant = $return->items
            ->groupBy('product_variant_id')
            ->map(fn ($items) => $items->sum('quantity'));

        $exchangeItemsByVariant = collect($data['items'])
            ->groupBy('product_variant_id')
            ->map(fn ($items) => $items->sum('quantity'));

        foreach ($exchangeItemsByVariant as $variantId => $totalQty) {
            $returnQty = (int) ($returnItemsByVariant->get($variantId) ?? 0);
            if ($returnQty === 0) {
                throw ValidationException::withMessages([
                    'items' => ["Variant ID {$variantId} tidak ada dalam return ini."],
                ]);
            }
            if ($totalQty > $returnQty) {
                throw ValidationException::withMessages([
                    'items' => ["Jumlah variant ID {$variantId} melebihi jumlah di return ({$returnQty})."],
                ]);
            }
        }

        $returnValue = (float) $return->total_value;
        $exchangeValue = 0;
        $items = [];

        foreach ($data['items'] as $item) {
            $variant = ProductVariant::lockForUpdate()->findOrFail($item['product_variant_id']);
            $subtotal = $variant->selling_price * $item['quantity'];
            $exchangeValue += $subtotal;

            $replacementVariantId = $item['replacement_variant_id'] ?? null;
            $replacementQuantity = $item['replacement_quantity'] ?? null;

            $items[] = [
                'product_variant_id' => $variant->id,
                'replacement_variant_id' => $replacementVariantId,
                'quantity' => $item['quantity'],
                'replacement_quantity' => $replacementQuantity,
                'unit_price' => $variant->selling_price,
                'subtotal' => $subtotal,
            ];
        }

        $exchange = ExchangeRequest::create([
            'return_request_id' => $return->id,
            'outlet_id' => $outlet->id,
            'requested_by' => $requester->id,
            'notes' => $data['notes'] ?? null,
            'status' => ExchangeRequest::STATUS_SUBMITTED,
            'return_value' => $returnValue,
            'exchange_value' => $exchangeValue,
        ]);

        foreach ($items as $item) {
            $exchange->items()->create($item);
        }

        $this->recordHistory($exchange, null, ExchangeRequest::STATUS_SUBMITTED, $requester->id);

        app(NotificationService::class)->notifyExchangeRequestCreated(
            $exchange->fresh(['outlet', 'items.variant.family', 'returnRequest'])
        );

        return $exchange->load(['items.variant', 'outlet', 'requester', 'returnRequest']);
    });
}
```

- [ ] **Step 4: Remove `assertOutletHasAvailableStock` call from createRequest** (already removed in Step 3 code above — verify no reference remains). Delete the private method `assertOutletHasAvailableStock` if it's no longer called anywhere. Check: is it still used elsewhere? (No — only called from `createRequest`.)

```php
// DELETE the entire assertOutletHasAvailableStock method (lines ~360-387)
```

- [ ] **Step 5: Run tests to verify they now pass**

Run: `php artisan test tests/Feature/ExchangeWorkflowHardeningTest.php --filter="test_create_exchange" --verbose`
Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add app/Services/ExchangeService.php tests/Feature/ExchangeWorkflowHardeningTest.php
git commit -m "feat: enforce return_request_id in exchange create with full validation"
```

---
### Task 3: markShipped — Guard Return Status

**Files:**
- Modify: `app/Services/ExchangeService.php`
- Test: `tests/Feature/ExchangeWorkflowHardeningTest.php`

**Interfaces:**
- Consumes: `ExchangeRequest::class` with loaded `returnRequest`
- Produces: `markShipped(ExchangeRequest, User): ExchangeRequest` — rejects if return status not `received_at_center` or `completed`

- [ ] **Step 1: Write failing tests**

Add to `ExchangeWorkflowHardeningTest.php`:

```php
public function test_mark_shipped_fails_when_return_not_received_at_center(): void
{
    $context = $this->makeContext();
    $return = app(ReturnService::class)->createRequest($context['outlet'], $context['outletUser'], [
        'reason' => 'slow_moving',
        'items' => [['product_variant_id' => $context['returnVariant']->id, 'quantity' => 2]],
    ]);
    $return = app(ReturnService::class)->approveRequest($return, $context['owner']);
    // status is 'approved', not 'received_at_center'

    $exchange = app(ExchangeService::class)->createRequest($context['outlet'], $context['outletUser'], [
        'return_request_id' => $return->id,
        'items' => [['product_variant_id' => $context['returnVariant']->id, 'quantity' => 2]],
    ]);
    $exchange = app(ExchangeService::class)->approveRequest($exchange, $context['owner']);

    $this->expectException(\Illuminate\Validation\ValidationException::class);
    $this->expectExceptionMessage('return');

    app(ExchangeService::class)->markShipped($exchange->fresh(), $context['owner']);
}

public function test_mark_shipped_succeeds_when_return_is_completed(): void
{
    $context = $this->makeContext();
    $return = $this->createReceivedReturn($context, quantity: 2);
    // complete the return
    $return->fresh('items')->items->each(
        fn ($i) => app(ReturnService::class)->storeItem($return->withoutRelations(), $i, $context['owner'])
    );
    app(ReturnService::class)->completeReturn($return->fresh('items'), $context['owner'], notes: 'completed');

    $exchange = app(ExchangeService::class)->createRequest($context['outlet'], $context['outletUser'], [
        'return_request_id' => $return->id,
        'items' => [['product_variant_id' => $context['returnVariant']->id, 'quantity' => 2]],
    ]);
    $exchange = app(ExchangeService::class)->approveRequest($exchange, $context['owner']);

    $result = app(ExchangeService::class)->markShipped($exchange->fresh(), $context['owner']);
    $this->assertSame(ExchangeRequest::STATUS_SHIPPED, $result->status);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test tests/Feature/ExchangeWorkflowHardeningTest.php --filter="test_mark_shipped" --verbose`
Expected: Both FAIL (guard not yet implemented).

- [ ] **Step 3: Add return status guard to `markShipped`**

In `app/Services/ExchangeService.php`, add this after the status guard at the top of `markShipped`:

```php
// Guard: return must be received at center (or completed)
$exchange->loadMissing('returnRequest');
if ($exchange->returnRequest) {
    $returnStatus = $exchange->returnRequest->status;
    if (! in_array($returnStatus, [ReturnRequest::STATUS_RECEIVED_AT_CENTER, ReturnRequest::STATUS_COMPLETED], true)) {
        throw ValidationException::withMessages([
            'return' => ['Return terkait harus sudah diterima di pusat sebelum pengiriman.'],
        ]);
    }
}
```

Also add the import at top of file if not present:
```php
use App\Models\ReturnRequest;
```
(Check: already imported? If yes, skip.)

- [ ] **Step 4: Update `createReceivedReturn` helper to use `storeItem`**

In `ExchangeWorkflowHardeningTest.php`, replace the old `->each->update(['disposition' => 'stored'])` pattern:

```php
private function createReceivedReturn(array $context, int $quantity): ReturnRequest
{
    $return = app(ReturnService::class)->createRequest($context['outlet'], $context['outletUser'], [
        'reason' => 'slow_moving',
        'notes' => 'Return linked to exchange hardening test',
        'items' => [[
            'product_variant_id' => $context['returnVariant']->id,
            'quantity' => $quantity,
        ]],
    ]);

    $return = app(ReturnService::class)->approveRequest($return, $context['owner']);
    $return = app(ReturnService::class)->markReceivedAtCenter($return->fresh('items'), $context['owner']);

    $return->fresh('items')->items->each(
        fn ($i) => app(ReturnService::class)->storeItem($return->withoutRelations(), $i, $context['owner'])
    );

    return $return->fresh();
}
```

- [ ] **Step 5: Run all ExchangeWorkflowHardeningTest tests to verify**

Run: `php artisan test tests/Feature/ExchangeWorkflowHardeningTest.php --verbose`
Expected: All tests PASS (including existing ones).

- [ ] **Step 6: Commit**

```bash
git add app/Services/ExchangeService.php tests/Feature/ExchangeWorkflowHardeningTest.php
git commit -m "feat: guard exchange markShipped with return received_at_center/completed status"
```

---
### Task 4: Update Existing Tests — Link All Exchange Creates to Return

**Files:**
- Modify: `tests/Feature/ExchangeWorkflowHardeningTest.php`
- Modify: `tests/Feature/ReturnExchangeBlockingBugTest.php`
- Modify: `tests/Feature/OwnerReturnExchangeVisibilityTest.php`
- Modify: `tests/Feature/ReturnExchangeOperationalHardeningTest.php`
- Modify: `tests/Feature/InventoryConservationTest.php`

**Goal:** Every test that creates an ExchangeRequest must pass `return_request_id` (or test the rejection).

- [ ] **Step 1: Fix `createApprovedExchange` and `createShippedExchange` helpers**

In `ExchangeWorkflowHardeningTest.php`, update `createApprovedExchange` to accept a `ReturnRequest` and pass `return_request_id`:

```php
private function createApprovedExchange(array $context, ReturnRequest $return, int $quantity): ExchangeRequest
{
    $exchange = app(ExchangeService::class)->createRequest($context['outlet'], $context['outletUser'], [
        'return_request_id' => $return->id,
        'items' => [[
            'product_variant_id' => $context['returnVariant']->id,
            'quantity' => $quantity,
        ]],
        'notes' => 'Exchange hardening test',
    ]);

    return app(ExchangeService::class)->approveRequest($exchange, $context['owner']);
}

private function createShippedExchange(array $context, ReturnRequest $return, int $quantity): ExchangeRequest
{
    $exchange = $this->createApprovedExchange($context, $return, $quantity);
    return app(ExchangeService::class)->markShipped($exchange->fresh(), $context['owner']);
}
```

- [ ] **Step 2: Update all test methods that call these helpers**

For `test_center_stock_decreases_when_exchange_is_shipped`:
```php
$context = $this->makeContext(centerStock: 10, exchangePrice: 30000);
$return = $this->createReceivedReturn($context, quantity: 2);
$exchange = $this->createApprovedExchange($context, $return, quantity: 2);
```

For `test_exchange_shipment_is_blocked_when_center_stock_is_insufficient`:
```php
$context = $this->makeContext(centerStock: 1, exchangePrice: 30000);
$return = $this->createReceivedReturn($context, quantity: 2);
$exchange = $this->createApprovedExchange($context, $return, quantity: 2);
```

For `test_confirm_received_is_idempotent_and_does_not_duplicate_stock`:
```php
$context = $this->makeContext(centerStock: 10, exchangePrice: 30000, outletStock: 5);
$return = $this->createReceivedReturn($context, quantity: 3);
$exchange = $this->createShippedExchange($context, $return, quantity: 3);
```

- [ ] **Step 3: Fix `ReturnExchangeBlockingBugTest.php`**

Update `createExchange` helper to accept a `ReturnRequest` parameter:

```php
private function createExchange(array $context, ReturnRequest $return, int $quantity = 2): ExchangeRequest
{
    return app(ExchangeService::class)->createRequest($context['outlet'], $context['outletUser'], [
        'return_request_id' => $return->id,
        'notes' => 'Exchange request for blocking bug reproduction',
        'items' => [[
            'product_variant_id' => $context['variant']->id,
            'quantity' => $quantity,
        ]],
    ]);
}
```

Add a helper to create a received return:
```php
private function createReceivedReturnForExchange(array $context, int $quantity = 2): ReturnRequest
{
    $return = app(ReturnService::class)->createRequest($context['outlet'], $context['outletUser'], [
        'reason' => 'slow_moving',
        'items' => [['product_variant_id' => $context['variant']->id, 'quantity' => $quantity]],
    ]);
    $return = app(ReturnService::class)->approveRequest($return, $context['owner']);
    $return = app(ReturnService::class)->markReceivedAtCenter($return->fresh('items'), $context['owner']);
    $return->fresh('items')->items->each(
        fn ($i) => app(ReturnService::class)->storeItem($return->withoutRelations(), $i, $context['owner'])
    );
    return $return->fresh();
}
```

Update `test_outlet_can_view_own_exchange_request` and `test_outlet_cannot_view_another_outlet_exchange_request` to:
- Create received return first
- Pass return to `createExchange`

- [ ] **Step 4: Fix `OwnerReturnExchangeVisibilityTest.php`**

Read the test file to find standalone exchange creates and add return_request_id. The two exchange tests likely use createRequest directly or through a helper. Update to create a received return first and link.

- [ ] **Step 5: Fix `ReturnExchangeOperationalHardeningTest.php`**

Same pattern: find standalone exchange creates, add return_request_id with prior received return.

- [ ] **Step 6: Fix `InventoryConservationTest.php`**

Read the exchange tests. They already use `return_request_id` (verified in analysis). No changes needed — but verify by running.

- [ ] **Step 7: Run all exchange-related tests**

```bash
php artisan test \
  tests/Feature/ExchangeWorkflowHardeningTest.php \
  tests/Feature/ReturnExchangeBlockingBugTest.php \
  tests/Feature/OwnerReturnExchangeVisibilityTest.php \
  tests/Feature/ReturnExchangeOperationalHardeningTest.php \
  tests/Feature/InventoryConservationTest.php \
  tests/Feature/InventoryReconcileTest.php \
  --verbose
```

Expected: All PASS.

- [ ] **Step 8: Commit**

```bash
git add tests/
git commit -m "fix: update all tests to use return_request_id for exchange create"
```

---
### Task 5: Update Controllers — Filter Eligible Returns

**Files:**
- Modify: `app/Http/Controllers/Outlet/ExchangeController.php`
- Modify: `app/Http/Controllers/Outlet/ReturnController.php` (index: filter return_request_id untuk pendingReturns)

- [ ] **Step 1: Rename `getPendingReturns` to `getExchangeEligibleReturns`**

In `ExchangeController.php`, replace the method:

```php
private function getExchangeEligibleReturns(int $outletId): \Illuminate\Database\Eloquent\Collection
{
    return ReturnRequest::where('outlet_id', $outletId)
        ->where('status', ReturnRequest::STATUS_RECEIVED_AT_CENTER)
        ->whereDoesntHave('exchangeRequest')
        ->with('items.variant')
        ->get();
}
```

- [ ] **Step 2: Update callers** (`index` and `create` methods)

Replace `$this->getPendingReturns($outlet->id)` with `$this->getExchangeEligibleReturns($outlet->id)`.
Update the Inertia prop name from `pendingReturns` to `exchangeEligibleReturns`.

- [ ] **Step 3: Update `store` validation to require return_request_id**

```php
public function store(Request $request, ExchangeService $service): RedirectResponse
{
    $outlet = $request->user()->outlet;
    abort_unless($outlet, 403);

    $validated = $request->validate([
        'return_request_id' => 'required|integer|exists:return_requests,id',
        'notes' => 'nullable|string|max:1000',
        'items' => 'required|array|min:1',
        'items.*.product_variant_id' => 'required|integer|exists:product_variants,id',
        'items.*.quantity' => 'required|integer|min:1',
    ]);

    $service->createRequest($outlet, $request->user(), $validated);

    return redirect()->route('outlet.exchanges.index')->with('success', 'Exchange request submitted.');
}
```

Key change: `'return_request_id' => 'required|integer|exists:return_requests,id'` (was `nullable`).

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/Outlet/ExchangeController.php
git commit -m "fix: make return_request_id required in controller, filter eligible returns"
```

---
### Task 6: Frontend — Update Create Exchange UI (Page + Modal)

**Files:**
- Modify: `resources/js/pages/outlet/exchanges/create.tsx`
- Modify: `resources/js/components/outlet/exchange-create-dialog.tsx`

**Goal:** Remove "Tanpa return" option, make return selection mandatory. After selecting a return, show return items (read-only) as the items to exchange.

- [ ] **Step 1: Update `create.tsx`**

Key changes:
1. Prop name: `pendingReturns` → `exchangeEligibleReturns`
2. Remove "Tanpa return" option (no empty value)
3. Auto-sync items from selected return items
4. Remove outletInventory from product selection (items come from return)

```tsx
export default function OutletExchangesCreate({
    variants,
    outletInventory,
    exchangeEligibleReturns,
}: any) {
    const form = useForm({
        return_request_id: null as number | null,
        notes: '',
        items: [] as FormItem[],
    });

    const [selectedReturnId, setSelectedReturnId] = useState<number | null>(null);
    const selectedReturn = exchangeEligibleReturns.find((r: any) => r.id === selectedReturnId);
    const [pairs, setPairs] = useState<PairedItem[]>([
        {
            return_variant_id: 0,
            return_quantity: 1,
            replacement_variant_id: 0,
            replacement_quantity: 1,
        },
    ]);

    const handleReturnSelect = (returnId: number) => {
        setSelectedReturnId(returnId);
        // Reset pairs to match return items
        const ret = exchangeEligibleReturns.find((r: any) => r.id === returnId);
        if (ret?.items) {
            const newPairs = ret.items.map((item: any) => ({
                return_variant_id: item.product_variant_id,
                return_quantity: item.quantity,
                replacement_variant_id: 0,
                replacement_quantity: 1,
            }));
            setPairs(newPairs);
            syncForm(newPairs);
        }
        form.setData('return_request_id', returnId);
    };
```

Replace the "Link to return" section:

```tsx
{/* Mandatory Return Selection */}
{exchangeEligibleReturns.length === 0 ? (
    <div className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
        Tidak ada return yang sudah diterima pusat. Buat return terlebih dahulu.
    </div>
) : (
    <div className="mb-4">
        <label className="text-xs font-semibold text-text-muted">
            Pilih Return
        </label>
        <select
            value={selectedReturnId ?? ''}
            onChange={(e) => handleReturnSelect(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2.5 text-sm"
        >
            <option value="">Pilih return...</option>
            {exchangeEligibleReturns.map((r: any) => (
                <option key={r.id} value={r.id}>
                    Return #{r.id} - {formatCurrency(r.total_value)}
                    {r.items && ` (${r.items.length} item)`}
                </option>
            ))}
        </select>
    </div>
)}
```

Keep the pairs section but note: return_variant_id is now set automatically from return selection. The user only chooses the replacement variant + qty per item.

- [ ] **Step 2: Update `exchange-create-dialog.tsx`** — same pattern but as modal
- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/outlet/exchanges/create.tsx resources/js/components/outlet/exchange-create-dialog.tsx
git commit -m "feat: mandatory return selection in exchange create UI"
```

---
### Task 7: Remove Old `assertOutletHasAvailableStock` Method

**Files:**
- Modify: `app/Services/ExchangeService.php`
- Modify: `app/Services/ReturnService.php` (check if a similar method used by exchange is now dead code)

- [ ] **Step 1: Verify `assertOutletHasAvailableStock` is not called**

Search: `grep -r "assertOutletHasAvailableStock" app/` — should only show the method definition.

- [ ] **Step 2: Delete the method** (if no callers). In `ExchangeService.php`, remove the private method.

- [ ] **Step 3: Search for `assertOutletHasAvailableStock` in ExchangeService**

Confirm no other reference. If found only in definition, delete it.

- [ ] **Step 4: Run tests**

Run: `php artisan test tests/Feature/ExchangeWorkflowHardeningTest.php --verbose`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Services/ExchangeService.php
git commit -m "refactor: remove unused assertOutletHasAvailableStock from ExchangeService"
```

---
### Task 8: Full Test Suite

- [ ] **Step 1: Run ALL tests**

```bash
php artisan test
```

Expected: All 1025+ tests PASS.

- [ ] **Step 2: Run JS tests and build**

```bash
npm run build
npm test
```

Expected: All JS tests PASS, build OK.

- [ ] **Step 3: Fix any failures** iteratively.

- [ ] **Step 4: Final commit with any fixes** and push.

```bash
git push origin develop
```

---
### Post-Deployment: DB Constraints (separate PR)

**Files:**
- Create: Migration to add UNIQUE + NOT NULL

After the app validation has been deployed and legacy data cleaned:

1. Add UNIQUE constraint on `return_request_id` (allows multiple NULLs in MySQL)
2. After confirming no NULLs exist, add MODIFY COLUMN `return_request_id` NOT NULL

This is intentionally OUTSIDE this plan's scope.
