<?php

namespace App\Services;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\OutletPayable;
use App\Models\ProductVariant;
use App\Models\ReturnRequest;
use App\Models\ReturnRequestItem;
use App\Models\ReturnStatusHistory;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReturnService
{
    public function createRequest(Outlet $outlet, User $requester, array $data): ReturnRequest
    {
        return DB::transaction(function () use ($outlet, $requester, $data) {
            $totalValue = 0;
            $items = [];
            $this->assertOutletHasAvailableStock($outlet, $data['items']);

            foreach ($data['items'] as $item) {
                $variant = ProductVariant::lockForUpdate()->findOrFail($item['product_variant_id']);
                $subtotal = $variant->selling_price * $item['quantity'];
                $totalValue += $subtotal;

                $items[] = [
                    'product_variant_id' => $variant->id,
                    'quantity' => $item['quantity'],
                    'unit_price' => $variant->selling_price,
                    'subtotal' => $subtotal,
                ];
            }

            $return = ReturnRequest::create([
                'outlet_id' => $outlet->id,
                'requested_by' => $requester->id,
                'reason' => $data['reason'],
                'notes' => $data['notes'] ?? null,
                'status' => ReturnRequest::STATUS_SUBMITTED,
                'total_value' => $totalValue,
            ]);

            foreach ($items as $item) {
                $return->items()->create($item);
            }

            $this->recordHistory($return, null, ReturnRequest::STATUS_SUBMITTED, $requester->id, $data['notes'] ?? null);

            app(NotificationService::class)->notifyReturnRequestCreated($return->fresh(['outlet', 'items.variant.family']));

            return $return->load(['items.variant', 'outlet', 'requester']);
        });
    }

    public function approveRequest(ReturnRequest $return, User $owner, ?string $notes = null): ReturnRequest
    {
        return DB::transaction(function () use ($return, $owner, $notes) {
            if (! $return->isSubmitted()) {
                throw ValidationException::withMessages([
                    'status' => ['Only submitted requests can be approved.'],
                ]);
            }

            $from = $return->status;
            $return->update([
                'status' => ReturnRequest::STATUS_APPROVED,
                'reviewed_by' => $owner->id,
                'reviewed_at' => now(),
                'review_notes' => $notes,
            ]);

            $this->recordHistory($return, $from, ReturnRequest::STATUS_APPROVED, $owner->id, $notes);

            return $return->fresh()->load(['items.variant', 'outlet', 'requester']);
        });
    }

    public function rejectRequest(ReturnRequest $return, User $owner, string $reason): ReturnRequest
    {
        return DB::transaction(function () use ($return, $owner, $reason) {
            if (! $return->isSubmitted()) {
                throw ValidationException::withMessages([
                    'status' => ['Only submitted requests can be rejected.'],
                ]);
            }

            $from = $return->status;
            $return->update([
                'status' => ReturnRequest::STATUS_REJECTED,
                'reviewed_by' => $owner->id,
                'reviewed_at' => now(),
                'review_notes' => $reason,
            ]);

            $this->recordHistory($return, $from, ReturnRequest::STATUS_REJECTED, $owner->id, $reason);

            return $return->fresh()->load(['items.variant', 'outlet', 'requester']);
        });
    }

    public function markReceivedAtCenter(ReturnRequest $return, User $owner, ?string $notes = null): ReturnRequest
    {
        return DB::transaction(function () use ($return, $owner, $notes) {
            if (! $return->isApproved()) {
                throw ValidationException::withMessages([
                    'status' => ['Only approved requests can be marked as received.'],
                ]);
            }

            foreach ($return->items as $item) {
                $this->adjustOutletInventory($return->outlet_id, $item->product_variant_id, -$item->quantity, $return->id, $owner->id);
                $this->adjustCenterInventory($return->outlet_id, $item->product_variant_id, $item->quantity, $return->id, $owner->id);
            }

            $from = $return->status;
            $return->update([
                'status' => ReturnRequest::STATUS_RECEIVED_AT_CENTER,
                'received_by' => $owner->id,
                'received_at' => now(),
                'received_notes' => $notes,
            ]);

            $this->recordHistory($return, $from, ReturnRequest::STATUS_RECEIVED_AT_CENTER, $owner->id, $notes);

            return $return->fresh()->load(['items.variant', 'outlet', 'requester']);
        });
    }

    public function completeReturn(ReturnRequest $return, User $owner, ?string $notes = null, bool $recordAdjustment = true): ReturnRequest
    {
        return DB::transaction(function () use ($return, $owner, $notes, $recordAdjustment) {
            if (! $return->isReceivedAtCenter()) {
                throw ValidationException::withMessages([
                    'status' => ['Only received requests can be completed.'],
                ]);
            }

            if ($recordAdjustment) {
                $this->recordReturnAdjustment($return, $owner);
            }

            $from = $return->status;
            $return->update([
                'status' => ReturnRequest::STATUS_COMPLETED,
            ]);

            $this->recordHistory($return, $from, ReturnRequest::STATUS_COMPLETED, $owner->id, $notes);

            return $return->fresh()->load(['items.variant', 'outlet', 'requester']);
        });
    }

    public function getOwnerDashboard(): array
    {
        $pendingReturns = ReturnRequest::whereIn('status', [
            ReturnRequest::STATUS_SUBMITTED,
            ReturnRequest::STATUS_APPROVED,
        ])->count();

        $returnedValue = ReturnRequest::where('status', ReturnRequest::STATUS_COMPLETED)
            ->sum('total_value');

        $mostReturnedVariants = ReturnRequestItem::select('product_variant_id')
            ->selectRaw('SUM(quantity) as total_qty')
            ->selectRaw('SUM(subtotal) as total_value')
            ->join('return_requests', 'return_request_id', '=', 'return_requests.id')
            ->whereIn('return_requests.status', [
                ReturnRequest::STATUS_RECEIVED_AT_CENTER,
                ReturnRequest::STATUS_COMPLETED,
            ])
            ->groupBy('product_variant_id')
            ->orderByDesc('total_qty')
            ->limit(5)
            ->with('variant')
            ->get();

        $mostReturnedOutlets = ReturnRequest::select('outlet_id')
            ->selectRaw('COUNT(*) as return_count')
            ->selectRaw('SUM(total_value) as total_value')
            ->whereIn('status', [
                ReturnRequest::STATUS_RECEIVED_AT_CENTER,
                ReturnRequest::STATUS_COMPLETED,
            ])
            ->groupBy('outlet_id')
            ->orderByDesc('return_count')
            ->limit(5)
            ->with('outlet')
            ->get();

        return [
            'pending_returns' => $pendingReturns,
            'returned_value' => $returnedValue,
            'most_returned_variants' => $mostReturnedVariants,
            'most_returned_outlets' => $mostReturnedOutlets,
        ];
    }

    private function adjustOutletInventory(int $outletId, int $variantId, int $quantity, int $returnId, int $userId): void
    {
        $inventory = OutletInventory::lockForUpdate()
            ->where('outlet_id', $outletId)
            ->where('product_variant_id', $variantId)
            ->first();

        if (! $inventory) {
            throw ValidationException::withMessages([
                'inventory' => ['Outlet inventory not found for this variant.'],
            ]);
        }

        $before = $inventory->current_stock;

        if ($before < abs($quantity)) {
            throw ValidationException::withMessages([
                'inventory' => ['Stok outlet tidak cukup untuk dipindahkan ke pusat.'],
            ]);
        }

        $inventory->decrement('current_stock', abs($quantity));
        $after = $inventory->current_stock;

        StockMovement::create([
            'outlet_id' => $outletId,
            'product_variant_id' => $variantId,
            'type' => 'return_out',
            'quantity' => $quantity,
            'before_stock' => $before,
            'after_stock' => $after,
            'before_reserved' => $inventory->reserved_stock,
            'after_reserved' => $inventory->reserved_stock,
            'reference_type' => ReturnRequest::class,
            'reference_id' => $returnId,
            'notes' => 'Return to center',
            'created_by' => $userId,
        ]);
    }

    /**
     * Return requests remove stock from the outlet later, so the request itself
     * must not exceed stock that is currently available.
     */
    private function assertOutletHasAvailableStock(Outlet $outlet, array $items): void
    {
        $requested = [];
        $firstIndexes = [];

        foreach ($items as $index => $item) {
            $variantId = (int) $item['product_variant_id'];
            $requested[$variantId] = ($requested[$variantId] ?? 0) + (int) $item['quantity'];
            $firstIndexes[$variantId] ??= $index;
        }

        $inventories = OutletInventory::lockForUpdate()
            ->where('outlet_id', $outlet->id)
            ->whereIn('product_variant_id', array_keys($requested))
            ->get()
            ->keyBy('product_variant_id');

        foreach ($requested as $variantId => $quantity) {
            $inventory = $inventories->get($variantId);
            $available = $inventory ? ((int) $inventory->current_stock - (int) $inventory->reserved_stock) : 0;

            if ($available < $quantity) {
                throw ValidationException::withMessages([
                    'items.'.$firstIndexes[$variantId].'.quantity' => ["Stok tersedia hanya {$available}."],
                ]);
            }
        }
    }

    private function adjustCenterInventory(int $outletId, int $variantId, int $quantity, int $returnId, int $userId): void
    {
        $variant = ProductVariant::lockForUpdate()->findOrFail($variantId);
        $before = (int) $variant->center_stock;
        $variant->increment('center_stock', $quantity);
        $after = (int) $variant->fresh()->center_stock;

        StockMovement::create([
            'outlet_id' => $outletId,
            'product_variant_id' => $variantId,
            'type' => 'return_in',
            'quantity' => $quantity,
            'before_stock' => $before,
            'after_stock' => $after,
            'before_reserved' => 0,
            'after_reserved' => 0,
            'reference_type' => ReturnRequest::class,
            'reference_id' => $returnId,
            'notes' => 'Return received at center',
            'created_by' => $userId,
        ]);
    }

    private function recordReturnAdjustment(ReturnRequest $return, User $owner): void
    {
        OutletPayable::create([
            'outlet_id' => $return->outlet_id,
            'type' => 'adjustment',
            'amount' => -$return->total_value,
            'center_share' => -$return->total_value,
            'outlet_margin' => 0,
            'reference_type' => ReturnRequest::class,
            'reference_id' => $return->id,
            'notes' => "Return #{$return->id} - {$return->reasonLabel()}",
            'created_by' => $owner->id,
        ]);
    }

    private function recordHistory(ReturnRequest $return, ?string $from, string $to, ?int $userId, ?string $notes): void
    {
        ReturnStatusHistory::create([
            'return_request_id' => $return->id,
            'from_status' => $from,
            'to_status' => $to,
            'notes' => $notes,
            'changed_by' => $userId,
        ]);
    }
}
