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

### 1. Backend — SettlementReconciliationService

**File:** `app/Services/SettlementReconciliationService.php`

Extend `getOutletReconciliation(int $outletId)` to split delivery fee per courier_type:

```php
// Existing:
$totalDeliveryFee = sum delivery_fee where status completed
$eksternalCost = sum courier_cost where courier_type = eksternal
$eksternalCount = count where courier_type = eksternal

// New:
$dombiCount = count where courier_type = dombi
$dombiFee = sum delivery_fee where courier_type = dombi
$eksternalFee = sum delivery_fee where courier_type = eksternal

// Net:
$dombiNet = $dombiFee (cost 0 for internal)
$eksternalNet = $eksternalFee - $eksternalCost
$netDeliveryIncome = $totalDeliveryFee - $eksternalCost (existing, keep)
```

Return array add:
```php
'dombi_delivery_count' => int,
'dombi_delivery_fee' => float,
'eksternal_delivery_fee' => float,
'eksternal_courier_cost' => float (existing),
'eksternal_delivery_count' => int (existing),
'dombi_net_income' => float,
'eksternal_net_income' => float,
'total_delivery_fee' => float (existing),
'net_delivery_income' => float (existing),
```

Defensive: wrap new queries in try-catch same as existing courier aggregation (column may not exist on staging if migration pending). Fallback 0.

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
