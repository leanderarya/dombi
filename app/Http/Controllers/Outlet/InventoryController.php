<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\OutletInventory;
use Inertia\Inertia;
use Inertia\Response;

class InventoryController extends Controller
{
    public function __invoke(): Response
    {
        $outlet = auth()->user()->outlet;
        abort_unless($outlet, 403);

        return Inertia::render('outlet/inventory', [
            'outlet' => $outlet,
            'inventories' => OutletInventory::with('product')
                ->where('outlet_id', $outlet->id)
                ->orderByDesc('updated_at')
                ->get(),
        ]);
    }
}
