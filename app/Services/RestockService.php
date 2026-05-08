<?php

namespace App\Services;

use App\Models\OutletInventory;
use App\Models\RestockRequest;
use App\Models\StockDistribution;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RestockService
{
    public function createRequest(User $outletUser, array $payload): RestockRequest
    {
        return DB::transaction(function () use ($outletUser, $payload): RestockRequest {
            $outlet = $outletUser->outlet;
            abort_unless($outlet, 403);

            $request = RestockRequest::create([
                'outlet_id' => $outlet->id,
                'requested_by' => $outletUser->id,
                'status' => 'requested',
                'notes' => $payload['notes'] ?? null,
            ]);

            foreach ($payload['items'] as $item) {
                $request->items()->create([
                    'product_id' => $item['product_id'],
                    'requested_quantity' => $item['requested_quantity'],
                ]);
            }

            return $request->load(['outlet', 'items.product']);
        });
    }

    public function approveRequest(RestockRequest $request, User $owner, array $items, ?string $notes = null): RestockRequest
    {
        return DB::transaction(function () use ($request, $owner, $items, $notes): RestockRequest {
            $request = RestockRequest::query()->lockForUpdate()->with('items')->findOrFail($request->id);

            if ($request->status !== 'requested') {
                throw ValidationException::withMessages(['status' => 'Request hanya bisa di-approve saat status requested.']);
            }

            $approvedByItemId = collect($items)->keyBy('restock_request_item_id');

            foreach ($request->items as $requestItem) {
                $approvedQuantity = (int) ($approvedByItemId->get($requestItem->id)['approved_quantity'] ?? 0);
                $requestItem->update(['approved_quantity' => $approvedQuantity]);
            }

            $request->update([
                'status' => 'approved',
                'owner_notes' => $notes,
                'approved_by' => $owner->id,
                'approved_at' => now(),
            ]);

            $this->createDistribution($request->fresh('items'), $owner);

            return $request->fresh(['outlet', 'items.product', 'distribution.items.product']);
        });
    }

    public function rejectRequest(RestockRequest $request, User $owner, string $reason): RestockRequest
    {
        return DB::transaction(function () use ($request, $owner, $reason): RestockRequest {
            $request = RestockRequest::query()->lockForUpdate()->findOrFail($request->id);

            if ($request->status !== 'requested') {
                throw ValidationException::withMessages(['status' => 'Request hanya bisa di-reject saat status requested.']);
            }

            $request->update([
                'status' => 'rejected',
                'rejected_by' => $owner->id,
                'rejected_at' => now(),
                'rejected_reason' => $reason,
            ]);

            return $request->fresh(['outlet', 'items.product']);
        });
    }

    public function createDistribution(RestockRequest $request, User $owner): StockDistribution
    {
        return DB::transaction(function () use ($request, $owner): StockDistribution {
            $request = RestockRequest::query()->lockForUpdate()->with(['items', 'distribution'])->findOrFail($request->id);

            if ($request->status !== 'approved') {
                throw ValidationException::withMessages(['status' => 'Distribution hanya bisa dibuat dari request approved.']);
            }

            if ($request->distribution) {
                return $request->distribution->load('items.product');
            }

            $distribution = StockDistribution::create([
                'restock_request_id' => $request->id,
                'outlet_id' => $request->outlet_id,
                'status' => 'preparing',
                'sent_by' => $owner->id,
                'notes' => $request->owner_notes,
            ]);

            foreach ($request->items as $item) {
                if ((int) $item->approved_quantity <= 0) {
                    continue;
                }

                $distribution->items()->create([
                    'product_id' => $item->product_id,
                    'quantity' => $item->approved_quantity,
                ]);
            }

            $request->update(['status' => 'preparing']);

            return $distribution->load(['outlet', 'items.product']);
        });
    }

    public function markShipped(StockDistribution $distribution, User $owner): StockDistribution
    {
        return DB::transaction(function () use ($distribution, $owner): StockDistribution {
            $distribution = StockDistribution::query()->lockForUpdate()->with('restockRequest')->findOrFail($distribution->id);

            if ($distribution->status !== 'preparing') {
                throw ValidationException::withMessages(['status' => 'Distribution hanya bisa dikirim saat preparing.']);
            }

            $distribution->update([
                'status' => 'shipped',
                'sent_by' => $owner->id,
                'sent_at' => now(),
            ]);

            $distribution->restockRequest?->update(['status' => 'shipped']);

            return $distribution->fresh(['outlet', 'items.product', 'restockRequest']);
        });
    }

    public function confirmReceived(StockDistribution $distribution, User $outletUser): StockDistribution
    {
        return DB::transaction(function () use ($distribution, $outletUser): StockDistribution {
            $distribution = StockDistribution::query()
                ->lockForUpdate()
                ->with(['items', 'restockRequest'])
                ->findOrFail($distribution->id);

            abort_unless($outletUser->outlet?->id === $distribution->outlet_id, 403);

            if (in_array($distribution->status, ['received', 'completed'], true)) {
                return $distribution->fresh(['outlet', 'items.product', 'restockRequest']);
            }

            if ($distribution->status !== 'shipped') {
                throw ValidationException::withMessages(['status' => 'Distribution hanya bisa diterima saat shipped.']);
            }

            foreach ($distribution->items as $item) {
                $inventory = OutletInventory::firstOrCreate(
                    ['outlet_id' => $distribution->outlet_id, 'product_id' => $item->product_id],
                    ['current_stock' => 0, 'reserved_stock' => 0, 'minimum_stock' => 0]
                );

                $inventory->lockForUpdate();
                $beforeStock = $inventory->current_stock;
                $inventory->current_stock += $item->quantity;
                $inventory->save();

                StockMovement::create([
                    'outlet_id' => $distribution->outlet_id,
                    'product_id' => $item->product_id,
                    'type' => 'restock_in',
                    'quantity' => $item->quantity,
                    'before_stock' => $beforeStock,
                    'after_stock' => $inventory->current_stock,
                    'reference_type' => StockDistribution::class,
                    'reference_id' => $distribution->id,
                    'notes' => 'Restock diterima outlet.',
                    'created_by' => $outletUser->id,
                ]);
            }

            $distribution->update([
                'status' => 'completed',
                'received_by' => $outletUser->id,
                'received_at' => now(),
            ]);

            $distribution->restockRequest?->update(['status' => 'completed']);

            return $distribution->fresh(['outlet', 'items.product', 'restockRequest']);
        });
    }
}
