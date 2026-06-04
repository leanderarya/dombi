<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\StoreOutletRequest;
use App\Http\Requests\Owner\UpdateOutletRequest;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\RestockRequest;
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
        return Inertia::render('owner/outlets/create');
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
        ]);
    }

    public function edit(Outlet $outlet): Response
    {
        return Inertia::render('owner/outlets/edit', ['outlet' => $outlet]);
    }

    public function update(UpdateOutletRequest $request, Outlet $outlet): RedirectResponse
    {
        $outlet->update($request->validated());

        return redirect()->route('owner.outlets.index')->with('success', 'Outlet berhasil diperbarui.');
    }

    public function destroy(Outlet $outlet): RedirectResponse
    {
        $outlet->delete();

        return redirect()->route('owner.outlets.index')->with('success', 'Outlet berhasil dihapus.');
    }
}
