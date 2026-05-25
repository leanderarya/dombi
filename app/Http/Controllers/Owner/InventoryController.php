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
        $inventories = OutletInventory::query()
            ->with(['outlet', 'product'])
            ->when($request->filled('outlet_id'), fn ($query) => $query->where('outlet_id', $request->integer('outlet_id')))
            ->when($request->filled('product_id'), fn ($query) => $query->where('product_id', $request->integer('product_id')))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('owner/inventories/index', [
            'inventories' => $inventories,
            'outlets' => Outlet::orderBy('name')->get(['id', 'name']),
            'products' => Product::orderBy('name')->get(['id', 'name']),
            'filters' => $request->only(['outlet_id', 'product_id']),
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
