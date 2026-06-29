# Outlet Orders Tab Split — Implementation Plan

## Step 1: Update OrderController

**File:** `app/Http/Controllers/Outlet/OrderController.php`

Modify `index()` method:

```php
public function index(Request $request): Response
{
    $outlet = $request->user()->outlet;
    abort_unless($outlet, 403);

    $tab = $request->string('tab', 'aktif')->toString();

    $operationalStatuses = [
        'pending_confirmation', 'confirmed', 'preparing',
        'ready_for_pickup', 'picked_up', 'delivering',
    ];
    $historyStatuses = [
        'completed', 'cancelled_by_customer', 'cancelled_by_outlet',
        'rejected_by_outlet', 'failed_delivery', 'expired',
    ];

    $statuses = $tab === 'riwayat' ? $historyStatuses : $operationalStatuses;

    $orders = Order::query()
        ->where('outlet_id', $outlet->id)
        ->whereIn('status', $statuses)
        ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
        ->when($tab === 'aktif', fn ($q) => $q->oldest(), fn ($q) => $q->latest())
        ->with('items')
        ->paginate(20)
        ->withQueryString();

    $pendingCount = Cache::remember(
        "outlet:{$outlet->id}:pending_orders",
        5,
        fn () => Order::where('outlet_id', $outlet->id)
            ->where('status', 'pending_confirmation')
            ->count()
    );

    return Inertia::render('outlet/orders/index', [
        'outlet' => $outlet,
        'orders' => $orders,
        'filters' => $request->only(['status', 'tab']),
        'tab' => $tab,
        'pendingCount' => $pendingCount,
    ]);
}
```

## Step 2: Update orders page

**File:** `resources/js/pages/outlet/orders/index.tsx`

Replace entire component with tab-aware version:

1. **Segmented control** at top: `[Aktif (count)]` `[Riwayat]`
   - Click → `router.get('/outlet/orders', { tab })`
   - Active tab: `bg-white shadow-sm font-bold`
   - Inactive tab: `text-text-muted`

2. **Filter chips** change based on `tab` prop:
   - Aktif: Menunggu, Diterima, Disiapkan, Siap Ambil, Dikirim
   - Riwayat: Selesai, Dibatalkan, Ditolak, Gagal, Kadaluarsa

3. **Urgency banner** only when `tab === 'aktif'` and `pendingCount > 0`

4. **Filter change** preserves tab: `router.get('/outlet/orders', { tab, status })`

5. **Status maps** split into `operationalStatus*` and `historyStatus*` objects

## Verification

1. `/outlet/orders` → shows Aktif tab with operational orders, oldest first
2. Click Riwayat tab → URL changes to `?tab=riwayat`, shows completed/cancelled orders, newest first
3. Filter chips change when switching tabs
4. Clicking filter chip preserves tab in URL
5. Urgency banner only on Aktif tab
6. Badge on Aktif tab label shows pending count
7. Bottom nav badge still works independently

## Files Summary

| # | File | Change |
|---|------|--------|
| 1 | `app/Http/Controllers/Outlet/OrderController.php` | Modify `index()` — add tab logic |
| 2 | `resources/js/pages/outlet/orders/index.tsx` | Modify — segmented control, tab-aware filters |
