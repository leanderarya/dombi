# Delivery Cost Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show Kurir Dombi vs Biaya Gojek/Grab breakdown in owner finance outlet-detail with single-pass conditional aggregation query.

**Architecture:** Single DB round-trip using CASE WHEN in SQL, PHP memory computation for nets, controller passes deliveryStats prop, frontend renders 2 rows with profit/loss colors.

**Tech Stack:** Laravel 13, MySQL 8+, React 19 + Inertia, TypeScript

## Global Constraints
- Must use single-pass query: DB::table('deliveries')->join('orders')->selectRaw with COUNT(CASE WHEN courier_type = 'dombi') and SUM(CASE WHEN ...)
- No try-catch for missing columns — let QueryException crash. Deployment must run `php artisan migrate --force`
- courier_type values exactly: 'dombi' and 'eksternal' (lowercase)
- Delivery fee source: orders.delivery_fee where orders.status = Order::STATUS_COMPLETED
- Cost source: deliveries.courier_cost where courier_type = 'eksternal'
- Frontend must show 2 rows only: Kurir Dombi and Biaya Gojek/Grab, with count, fee, cost, net
- Net negative must be red with "Rugi" badge, positive emerald

---

### Task 1: Backend Single-Pass Aggregation

**Files:**
- Modify: `app/Services/SettlementReconciliationService.php:67-108`

**Interfaces:**
- Consumes: Order::STATUS_COMPLETED, DB::table
- Produces: getOutletReconciliation returns array with new keys: dombi_delivery_count (int), dombi_delivery_fee (float), eksternal_delivery_fee (float), eksternal_courier_cost (float), eksternal_delivery_count (int), dombi_net_income (float), eksternal_net_income (float), total_delivery_fee (float), net_delivery_income (float)

- [ ] **Step 1: Replace courier aggregation with single-pass query**

Open `app/Services/SettlementReconciliationService.php`. Delete lines 67-87 (try-catch block). Replace with:

```php
use Illuminate\Support\Facades\DB;

// Courier cost aggregation — single-pass conditional aggregation (no try-catch, let it crash if column missing)
$stats = DB::table('deliveries')
    ->join('orders', 'deliveries.order_id', '=', 'orders.id')
    ->where('orders.outlet_id', $outletId)
    ->where('orders.status', Order::STATUS_COMPLETED)
    ->selectRaw("
        COUNT(CASE WHEN deliveries.courier_type = 'dombi' THEN 1 END) as dombi_count,
        SUM(CASE WHEN deliveries.courier_type = 'dombi' THEN orders.delivery_fee ELSE 0 END) as dombi_fee,
        COUNT(CASE WHEN deliveries.courier_type = 'eksternal' THEN 1 END) as eksternal_count,
        SUM(CASE WHEN deliveries.courier_type = 'eksternal' THEN orders.delivery_fee ELSE 0 END) as eksternal_fee,
        SUM(CASE WHEN deliveries.courier_type = 'eksternal' THEN deliveries.courier_cost ELSE 0 END) as eksternal_cost
    ")
    ->first();

$dombiCount = (int) ($stats->dombi_count ?? 0);
$dombiFee = (float) ($stats->dombi_fee ?? 0);
$eksternalCount = (int) ($stats->eksternal_count ?? 0);
$eksternalFee = (float) ($stats->eksternal_fee ?? 0);
$eksternalCost = (float) ($stats->eksternal_cost ?? 0);

$dombiNet = $dombiFee;
$eksternalNet = $eksternalFee - $eksternalCost;
$totalDeliveryFee = $dombiFee + $eksternalFee;
$netDeliveryIncome = $totalDeliveryFee - $eksternalCost;
```

- [ ] **Step 2: Update return array**

In same file, update return array (around line 89-108) to include new keys:

```php
return [
    'center_share' => $centerShare,
    'sales_amount' => $salesAmount,
    'delivery_fees' => $deliveryFees,
    'gross_revenue' => $salesAmount + $deliveryFees,
    'verified_payments' => $verifiedPayments,
    'pending_payments' => $pendingPayments,
    'rejected_payments' => $rejectedPayments,
    'adjustments' => $adjustments,
    'outstanding' => $outstanding,
    'last_payment' => $lastPayment ? [
        'date' => $lastPayment->payment_date->toDateString(),
        'amount' => (float) $lastPayment->amount,
        'reference' => $lastPayment->reference_number,
    ] : null,
    'total_delivery_fee' => $totalDeliveryFee,
    'dombi_delivery_count' => $dombiCount,
    'dombi_delivery_fee' => $dombiFee,
    'dombi_net_income' => $dombiNet,
    'eksternal_delivery_count' => $eksternalCount,
    'eksternal_delivery_fee' => $eksternalFee,
    'eksternal_courier_cost' => $eksternalCost,
    'eksternal_net_income' => $eksternalNet,
    'net_delivery_income' => $netDeliveryIncome,
];
```

- [ ] **Step 3: Ensure imports**

Top of file should have:
```php
use Illuminate\Support\Facades\DB;
use App\Models\Order;
```
Remove unused `use App\Models\Delivery;` if no longer used elsewhere in file (keep if used elsewhere, but check — Delivery is no longer used after replacement).

- [ ] **Step 4: Run test**

```bash
php artisan test --filter=SettlementCourierCostTest -v
```

Expected: PASS. The test creates deliveries with courier_type and checks eksternal_courier_cost. With new query, it should still pass.

- [ ] **Step 5: Commit**

```bash
git add app/Services/SettlementReconciliationService.php
git commit -m "feat: single-pass CASE WHEN aggregation for delivery cost breakdown"
```

---

### Task 2: Controller Pass deliveryStats

**Files:**
- Modify: `app/Http/Controllers/Owner/FinanceSettlementController.php:210-275`

**Interfaces:**
- Consumes: SettlementReconciliationService::getOutletReconciliation(int $outletId) returns array with dombi_delivery_count, dombi_delivery_fee, eksternal_delivery_count, etc.
- Produces: Inertia props include deliveryStats array with dombi_count, dombi_fee, dombi_net, eksternal_count, eksternal_fee, eksternal_cost, eksternal_net, total_fee, net_income

- [ ] **Step 1: Inject SettlementReconciliationService and get reconciliation**

In `outletDetail()` method, at top after settlements query, add:

```php
use App\Services\SettlementReconciliationService;

public function outletDetail(Outlet $outlet, SettlementReconciliationService $reconciliationService): Response
{
    // ... existing settlements query ...

    $reconciliation = $reconciliationService->getOutletReconciliation($outlet->id);

    $deliveryStats = [
        'dombi_count' => (int) ($reconciliation['dombi_delivery_count'] ?? 0),
        'dombi_fee' => (float) ($reconciliation['dombi_delivery_fee'] ?? 0),
        'dombi_net' => (float) ($reconciliation['dombi_net_income'] ?? 0),
        'eksternal_count' => (int) ($reconciliation['eksternal_delivery_count'] ?? 0),
        'eksternal_fee' => (float) ($reconciliation['eksternal_delivery_fee'] ?? 0),
        'eksternal_cost' => (float) ($reconciliation['eksternal_courier_cost'] ?? 0),
        'eksternal_net' => (float) ($reconciliation['eksternal_net_income'] ?? 0),
        'total_fee' => (float) ($reconciliation['total_delivery_fee'] ?? 0),
        'net_income' => (float) ($reconciliation['net_delivery_income'] ?? 0),
    ];
```

- [ ] **Step 2: Pass deliveryStats to Inertia**

In the return `Inertia::render()` call (line 246), add `'deliveryStats' => $deliveryStats` to props:

```php
return Inertia::render('owner/finance/outlet-detail', [
    'outlet' => $outlet->only(['id', 'name']),
    'settlements' => ...,
    'summary' => ...,
    'unpaidBreakdown' => $unpaidBreakdown,
    'deliveryStats' => $deliveryStats, // NEW
]);
```

- [ ] **Step 3: Verify controller compiles**

```bash
php artisan route:list --path=finance | grep outlet-detail
```

Expected: route exists, no syntax error.

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/Owner/FinanceSettlementController.php
git commit -m "feat: pass deliveryStats to finance outlet-detail"
```

---

### Task 3: Frontend Display 2 Rows

**Files:**
- Modify: `resources/js/pages/owner/finance/outlet-detail.tsx:270-340`

**Interfaces:**
- Consumes: props.deliveryStats { dombi_count: number, dombi_fee: number, dombi_net: number, eksternal_count: number, eksternal_fee: number, eksternal_cost: number, eksternal_net: number, total_fee: number, net_income: number }
- Produces: UI shows 2 OwnerDetailRow for Kurir Dombi and Biaya Gojek/Grab

- [ ] **Step 1: Read current summary section**

Open `resources/js/pages/owner/finance/outlet-detail.tsx`. Find the summary card that shows `OwnerDetailRow label="Ongkos Kirim"` around line 288-296.

- [ ] **Step 2: Replace single Ongkir row with 2 rows**

Replace the existing `OwnerDetailRow label="Ongkos Kirim"` with:

```tsx
<OwnerDetailRow
    label="Kurir Dombi"
    value={
        <span className="text-right">
            <span>{deliveryStats?.dombi_count ?? 0} transaksi</span>
            <span className="ml-2">{formatCurrency(deliveryStats?.dombi_fee ?? 0)}</span>
            <span className="ml-2 text-emerald-600 font-semibold">
                Net +{formatCurrency(deliveryStats?.dombi_net ?? 0)}
            </span>
        </span>
    }
/>

<OwnerDetailRow
    label="Biaya Gojek/Grab"
    value={
        deliveryStats?.eksternal_count === 0 ? (
            <span className="text-text-muted">Belum ada transaksi</span>
        ) : (
            <span className="text-right block">
                <span>{deliveryStats.eksternal_count} transaksi</span>
                <span className="ml-2">Fee {formatCurrency(deliveryStats.eksternal_fee)}</span>
                <span className="ml-2">Cost {formatCurrency(deliveryStats.eksternal_cost)}</span>
                <span className={`ml-2 font-semibold ${deliveryStats.eksternal_net < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    Net {deliveryStats.eksternal_net >= 0 ? '+' : ''}{formatCurrency(deliveryStats.eksternal_net)}
                </span>
                {deliveryStats.eksternal_net < 0 && (
                    <span className="ml-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">Rugi</span>
                )}
            </span>
        )
    }
/>
```

Add `deliveryStats` to component props destructuring at top: `export default function OutletAccountStatement({ outlet, settlements, summary, unpaidBreakdown, deliveryStats }: any)`

- [ ] **Step 3: Build frontend**

```bash
npm run build 2>&1 | tail -10
```

Expected: built successfully.

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/finance/outlet-detail.tsx
git commit -m "feat: show Kurir Dombi vs Gojek/Grab breakdown in finance outlet-detail"
```

---

### Task 4: Tests & Verification

**Files:**
- Modify: `tests/Feature/SettlementCourierCostTest.php`
- Test: `tests/Feature/SettlementCourierCostTest.php`

**Interfaces:**
- Consumes: SettlementReconciliationService::getOutletReconciliation
- Produces: assertions for dombi_count, dombi_fee, eksternal_fee, eksternal_cost, nets

- [ ] **Step 1: Extend existing test**

Open `tests/Feature/SettlementCourierCostTest.php`. The existing test creates 1 eksternal delivery with cost 25000 and delivery_fee 10000. Update to create both types:

```php
// Inside test_reconciliation_includes_courier_costs:

// Dombi delivery
Delivery::factory()->create([
    'order_id' => Order::factory()->create([
        'outlet_id' => $outlet->id,
        'status' => Order::STATUS_COMPLETED,
        'delivery_fee' => 15000,
    ])->id,
    'courier_type' => 'dombi',
    'courier_cost' => null,
]);

// Eksternal delivery (existing)
Delivery::factory()->create([
    'order_id' => Order::factory()->create([... 10000 ...]),
    'courier_type' => 'eksternal',
    'courier_cost' => 25000,
]);

// Assert
$result = $service->getOutletReconciliation($outlet->id);
$this->assertEquals(1, $result['dombi_delivery_count']);
$this->assertEquals(15000, $result['dombi_delivery_fee']);
$this->assertEquals(15000, $result['dombi_net_income']);
$this->assertEquals(1, $result['eksternal_delivery_count']);
$this->assertEquals(10000, $result['eksternal_delivery_fee']);
$this->assertEquals(25000, $result['eksternal_courier_cost']);
$this->assertEquals(-15000, $result['eksternal_net_income']);
$this->assertEquals(25000, $result['total_delivery_fee']); // 15000+10000
$this->assertEquals(0, $result['net_delivery_income']); // 25000 - 25000
```

- [ ] **Step 2: Run tests**

```bash
php artisan test --filter=SettlementCourierCostTest -v
```

Expected: PASS

- [ ] **Step 3: Run full suite**

```bash
php artisan test 2>&1 | tail -5
```

Expected: 791 tests PASS (or 792 if new count)

- [ ] **Step 4: Commit**

```bash
git add tests/Feature/SettlementCourierCostTest.php
git commit -m "test: extend courier cost test for dombi vs eksternal breakdown"
```

---

## Post-Implementation Verification

- [ ] Owner finance outlet-detail shows 2 rows: Kurir Dombi (count, fee, net) and Biaya Gojek/Grab (count, fee, cost, net with red if loss)
- [ ] When no eksternal transactions, shows "Belum ada transaksi"
- [ ] Query is single-pass: check logs for only 1 query to deliveries+orders join
- [ ] No try-catch in service — let it crash if column missing (expected)
- [ ] Deployment script includes `php artisan migrate --force` before traffic
