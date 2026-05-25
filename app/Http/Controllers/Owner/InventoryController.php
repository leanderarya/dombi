<?php

namespace App\Http\Controllers\Owner;

use App\Exceptions\InsufficientStockException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\StoreInventoryRequest;
use App\Http\Requests\Owner\UpdateInventoryRequest;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Services\InventoryService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class InventoryController extends Controller
{
    public function index(Request $request): Response
    {
        $outlets = Outlet::where('status', 'active')
            ->with(['inventories' => fn ($q) => $q->with('product')->orderBy('product_id')])
            ->orderBy('name')
            ->get();

        $outletSections = $outlets->map(function ($outlet) {
            $inventories = $outlet->inventories;
            $totalSku = $inventories->count();
            $lowStock = $inventories->filter(fn ($i) => ($i->current_stock - $i->reserved_stock) <= $i->minimum_stock)->count();
            $critical = $inventories->filter(fn ($i) => ($i->current_stock - $i->reserved_stock) <= 0)->count();
            $totalReserved = $inventories->sum('reserved_stock');
            $health = $critical > 0 ? 'critical' : ($lowStock > 0 ? 'low_stock' : 'healthy');

            return [
                'outlet' => ['id' => $outlet->id, 'name' => $outlet->name],
                'health' => $health,
                'totalSku' => $totalSku,
                'lowStock' => $lowStock,
                'critical' => $critical,
                'totalReserved' => $totalReserved,
                'inventories' => $inventories,
            ];
        });

        return Inertia::render('owner/inventories/index', [
            'outletSections' => $outletSections,
            'stats' => [
                'totalSku' => OutletInventory::count(),
                'lowStock' => OutletInventory::whereRaw('(current_stock - reserved_stock) <= minimum_stock')->count(),
                'totalReserved' => (int) OutletInventory::sum('reserved_stock'),
                'critical' => OutletInventory::whereRaw('(current_stock - reserved_stock) <= 0')->count(),
            ],
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('owner/inventories/create', [
            'outlets' => Outlet::orderBy('name')->get(['id', 'name']),
            'products' => Product::orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(StoreInventoryRequest $request, InventoryService $inventoryService): RedirectResponse
    {
        $data = $request->validated();

        try {
            DB::transaction(function () use ($data, $inventoryService): void {
                $inventory = OutletInventory::updateOrCreate(
                    ['outlet_id' => $data['outlet_id'], 'product_id' => $data['product_id']],
                    ['minimum_stock' => $data['minimum_stock']]
                );

                $inventoryService->adjustStock($inventory->outlet_id, $inventory->product_id, (int) $data['current_stock'], $data['notes'] ?? null);
                $inventory->update(['minimum_stock' => $data['minimum_stock']]);
            });
        } catch (InsufficientStockException $e) {
            return redirect()->back()->withErrors(['current_stock' => 'Stok tidak boleh lebih rendah dari reserved stock.'])->withInput();
        }

        return redirect()->route('owner.inventories.index')->with('success', 'Inventory berhasil disimpan.');
    }

    public function edit(OutletInventory $inventory): Response
    {
        return Inertia::render('owner/inventories/edit', [
            'inventory' => $inventory->load(['outlet', 'product']),
        ]);
    }

    public function update(UpdateInventoryRequest $request, OutletInventory $inventory, InventoryService $inventoryService): RedirectResponse
    {
        $data = $request->validated();

        try {
            DB::transaction(function () use ($data, $inventory, $inventoryService): void {
                $inventoryService->adjustStock($inventory->outlet_id, $inventory->product_id, (int) $data['current_stock'], $data['notes'] ?? null);
                $inventory->update(['minimum_stock' => $data['minimum_stock']]);
            });
        } catch (InsufficientStockException $e) {
            return redirect()->back()->withErrors(['current_stock' => 'Stok tidak boleh lebih rendah dari reserved stock.'])->withInput();
        }

        return redirect()->route('owner.inventories.index')->with('success', 'Inventory berhasil diperbarui.');
    }
}
