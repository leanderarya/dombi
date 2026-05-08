<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OutletInventory;
use App\Models\StockMovement;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class InventoryService
{
    public function hasEnoughStock(int $outletId, array $items): bool
    {
        foreach ($items as $item) {
            $inventory = OutletInventory::query()
                ->where('outlet_id', $outletId)
                ->where('product_id', $item['product_id'])
                ->first();

            if (! $inventory || ($inventory->current_stock - $inventory->reserved_stock) < (int) $item['quantity']) {
                return false;
            }
        }

        return true;
    }

    public function reserveStock(int $outletId, array $items, Order $order): void
    {
        foreach ($items as $item) {
            $inventory = OutletInventory::query()
                ->where('outlet_id', $outletId)
                ->where('product_id', $item['product_id'])
                ->lockForUpdate()
                ->firstOrFail();

            $quantity = (int) $item['quantity'];
            $beforeAvailable = $inventory->current_stock - $inventory->reserved_stock;

            if ($beforeAvailable < $quantity) {
                throw ValidationException::withMessages([
                    'items' => 'Stok produk tidak tersedia di outlet terdekat maupun outlet lain.',
                ]);
            }

            $inventory->increment('reserved_stock', $quantity);

            StockMovement::create([
                'outlet_id' => $outletId,
                'product_id' => $item['product_id'],
                'type' => 'order_reserved',
                'quantity' => $quantity,
                'before_stock' => $inventory->current_stock,
                'after_stock' => $inventory->fresh()->current_stock,
                'reference_type' => Order::class,
                'reference_id' => $order->id,
                'notes' => 'Reserved untuk '.$order->order_code,
                'created_by' => $order->customer_id,
            ]);
        }
    }

    public function releaseReservedStock(Order $order): void
    {
        foreach ($order->items as $item) {
            $inventory = OutletInventory::query()
                ->where('outlet_id', $order->outlet_id)
                ->where('product_id', $item->product_id)
                ->lockForUpdate()
                ->first();

            if (! $inventory) {
                continue;
            }

            $inventory->reserved_stock = max(0, $inventory->reserved_stock - $item->quantity);
            $inventory->save();

            StockMovement::create([
                'outlet_id' => $order->outlet_id,
                'product_id' => $item->product_id,
                'type' => 'order_cancelled',
                'quantity' => $item->quantity,
                'before_stock' => $inventory->current_stock,
                'after_stock' => $inventory->current_stock,
                'reference_type' => Order::class,
                'reference_id' => $order->id,
                'notes' => 'Release reserved '.$order->order_code,
            ]);
        }
    }

    public function completeOrderStock(Order $order): void
    {
        foreach ($order->items as $item) {
            $inventory = OutletInventory::query()
                ->where('outlet_id', $order->outlet_id)
                ->where('product_id', $item->product_id)
                ->lockForUpdate()
                ->firstOrFail();

            $beforeStock = $inventory->current_stock;
            $inventory->current_stock = max(0, $inventory->current_stock - $item->quantity);
            $inventory->reserved_stock = max(0, $inventory->reserved_stock - $item->quantity);
            $inventory->save();

            StockMovement::create([
                'outlet_id' => $order->outlet_id,
                'product_id' => $item->product_id,
                'type' => 'order_completed',
                'quantity' => -$item->quantity,
                'before_stock' => $beforeStock,
                'after_stock' => $inventory->current_stock,
                'reference_type' => Order::class,
                'reference_id' => $order->id,
                'notes' => 'Selesai order '.$order->order_code,
            ]);
        }
    }

    public function adjustStock(int $outletId, int $productId, int $newStock, ?string $notes = null): void
    {
        $inventory = OutletInventory::firstOrCreate(
            ['outlet_id' => $outletId, 'product_id' => $productId],
            ['current_stock' => 0, 'reserved_stock' => 0, 'minimum_stock' => 0]
        );

        $beforeStock = $inventory->current_stock;
        $inventory->current_stock = $newStock;
        $inventory->save();

        StockMovement::create([
            'outlet_id' => $outletId,
            'product_id' => $productId,
            'type' => 'stock_adjustment',
            'quantity' => $newStock - $beforeStock,
            'before_stock' => $beforeStock,
            'after_stock' => $newStock,
            'notes' => $notes,
            'created_by' => Auth::id(),
        ]);
    }
}
