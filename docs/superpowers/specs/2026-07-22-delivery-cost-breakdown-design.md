# Delivery Cost Breakdown — Finance Outlet Detail

**Date:** 2026-07-22
**Status:** Approved

## Goal
Show Kurir Dombi vs Biaya Gojek/Grab breakdown in owner finance outlet-detail page. Owner needs to see per-outlet delivery profitability (fee from KM setting vs actual Gojek cost).

## Context
- Delivery fee for customer = variable per KM (from delivery_pricing_management), same price for Dombi & Eksternal
- Cost = actual courier_cost paid to Gojek/Grab (only for eksternal)
- Current backend `getOutletReconciliation()` only returns total_delivery_fee (combined) + eksternal_courier_cost, no split per type
- Frontend `finance/outlet-detail.tsx` only shows single row "Ongkos Kirim: total_delivery_fee"

## Design

### 1. Backend — SettlementReconciliationService (Single-Pass Aggregation)

**File:** `app/Services/SettlementReconciliationService.php`

Replace 5 separate queries with single-pass conditional aggregation. No try-catch — if column missing, let QueryException crash. Fix deployment to run `php artisan migrate --force`.

```php
use Illuminate\Support\Facades\DB;
use App\Models\Order;

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

// Memory computation
$dombiCount = (int) ($stats->dombi_count ?? 0);
$dombiFee = (float) ($stats->dombi_fee ?? 0);
$eksternalCount = (int) ($stats->eksternal_count ?? 0);
$eksternalFee = (float) ($stats->eksternal_fee ?? 0);
$eksternalCost = (float) ($stats->eksternal_cost ?? 0);

$dombiNet = $dombiFee; // internal cost 0
$eksternalNet = $eksternalFee - $eksternalCost;
$totalDeliveryFee = $dombiFee + $eksternalFee;
$netDeliveryIncome = $totalDeliveryFee - $eksternalCost;
```

Return array add same as before:
```php
'dombi_delivery_count' => $dombiCount,
'dombi_delivery_fee' => $dombiFee,
'eksternal_delivery_fee' => $eksternalFee,
'eksternal_courier_cost' => $eksternalCost,
'eksternal_delivery_count' => $eksternalCount,
'dombi_net_income' => $dombiNet,
'eksternal_net_income' => $eksternalNet,
'total_delivery_fee' => $totalDeliveryFee,
'net_delivery_income' => $netDeliveryIncome,
```

Rationale: single DB round-trip, constant memory, saves CPU on shared hosting (no N+1). total_delivery_fee previously from Order sum now derived from delivery join — same source of truth (only completed orders with deliveries).

Schema responsibility: remove try-catch. Deployment must run `php artisan migrate --force` before traffic.

### 2. Controller — FinanceSettlementController

**File:** `app/Http/Controllers/Owner/FinanceSettlementController.php`

`outletDetail()` method already calls `getOutletReconciliation()` or builds summary. Ensure delivery breakdown is passed to frontend props.

In `outletDetail()`, the `summary` currently has total_delivery_fee. Add new fields to summary or pass separate `deliveryStats` prop:

```php
$reconciliation = $this->reconciliationService->getOutletReconciliation($outletId);

$deliveryStats = [
    'dombi_count' => $reconciliation['dombi_delivery_count'],
    'dombi_fee' => $reconciliation['dombi_delivery_fee'],
    'dombi_net' => $reconciliation['dombi_net_income'],
    'eksternal_count' => $reconciliation['eksternal_delivery_count'],
    'eksternal_fee' => $reconciliation['eksternal_delivery_fee'],
    'eksternal_cost' => $reconciliation['eksternal_courier_cost'],
    'eksternal_net' => $reconciliation['eksternal_net_income'],
    'total_fee' => $reconciliation['total_delivery_fee'],
    'net_income' => $reconciliation['net_delivery_income'],
];

return Inertia::render('owner/finance/outlet-detail', [
    // ... existing
    'deliveryStats' => $deliveryStats,
]);
```

### 3. Frontend — outlet-detail.tsx

**File:** `resources/js/pages/owner/finance/outlet-detail.tsx`

Current shows:
```tsx
<OwnerDetailRow label="Ongkos Kirim" value={formatCurrency(summary.total_delivery_fee)} />
```

Replace with 2 rows for courier types:

```tsx
// Kurir Dombi
<OwnerDetailRow
    label="Kurir Dombi"
    value={
        <span>
            {deliveryStats.dombi_count} transaksi · {formatCurrency(deliveryStats.dombi_fee)}
            <span className="ml-2 text-emerald-600">Net +{formatCurrency(deliveryStats.dombi_net)}</span>
        </span>
    }
/>

// Biaya Gojek/Grab
<OwnerDetailRow
    label="Biaya Gojek/Grab"
    value={
        <div className="text-right">
            <div>{deliveryStats.eksternal_count} transaksi</div>
            <div>Fee {formatCurrency(deliveryStats.eksternal_fee)} · Cost {formatCurrency(deliveryStats.eksternal_cost)}</div>
            <div className={deliveryStats.eksternal_net < 0 ? 'text-red-600 font-semibold' : 'text-emerald-600'}>
                Net {deliveryStats.eksternal_net >= 0 ? '+' : ''}{formatCurrency(deliveryStats.eksternal_net)}
                {deliveryStats.eksternal_net < 0 && <span className="ml-1 rounded-full bg-red-50 px-1.5 text-[10px]">Rugi</span>}
            </div>
        </div>
    }
/>
```

If no eksternal transactions (count 0), show "-" or "Belum ada transaksi Gojek/Grab".

Keep total_delivery_fee row or replace with net_delivery_income total.

### 4. Testing

- Existing `SettlementCourierCostTest` already checks eksternal_courier_cost. Extend to check dombi count/fee split.
- New test: create 2 deliveries (dombi + eksternal) with different fees, assert breakdown.

### 5. File Changes

| File | Action |
|------|--------|
| `app/Services/SettlementReconciliationService.php` | Add dombi count/fee, eksternal fee split, net per type, defensive try-catch |
| `app/Http/Controllers/Owner/FinanceSettlementController.php` | Pass deliveryStats to frontend |
| `resources/js/pages/owner/finance/outlet-detail.tsx` | Render 2 rows: Kurir Dombi + Biaya Gojek/Grab with net color |

## Not Covered
- Dashboard KPI for delivery (could be next iteration)
- Per-KM tier breakdown (too detailed for now, totals enough)
- Dombi internal cost (assumed 0, no courier_cost for dombi)
- Export CSV for delivery costs (future)
