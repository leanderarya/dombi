<?php

namespace App\Services;

use App\Models\OutletInventory;
use App\Models\ProductVariant;
use App\Models\RestockRequest;
use App\Models\StockDistribution;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RestockService
{
    public function __construct(
        private readonly NotificationService $notificationService,
    ) {}

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
                $variant = ProductVariant::find($item['product_variant_id']);
                $request->items()->create([
                    'product_id' => $variant?->product_id,
                    'product_variant_id' => $item['product_variant_id'],
                    'requested_quantity' => $item['requested_quantity'],
                ]);
            }

            $request->load('outlet');
            $this->notificationService->notifyRestockCreated($request);

            return $request->load(['outlet', 'items.variant.family']);
        });
    }

    public function approveRequest(RestockRequest $request, User $owner, array $items, ?string $notes = null): RestockRequest
    {
        return DB::transaction(function () use ($request, $owner, $items, $notes): RestockRequest {
            $request = RestockRequest::query()->lockForUpdate()->with('items')->findOrFail($request->id);

            if ($request->status !== 'requested') {
                throw ValidationException::withMessages(['status' => 'Request hanya bisa di-approve saat status requested.']);
            }

            // Validate all restock_request_item_ids belong to this request
            $validItemIds = $request->items->pluck('id')->all();
            $approvedByItemId = collect($items)->keyBy('restock_request_item_id');

            foreach ($approvedByItemId as $itemId => $data) {
                if (! in_array((int) $itemId, $validItemIds, true)) {
                    throw ValidationException::withMessages([
                        'items' => "Item ID {$itemId} bukan milik restock request ini.",
                    ]);
                }
            }

            // Validate at least one item has approved_quantity > 0
            $hasApproved = $approvedByItemId->contains(fn ($item) => (int) ($item['approved_quantity'] ?? 0) > 0);
            if (! $hasApproved) {
                throw ValidationException::withMessages([
                    'items' => 'Minimal satu item harus memiliki approved quantity > 0.',
                ]);
            }

            foreach ($request->items as $requestItem) {
                $approvedQuantity = (int) ($approvedByItemId->get($requestItem->id)['approved_quantity'] ?? 0);
                $requestItem->update(['approved_quantity' => $approvedQuantity]);
            }

            $request->update([
                'status' => 'preparing',
                'owner_notes' => $notes,
                'approved_by' => $owner->id,
                'approved_at' => now(),
            ]);

            $this->createDistribution($request->fresh('items'), $owner);

            $this->notificationService->notifyRestockApproved($request->fresh());

            return $request->fresh(['outlet', 'items.variant.family', 'distribution.items.variant.family']);
        });
    }

    public function cancelRequest(RestockRequest $request, User $user): RestockRequest
    {
        return DB::transaction(function () use ($request, $user): RestockRequest {
            $request = RestockRequest::query()->lockForUpdate()->findOrFail($request->id);

            if ($request->status !== 'requested') {
                throw ValidationException::withMessages(['status' => 'Request hanya bisa dibatalkan saat status requested.']);
            }

            $request->update([
                'status' => 'cancelled',
                'rejected_by' => $user->id,
                'rejected_at' => now(),
                'rejected_reason' => 'Dibatalkan oleh outlet',
            ]);

            return $request->fresh();
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

            $this->notificationService->notifyRestockRejected($request->fresh(), $reason);

            return $request->fresh(['outlet', 'items.variant.family']);
        });
    }

    public function createDistribution(RestockRequest $request, User $owner): StockDistribution
    {
        return DB::transaction(function () use ($request): StockDistribution {
            $request = RestockRequest::query()->lockForUpdate()->with(['items', 'distribution'])->findOrFail($request->id);

            if ($request->status !== 'preparing') {
                throw ValidationException::withMessages(['status' => 'Distribution hanya bisa dibuat dari request preparing.']);
            }

            // Idempotency: if distribution already exists, return it
            if ($request->distribution) {
                return $request->distribution->load('items.variant.family');
            }

            $distribution = StockDistribution::create([
                'restock_request_id' => $request->id,
                'outlet_id' => $request->outlet_id,
                'status' => 'preparing',
                'notes' => $request->owner_notes,
            ]);

            $hasItems = false;
            foreach ($request->items as $item) {
                if ((int) $item->approved_quantity <= 0) {
                    continue;
                }

                $distribution->items()->create([
                    'product_id' => $item->product_id,
                    'product_variant_id' => $item->product_variant_id,
                    'quantity' => $item->approved_quantity,
                ]);
                $hasItems = true;
            }

            if (! $hasItems) {
                throw ValidationException::withMessages([
                    'items' => 'Distribution tidak boleh kosong, minimal satu item harus memiliki quantity > 0.',
                ]);
            }

            return $distribution->load(['outlet', 'items.variant.family']);
        });
    }

    public function markShipped(StockDistribution $distribution, User $owner): StockDistribution
    {
        return DB::transaction(function () use ($distribution, $owner): StockDistribution {
            $distribution = StockDistribution::query()->lockForUpdate()->with(['restockRequest', 'items'])->findOrFail($distribution->id);

            if ($distribution->status !== 'preparing') {
                throw ValidationException::withMessages(['status' => 'Distribution hanya bisa dikirim saat preparing.']);
            }

            foreach ($distribution->items as $item) {
                $variant = ProductVariant::query()->lockForUpdate()->findOrFail($item->product_variant_id);
                $before = (int) $variant->center_stock;
                $quantity = (int) $item->quantity;

                if ($before < $quantity) {
                    throw ValidationException::withMessages([
                        'inventory' => "Stok pusat untuk {$variant->name} hanya {$before}. Tidak cukup untuk distribusi {$quantity}.",
                    ]);
                }

                $variant->decrement('center_stock', $quantity);
                $after = (int) $variant->fresh()->center_stock;

                StockMovement::create([
                    'outlet_id' => $distribution->outlet_id,
                    'product_variant_id' => $item->product_variant_id,
                    'type' => 'distribution_out',
                    'quantity' => -$quantity,
                    'before_stock' => $before,
                    'after_stock' => $after,
                    'before_reserved' => 0,
                    'after_reserved' => 0,
                    'reference_type' => StockDistribution::class,
                    'reference_id' => $distribution->id,
                    'notes' => 'Distribution shipped to outlet',
                    'created_by' => $owner->id,
                ]);
            }

            $distribution->update([
                'status' => 'shipped',
                'sent_by' => $owner->id,
                'sent_at' => now(),
            ]);

            $distribution->restockRequest?->update(['status' => 'shipped']);

            $this->notificationService->notifyDistributionSent($distribution->fresh());

            return $distribution->fresh(['outlet', 'items.variant.family', 'restockRequest']);
        });
    }

    public function confirmReceived(StockDistribution $distribution, User $outletUser, ?string $receivedNotes = null, ?string $damageNotes = null): StockDistribution
    {
        return DB::transaction(function () use ($distribution, $outletUser, $receivedNotes, $damageNotes): StockDistribution {
            $distribution = StockDistribution::query()
                ->lockForUpdate()
                ->with(['items', 'restockRequest'])
                ->findOrFail($distribution->id);

            abort_unless($outletUser->outlet?->id === $distribution->outlet_id, 403);

            // Idempotency: if already completed, return without error
            if (in_array($distribution->status, ['received', 'completed'], true)) {
                return $distribution->fresh(['outlet', 'items.variant.family', 'restockRequest']);
            }

            if ($distribution->status !== 'shipped') {
                throw ValidationException::withMessages(['status' => 'Distribution hanya bisa diterima saat shipped.']);
            }

            foreach ($distribution->items as $item) {
                $inventory = OutletInventory::query()
                    ->where('outlet_id', $distribution->outlet_id)
                    ->where('product_variant_id', $item->product_variant_id)
                    ->lockForUpdate()
                    ->first();

                if (! $inventory) {
                    $inventory = OutletInventory::create([
                        'outlet_id' => $distribution->outlet_id,
                        'product_variant_id' => $item->product_variant_id,
                        'current_stock' => 0,
                        'reserved_stock' => 0,
                        'minimum_stock' => 0,
                    ]);
                }

                $beforeStock = $inventory->current_stock;
                $beforeReserved = $inventory->reserved_stock;
                $inventory->current_stock += $item->quantity;
                $inventory->last_restock_at = now();
                $inventory->save();

                StockMovement::create([
                    'outlet_id' => $distribution->outlet_id,
                    'product_id' => $item->product_id,
                    'product_variant_id' => $item->product_variant_id,
                    'type' => 'restock_in',
                    'quantity' => $item->quantity,
                    'before_stock' => $beforeStock,
                    'after_stock' => $inventory->current_stock,
                    'before_reserved' => $beforeReserved,
                    'after_reserved' => $inventory->reserved_stock,
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
                'received_notes' => $receivedNotes,
                'damage_notes' => $damageNotes,
            ]);

            $distribution->restockRequest?->update(['status' => 'completed']);

            $this->notificationService->notifyDistributionReceived($distribution->fresh());

            return $distribution->fresh(['outlet', 'items.variant.family', 'restockRequest']);
        });
    }
}
