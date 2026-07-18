<?php

namespace App\Services;

use App\Exceptions\InsufficientStockException;
use App\Models\Notification;
use App\Models\Order;
use App\Models\OutletInventory;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Support\OperationalLog;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class InventoryService
{
    public function __construct(
        private readonly NotificationService $notificationService
    ) {}

    public function reserveStock(int $outletId, array $items, Order $order): void
    {
        foreach ($items as $item) {
            $variantId = (int) ($item['product_variant_id'] ?? 0);
            if (! $variantId) {
                continue;
            }

            $inventory = OutletInventory::query()
                ->where('outlet_id', $outletId)
                ->where('product_variant_id', $variantId)
                ->lockForUpdate()
                ->first();

            $isNewInventory = false;

            if (! $inventory) {
                // Auto-create inventory row for this variant
                $inventory = OutletInventory::create([
                    'outlet_id' => $outletId,
                    'product_id' => $item['product_id'] ?? null,
                    'product_variant_id' => $variantId,
                    'current_stock' => 0,
                    'reserved_stock' => 0,
                    'minimum_stock' => 0,
                ]);
                $isNewInventory = true;
            }

            $quantity = (int) $item['quantity'];
            $availableStock = $inventory->current_stock - $inventory->reserved_stock;

            if ($availableStock < $quantity) {
                // Clean up orphaned zero-stock row if we just created it
                if ($isNewInventory) {
                    $inventory->delete();
                }

                throw ValidationException::withMessages([
                    'items' => 'Stok produk tidak tersedia di outlet terdekat maupun outlet lain.',
                ]);
            }

            $beforeReserved = $inventory->reserved_stock;
            $inventory->reserved_stock += $quantity;
            $inventory->save();

            StockMovement::create([
                'outlet_id' => $outletId,
                'product_id' => $item['product_id'] ?? null,
                'product_variant_id' => $variantId,
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
            $variantId = $item->product_variant_id;
            if (! $variantId) {
                continue;
            }

            $inventory = OutletInventory::query()
                ->where('outlet_id', $order->outlet_id)
                ->where('product_variant_id', $variantId)
                ->lockForUpdate()
                ->first();

            if (! $inventory) {
                continue;
            }

            if ($inventory->reserved_stock < $item->quantity) {
                // Graceful degradation: set to 0 instead of throwing
                $beforeReserved = $inventory->reserved_stock;

                Log::warning('Inventory reserved_stock discrepancy detected', [
                    'outlet_id' => $order->outlet_id,
                    'product_variant_id' => $variantId,
                    'order_id' => $order->id,
                    'order_code' => $order->order_code,
                    'reserved_stock' => $beforeReserved,
                    'item_quantity' => $item->quantity,
                    'drift' => $item->quantity - $beforeReserved,
                ]);

                $inventory->reserved_stock = 0;
                $inventory->save();

                StockMovement::create([
                    'outlet_id' => $order->outlet_id,
                    'product_id' => $item->product_id,
                    'product_variant_id' => $variantId,
                    'type' => 'order_cancelled',
                    'quantity' => $beforeReserved,
                    'before_stock' => $inventory->current_stock,
                    'after_stock' => $inventory->current_stock,
                    'before_reserved' => $beforeReserved,
                    'after_reserved' => 0,
                    'reference_type' => Order::class,
                    'reference_id' => $order->id,
                    'notes' => 'Release reserved (adjusted) '.$order->order_code,
                    'created_by' => Auth::id(),
                ]);

                $this->checkAndNotifyLowStock($order->outlet_id, $inventory, $variantId);

                continue;
            }

            $beforeReserved = $inventory->reserved_stock;
            $inventory->reserved_stock -= $item->quantity;
            $inventory->save();

            StockMovement::create([
                'outlet_id' => $order->outlet_id,
                'product_id' => $item->product_id,
                'product_variant_id' => $variantId,
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

            $this->checkAndNotifyLowStock($order->outlet_id, $inventory, $variantId);
        }
    }

    public function completeOrderStock(Order $order): void
    {
        foreach ($order->items as $item) {
            $variantId = $item->product_variant_id;
            if (! $variantId) {
                continue;
            }

            $inventory = OutletInventory::query()
                ->where('outlet_id', $order->outlet_id)
                ->where('product_variant_id', $variantId)
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
                'product_variant_id' => $variantId,
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

            $this->checkAndNotifyLowStock($order->outlet_id, $inventory, $variantId);
        }
    }

    public function adjustStock(int $outletId, int $productVariantId, int $newStock, ?string $notes = null): void
    {
        $inventory = OutletInventory::query()
            ->where('outlet_id', $outletId)
            ->where('product_variant_id', $productVariantId)
            ->lockForUpdate()
            ->first();

        if (! $inventory) {
            $variant = ProductVariant::find($productVariantId);
            $inventory = OutletInventory::create([
                'outlet_id' => $outletId,
                'product_id' => $variant?->product_id,
                'product_variant_id' => $productVariantId,
                'current_stock' => 0,
                'reserved_stock' => 0,
                'minimum_stock' => 0,
            ]);
        }

        if ($newStock < $inventory->reserved_stock) {
            throw new InsufficientStockException(
                outletId: $outletId,
                productId: $productVariantId,
                stockType: 'current_stock (cannot go below reserved)',
                required: $inventory->reserved_stock,
                available: $newStock,
            );
        }

        $beforeStock = $inventory->current_stock;
        $inventory->current_stock = $newStock;
        $inventory->save();

        OperationalLog::stockAdjustment($outletId, $productVariantId, $beforeStock, $newStock, $notes);

        StockMovement::create([
            'outlet_id' => $outletId,
            'product_variant_id' => $productVariantId,
            'type' => 'stock_adjustment',
            'quantity' => $newStock - $beforeStock,
            'before_stock' => $beforeStock,
            'after_stock' => $newStock,
            'before_reserved' => $inventory->reserved_stock,
            'after_reserved' => $inventory->reserved_stock,
            'reference_type' => OutletInventory::class,
            'reference_id' => $inventory->id,
            'notes' => $notes,
            'created_by' => Auth::id(),
        ]);
    }

    /**
     * Transfer stock from center to outlet (quick restock).
     * Deducts center_stock, increments outlet current_stock, creates audit trail.
     */
    public function restockOutlet(int $outletId, int $variantId, int $quantity, ?string $notes = null): void
    {
        DB::transaction(function () use ($outletId, $variantId, $quantity, $notes) {
            $variant = ProductVariant::where('id', $variantId)
                ->lockForUpdate()
                ->firstOrFail();

            if ($variant->center_stock < $quantity) {
                throw new InsufficientStockException(
                    outletId: $outletId,
                    productId: $variantId,
                    stockType: 'center_stock',
                    required: $quantity,
                    available: $variant->center_stock,
                    message: "Stok pusat tidak cukup. Tersedia: {$variant->center_stock}, diminta: {$quantity}",
                );
            }

            $inventory = OutletInventory::where('outlet_id', $outletId)
                ->where('product_variant_id', $variantId)
                ->lockForUpdate()
                ->first();

            if (! $inventory) {
                throw new \InvalidArgumentException('Produk belum ditambahkan ke outlet.');
            }

            $centerBefore = $variant->center_stock;
            $variant->decrement('center_stock', $quantity);

            $outletBefore = $inventory->current_stock;
            $inventory->increment('current_stock', $quantity);

            $userId = Auth::id();

            StockMovement::create([
                'outlet_id' => null,
                'product_variant_id' => $variantId,
                'type' => 'distribution_out',
                'quantity' => -$quantity,
                'before_stock' => $centerBefore,
                'after_stock' => $variant->fresh()->center_stock,
                'before_reserved' => 0,
                'after_reserved' => 0,
                'reference_type' => OutletInventory::class,
                'reference_id' => $inventory->id,
                'notes' => $notes ?? 'Quick restock to outlet #'.$outletId,
                'created_by' => $userId,
            ]);

            StockMovement::create([
                'outlet_id' => $outletId,
                'product_variant_id' => $variantId,
                'type' => 'restock_in',
                'quantity' => $quantity,
                'before_stock' => $outletBefore,
                'after_stock' => $inventory->fresh()->current_stock,
                'before_reserved' => $inventory->reserved_stock,
                'after_reserved' => $inventory->reserved_stock,
                'reference_type' => OutletInventory::class,
                'reference_id' => $inventory->id,
                'notes' => $notes ?? 'Quick restock from center',
                'created_by' => $userId,
            ]);

            $this->checkAndNotifyLowStock($outletId, $inventory, $variantId);
        });
    }

    /**
     * Update center stock with locking and audit trail.
     */
    public function updateCenterStock(int $variantId, int $newStock, ?string $notes = null): void
    {
        DB::transaction(function () use ($variantId, $newStock, $notes) {
            $variant = ProductVariant::where('id', $variantId)
                ->lockForUpdate()
                ->firstOrFail();

            $before = $variant->center_stock;
            $variant->update(['center_stock' => $newStock]);

            StockMovement::create([
                'outlet_id' => null,
                'product_variant_id' => $variantId,
                'type' => 'stock_adjustment',
                'quantity' => $newStock - $before,
                'before_stock' => $before,
                'after_stock' => $newStock,
                'before_reserved' => 0,
                'after_reserved' => 0,
                'reference_type' => ProductVariant::class,
                'reference_id' => $variantId,
                'notes' => $notes ?? 'Manual adjustment by owner',
                'created_by' => Auth::id(),
            ]);
        });
    }

    /**
     * Stock opname: set outlet stock to exact count with locking and audit trail.
     */
    public function stockOpname(int $outletId, int $variantId, int $actualCount, ?string $notes = null): void
    {
        DB::transaction(function () use ($outletId, $variantId, $actualCount, $notes) {
            $inventory = OutletInventory::where('outlet_id', $outletId)
                ->where('product_variant_id', $variantId)
                ->lockForUpdate()
                ->firstOrFail();

            if ($actualCount < $inventory->reserved_stock) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'actual_count' => "Stok aktual ({$actualCount}) tidak boleh kurang dari stok dipesan ({$inventory->reserved_stock}).",
                ]);
            }

            $before = $inventory->current_stock;
            $inventory->update(['current_stock' => $actualCount]);

            StockMovement::create([
                'outlet_id' => $outletId,
                'product_variant_id' => $variantId,
                'type' => 'stock_opname',
                'quantity' => $actualCount - $before,
                'before_stock' => $before,
                'after_stock' => $actualCount,
                'before_reserved' => $inventory->reserved_stock,
                'after_reserved' => $inventory->reserved_stock,
                'reference_type' => OutletInventory::class,
                'reference_id' => $inventory->id,
                'notes' => $notes ?? "Stock opname: {$before} → {$actualCount}",
                'created_by' => Auth::id(),
            ]);

            // Notify low stock after opname if applicable
            $inventory->refresh();
            $this->checkAndNotifyLowStock($outletId, $inventory, $variantId);
        });
    }

    private function checkAndNotifyLowStock(int $outletId, OutletInventory $inventory, int $variantId): void
    {
        if ($inventory->minimum_stock <= 0) {
            return;
        }

        $availableStock = $inventory->current_stock - $inventory->reserved_stock;
        if ($availableStock > $inventory->minimum_stock) {
            return;
        }

        $recentNotification = Notification::where('type', NotificationService::LOW_STOCK)
            ->where('entity_type', 'outlet')
            ->where('entity_id', $outletId)
            ->where('created_at', '>', now()->subDay())
            ->exists();

        if ($recentNotification) {
            return;
        }

        $variant = ProductVariant::find($variantId);
        $productName = $variant?->full_name ?? "Product #{$variantId}";

        $this->notificationService->notifyLowStock(
            $outletId,
            $productName,
            $availableStock,
            $inventory->minimum_stock
        );
    }
}
