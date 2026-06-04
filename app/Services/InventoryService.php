<?php

namespace App\Services;

use App\Exceptions\InsufficientStockException;
use App\Models\Order;
use App\Models\OutletInventory;
use App\Models\StockMovement;
use App\Support\OperationalLog;
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
            $availableStock = $inventory->current_stock - $inventory->reserved_stock;

            if ($availableStock < $quantity) {
                throw ValidationException::withMessages([
                    'items' => 'Stok produk tidak tersedia di outlet terdekat maupun outlet lain.',
                ]);
            }

            $beforeReserved = $inventory->reserved_stock;
            $inventory->reserved_stock += $quantity;
            $inventory->save();

            StockMovement::create([
                'outlet_id' => $outletId,
                'product_id' => $item['product_id'],
                'type' => 'order_reserved',
                'quantity' => $quantity,
                'before_stock' => $inventory->current_stock,
                'after_stock' => $inventory->current_stock,
                'before_reserved' => $beforeReserved,
                'after_reserved' => $inventory->reserved_stock,
                'reference_type' => Order::class,
                'reference_id' => $order->id,
                'notes' => 'Reserved untuk '.$order->order_code,
                'created_by' => Auth::id(),
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

            if ($inventory->reserved_stock < $item->quantity) {
                throw new InsufficientStockException(
                    outletId: $order->outlet_id,
                    productId: $item->product_id,
                    stockType: 'reserved_stock',
                    required: $item->quantity,
                    available: $inventory->reserved_stock,
                );
            }

            $beforeReserved = $inventory->reserved_stock;
            $inventory->reserved_stock -= $item->quantity;
            $inventory->save();

            StockMovement::create([
                'outlet_id' => $order->outlet_id,
                'product_id' => $item->product_id,
                'type' => 'order_cancelled',
                'quantity' => $item->quantity,
                'before_stock' => $inventory->current_stock,
                'after_stock' => $inventory->current_stock,
                'before_reserved' => $beforeReserved,
                'after_reserved' => $inventory->reserved_stock,
                'reference_type' => Order::class,
                'reference_id' => $order->id,
                'notes' => 'Release reserved '.$order->order_code,
                'created_by' => Auth::id(),
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

            if ($inventory->current_stock < $item->quantity) {
                OperationalLog::inventoryException($order->outlet_id, $item->product_id, 'current_stock', $item->quantity, $inventory->current_stock);
                throw new InsufficientStockException(
                    outletId: $order->outlet_id,
                    productId: $item->product_id,
                    stockType: 'current_stock',
                    required: $item->quantity,
                    available: $inventory->current_stock,
                );
            }

            if ($inventory->reserved_stock < $item->quantity) {
                OperationalLog::inventoryException($order->outlet_id, $item->product_id, 'reserved_stock', $item->quantity, $inventory->reserved_stock);
                throw new InsufficientStockException(
                    outletId: $order->outlet_id,
                    productId: $item->product_id,
                    stockType: 'reserved_stock',
                    required: $item->quantity,
                    available: $inventory->reserved_stock,
                );
            }

            $beforeStock = $inventory->current_stock;
            $beforeReserved = $inventory->reserved_stock;
            $inventory->current_stock -= $item->quantity;
            $inventory->reserved_stock -= $item->quantity;
            $inventory->save();

            StockMovement::create([
                'outlet_id' => $order->outlet_id,
                'product_id' => $item->product_id,
                'type' => 'order_completed',
                'quantity' => -$item->quantity,
                'before_stock' => $beforeStock,
                'after_stock' => $inventory->current_stock,
                'before_reserved' => $beforeReserved,
                'after_reserved' => $inventory->reserved_stock,
                'reference_type' => Order::class,
                'reference_id' => $order->id,
                'notes' => 'Selesai order '.$order->order_code,
                'created_by' => Auth::id(),
            ]);
        }
    }

    public function adjustStock(int $outletId, int $productId, int $newStock, ?string $notes = null): void
    {
        $inventory = OutletInventory::query()
            ->where('outlet_id', $outletId)
            ->where('product_id', $productId)
            ->lockForUpdate()
            ->first();

        if (! $inventory) {
            $inventory = OutletInventory::create([
                'outlet_id' => $outletId,
                'product_id' => $productId,
                'current_stock' => 0,
                'reserved_stock' => 0,
                'minimum_stock' => 0,
            ]);
        }

        if ($newStock < $inventory->reserved_stock) {
            throw new InsufficientStockException(
                outletId: $outletId,
                productId: $productId,
                stockType: 'current_stock (cannot go below reserved)',
                required: $inventory->reserved_stock,
                available: $newStock,
            );
        }

        $beforeStock = $inventory->current_stock;
        $inventory->current_stock = $newStock;
        $inventory->save();

        OperationalLog::stockAdjustment($outletId, $productId, $beforeStock, $newStock, $notes);

        StockMovement::create([
            'outlet_id' => $outletId,
            'product_id' => $productId,
            'type' => 'stock_adjustment',
            'quantity' => $newStock - $beforeStock,
            'before_stock' => $beforeStock,
            'after_stock' => $newStock,
            'before_reserved' => $inventory->reserved_stock,
            'after_reserved' => $inventory->reserved_stock,
            'notes' => $notes,
            'created_by' => Auth::id(),
        ]);
    }
}
