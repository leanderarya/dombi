<?php

namespace App\Services;

use App\Models\OutletInventory;
use App\Models\ProductVariant;
use App\Models\RestockRequest;
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

            $validItemIds = $request->items->pluck('id')->all();
            $approvedByItemId = collect($items)->keyBy('restock_request_item_id');

            foreach ($approvedByItemId as $itemId => $data) {
                if (! in_array((int) $itemId, $validItemIds, true)) {
                    throw ValidationException::withMessages([
                        'items' => "Item ID {$itemId} bukan milik restock request ini.",
                    ]);
                }
            }

            $hasApproved = $approvedByItemId->contains(fn ($item) => (int) ($item['approved_quantity'] ?? 0) > 0);
            if (! $hasApproved) {
                throw ValidationException::withMessages([
                    'items' => 'Minimal satu item harus memiliki approved quantity > 0.',
                ]);
            }

            foreach ($request->items as $requestItem) {
                $approvedQuantity = (int) ($approvedByItemId->get($requestItem->id)['approved_quantity'] ?? 0);
                if ($approvedQuantity > 0) {
                    $variant = \App\Models\ProductVariant::lockForUpdate()->find($requestItem->product_variant_id);
                    if ($variant && $variant->center_stock < $approvedQuantity) {
                        throw \Illuminate\Validation\ValidationException::withMessages([
                            'items' => "Stok pusat tidak cukup untuk {$variant->name}. Tersedia: {$variant->center_stock}, diminta: {$approvedQuantity}",
                        ]);
                    }
                }
                $requestItem->update(['approved_quantity' => $approvedQuantity]);
            }

            $request->update([
                'status' => 'preparing',
                'owner_notes' => $notes,
                'approved_by' => $owner->id,
                'approved_at' => now(),
            ]);

            $this->notificationService->notifyRestockApproved($request->fresh());

            return $request->fresh(['outlet', 'items.variant.family']);
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

    public function markShipped(RestockRequest $request, User $owner): RestockRequest
    {
        return DB::transaction(function () use ($request, $owner): RestockRequest {
            $request = RestockRequest::query()->lockForUpdate()->with(['items'])->findOrFail($request->id);

            if ($request->status !== 'preparing') {
                throw ValidationException::withMessages(['status' => 'Restock hanya bisa dikirim saat preparing.']);
            }

            foreach ($request->items as $item) {
                if ((int) $item->approved_quantity <= 0) {
                    continue;
                }

                $variant = ProductVariant::query()->lockForUpdate()->findOrFail($item->product_variant_id);
                $before = (int) $variant->center_stock;
                $quantity = (int) $item->approved_quantity;

                if ($before < $quantity) {
                    throw ValidationException::withMessages([
                        'inventory' => "Stok pusat untuk {$variant->name} hanya {$before}. Tidak cukup untuk distribusi {$quantity}.",
                    ]);
                }

                $variant->decrement('center_stock', $quantity);
                $after = (int) $variant->fresh()->center_stock;

                StockMovement::create([
                    'outlet_id' => null,
                    'product_id' => $item->product_id,
                    'product_variant_id' => $item->product_variant_id,
                    'type' => 'distribution_out',
                    'quantity' => -$quantity,
                    'before_stock' => $before,
                    'after_stock' => $after,
                    'before_reserved' => 0,
                    'after_reserved' => 0,
                    'reference_type' => RestockRequest::class,
                    'reference_id' => $request->id,
                    'notes' => 'Distribution shipped to outlet',
                    'created_by' => $owner->id,
                ]);
            }

            $request->update([
                'status' => 'shipped',
                'sent_by' => $owner->id,
                'sent_at' => now(),
            ]);

            $this->notificationService->notifyRestockShipped($request->fresh());

            return $request->fresh(['outlet', 'items.variant.family']);
        });
    }

    public function confirmReceived(RestockRequest $request, User $outletUser, ?string $receivedNotes = null, ?string $damageNotes = null): RestockRequest
    {
        return DB::transaction(function () use ($request, $outletUser, $receivedNotes, $damageNotes): RestockRequest {
            $request = RestockRequest::query()
                ->lockForUpdate()
                ->with(['items'])
                ->findOrFail($request->id);

            abort_unless($outletUser->outlet?->id === $request->outlet_id, 403);

            if (in_array($request->status, ['completed'], true)) {
                return $request->fresh(['outlet', 'items.variant.family']);
            }

            if ($request->status !== 'shipped') {
                throw ValidationException::withMessages(['status' => 'Restock hanya bisa diterima saat shipped.']);
            }

            foreach ($request->items as $item) {
                if ((int) $item->approved_quantity <= 0) {
                    continue;
                }

                $inventory = OutletInventory::query()
                    ->where('outlet_id', $request->outlet_id)
                    ->where('product_variant_id', $item->product_variant_id)
                    ->lockForUpdate()
                    ->first();

                if (! $inventory) {
                    $inventory = OutletInventory::create([
                        'outlet_id' => $request->outlet_id,
                        'product_variant_id' => $item->product_variant_id,
                        'current_stock' => 0,
                        'reserved_stock' => 0,
                        'minimum_stock' => 0,
                    ]);
                }

                $beforeStock = $inventory->current_stock;
                $beforeReserved = $inventory->reserved_stock;
                $inventory->current_stock += $item->approved_quantity;
                $inventory->last_restock_at = now();
                $inventory->save();

                StockMovement::create([
                    'outlet_id' => $request->outlet_id,
                    'product_id' => $item->product_id,
                    'product_variant_id' => $item->product_variant_id,
                    'type' => 'restock_in',
                    'quantity' => $item->approved_quantity,
                    'before_stock' => $beforeStock,
                    'after_stock' => $inventory->current_stock,
                    'before_reserved' => $beforeReserved,
                    'after_reserved' => $inventory->reserved_stock,
                    'reference_type' => RestockRequest::class,
                    'reference_id' => $request->id,
                    'notes' => 'Restock diterima outlet.',
                    'created_by' => $outletUser->id,
                ]);
            }

            $request->update([
                'status' => 'completed',
                'received_by' => $outletUser->id,
                'received_at' => now(),
                'received_notes' => $receivedNotes,
                'damage_notes' => $damageNotes,
            ]);

            $this->notificationService->notifyRestockReceived($request->fresh());

            return $request->fresh(['outlet', 'items.variant.family']);
        });
    }
}
