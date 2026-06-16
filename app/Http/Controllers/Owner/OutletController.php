<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\StoreOutletRequest;
use App\Http\Requests\Owner\UpdateOutletRequest;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\RestockRequest;
use App\Models\Settlement;
use App\Services\OutletAuditService;
use App\Services\OutletProvisioningService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class OutletController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('owner/outlets/index', [
            'outlets' => Outlet::query()
                ->withCount([
                    'orders as active_orders_count' => fn ($query) => $query->whereIn('status', Order::ACTIVE_STATUSES),
                    'inventories as inventory_items_count',
                    'inventories as low_stock_count' => fn ($query) => $query->whereRaw('(current_stock - reserved_stock) <= minimum_stock'),
                    'restockRequests as pending_restocks_count' => fn ($query) => $query->whereIn('status', ['requested', 'preparing', 'shipped']),
                ])
                ->latest()
                ->paginate(15),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('owner/outlets/create', [
            'existingOutlets' => Outlet::where('status', 'active')
                ->whereNotNull('latitude')
                ->whereNotNull('longitude')
                ->get(['id', 'name', 'latitude', 'longitude', 'address']),
        ]);
    }

    public function store(StoreOutletRequest $request, OutletProvisioningService $provisioning): RedirectResponse
    {
        $result = $provisioning->createOutletWithAccount($request->validated());

        return redirect()
            ->route('owner.outlets.index')
            ->with('success', 'Outlet berhasil dibuat dan akun operasional sudah diprovisioning.')
            ->with('outlet_provisioning', $result['credentials']);
    }

    public function show(Outlet $outlet): Response
    {
        $outlet->loadCount([
            'orders as active_orders_count' => fn ($query) => $query->whereIn('status', Order::ACTIVE_STATUSES),
            'orders as today_orders_count' => fn ($query) => $query->whereDate('created_at', today()),
            'inventories as inventory_items_count',
            'inventories as low_stock_count' => fn ($query) => $query->whereRaw('(current_stock - reserved_stock) <= minimum_stock'),
            'restockRequests as pending_restocks_count' => fn ($query) => $query->whereIn('status', ['requested', 'preparing', 'shipped']),
        ]);

        return Inertia::render('owner/outlets/show', [
            'outlet' => $outlet,
            'inventoryHealth' => $outlet->inventories()
                ->whereNotNull('product_id')
                ->with('product:id,name,unit')
                ->latest()
                ->limit(6)
                ->get(['id', 'outlet_id', 'product_id', 'current_stock', 'reserved_stock', 'minimum_stock', 'updated_at']),
            'activeDeliveriesCount' => Delivery::whereHas('order', fn ($query) => $query
                ->where('outlet_id', $outlet->id)
                ->whereIn('status', ['ready_for_pickup', 'picked_up', 'delivering']))
                ->count(),
            'recentRestocks' => RestockRequest::with('distribution')
                ->where('outlet_id', $outlet->id)
                ->latest()
                ->limit(5)
                ->get(['id', 'outlet_id', 'status', 'notes', 'created_at']),
            'holidays' => $outlet->holidays()->orderBy('start_date', 'desc')->get(),
            'operatingHours' => $outlet->operatingHours()->orderBy('day_of_week')->get(),
            'auditLogs' => $outlet->auditLogs()
                ->with('changedBy:id,name')
                ->latest()
                ->limit(20)
                ->get(),
            'settlementSummary' => [
                'outstanding' => (float) Settlement::where('outlet_id', $outlet->id)
                    ->where('status', '!=', Settlement::STATUS_PAID)
                    ->sum('amount_due - paid_amount'),
                'overdue_count' => (int) Settlement::where('outlet_id', $outlet->id)
                    ->where('status', Settlement::STATUS_OVERDUE)
                    ->count(),
                'paid_this_month' => (float) Settlement::where('outlet_id', $outlet->id)
                    ->where('status', Settlement::STATUS_PAID)
                    ->whereMonth('paid_at', now()->month)
                    ->whereYear('paid_at', now()->year)
                    ->sum('paid_amount'),
                'recent_settlements' => Settlement::where('outlet_id', $outlet->id)
                    ->latest('period_date')
                    ->limit(5)
                    ->get(['id', 'period_date', 'amount_due', 'paid_amount', 'status', 'due_date']),
            ],
        ]);
    }

    public function edit(Outlet $outlet): Response
    {
        return Inertia::render('owner/outlets/edit', [
            'outlet' => $outlet,
            'existingOutlets' => Outlet::where('status', 'active')
                ->where('id', '!=', $outlet->id)
                ->whereNotNull('latitude')
                ->whereNotNull('longitude')
                ->get(['id', 'name', 'latitude', 'longitude', 'address']),
        ]);
    }

    public function update(UpdateOutletRequest $request, Outlet $outlet, OutletAuditService $auditService): RedirectResponse
    {
        $oldData = $outlet->toArray();
        $outlet->update($request->validated());
        $auditService->logChanges($outlet, $oldData, $request->validated(), $request->user());

        return redirect()->route('owner.outlets.index')->with('success', 'Outlet berhasil diperbarui.');
    }

    public function destroy(Outlet $outlet): RedirectResponse
    {
        // Soft delete (archive) instead of hard delete
        $outlet->update(['status' => 'archived']);

        return redirect()->route('owner.outlets.index')->with('success', 'Outlet berhasil diarsipkan.');
    }

    public function archive(Outlet $outlet, OutletAuditService $auditService): RedirectResponse
    {
        $oldStatus = $outlet->status;
        $outlet->update(['status' => 'archived']);
        $auditService->log($outlet, 'status', $oldStatus, 'archived', request()->user());

        return redirect()->route('owner.outlets.index')->with('success', 'Outlet berhasil diarsipkan.');
    }
}
