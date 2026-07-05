<?php

namespace App\Services;

use App\Models\ExchangeRequest;
use App\Models\ExchangeStatusHistory;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\OutletPayable;
use App\Models\ProductVariant;
use App\Models\ReturnRequest;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ExchangeService
{
    public function __construct(
        private readonly SettlementGeneratorService $settlementGeneratorService,
    ) {}

    public function createRequest(Outlet $outlet, User $requester, array $data): ExchangeRequest
    {
        return DB::transaction(function () use ($outlet, $requester, $data) {
            $returnValue = 0;
            $exchangeValue = 0;
            $this->assertOutletHasAvailableStock($outlet, $data['items']);

            if (! empty($data['return_request_id'])) {
                $return = ReturnRequest::findOrFail($data['return_request_id']);
                if ((int) $return->outlet_id !== (int) $outlet->id) {
                    throw ValidationException::withMessages([
                        'return_request_id' => ['Return terkait tidak tersedia untuk outlet ini.'],
                    ]);
                }
                if (! in_array($return->status, [ReturnRequest::STATUS_APPROVED, ReturnRequest::STATUS_RECEIVED_AT_CENTER], true)) {
                    throw ValidationException::withMessages([
                        'return_request_id' => ['Return terkait harus disetujui atau sudah diterima di pusat.'],
                    ]);
                }
                $returnValue = $return->total_value;
            }

            $items = [];
            foreach ($data['items'] as $item) {
                $variant = ProductVariant::lockForUpdate()->findOrFail($item['product_variant_id']);
                $subtotal = $variant->selling_price * $item['quantity'];
                $exchangeValue += $subtotal;

                $replacementVariantId = $item['replacement_variant_id'] ?? null;
                $replacementQuantity = $item['replacement_quantity'] ?? null;

                $items[] = [
                    'product_variant_id' => $variant->id,
                    'replacement_variant_id' => $replacementVariantId,
                    'quantity' => $item['quantity'],
                    'replacement_quantity' => $replacementQuantity,
                    'unit_price' => $variant->selling_price,
                    'subtotal' => $subtotal,
                ];
            }

            $exchange = ExchangeRequest::create([
                'return_request_id' => $data['return_request_id'] ?? null,
                'outlet_id' => $outlet->id,
                'requested_by' => $requester->id,
                'notes' => $data['notes'] ?? null,
                'status' => ExchangeRequest::STATUS_SUBMITTED,
                'return_value' => $returnValue,
                'exchange_value' => $exchangeValue,
            ]);

            foreach ($items as $item) {
                $exchange->items()->create($item);
            }

            $this->recordHistory($exchange, null, ExchangeRequest::STATUS_SUBMITTED, $requester->id);

            app(NotificationService::class)->notifyExchangeRequestCreated(
                $exchange->fresh(['outlet', 'items.variant.family', 'returnRequest'])
            );

            return $exchange->load(['items.variant', 'outlet', 'requester', 'returnRequest']);
        });
    }

    public function cancelRequest(ExchangeRequest $exchange, User $user, string $reason): ExchangeRequest
    {
        return DB::transaction(function () use ($exchange, $user, $reason) {
            if (! $exchange->isSubmitted()) {
                throw ValidationException::withMessages([
                    'status' => ['Only submitted exchange requests can be cancelled.'],
                ]);
            }

            $from = $exchange->status;
            $exchange->update(['status' => ExchangeRequest::STATUS_CANCELLED]);

            $this->recordHistory($exchange, $from, ExchangeRequest::STATUS_CANCELLED, $user->id, $reason);

            return $exchange->fresh()->load(['items.variant', 'outlet', 'requester']);
        });
    }

    public function approveRequest(ExchangeRequest $exchange, User $owner, ?string $notes = null): ExchangeRequest
    {
        return DB::transaction(function () use ($exchange, $owner, $notes) {
            if (! $exchange->isSubmitted()) {
                throw ValidationException::withMessages([
                    'status' => ['Only submitted exchange requests can be approved.'],
                ]);
            }

            $from = $exchange->status;
            $exchange->update([
                'status' => ExchangeRequest::STATUS_APPROVED,
                'reviewed_by' => $owner->id,
                'reviewed_at' => now(),
                'review_notes' => $notes,
            ]);

            $this->recordHistory($exchange, $from, ExchangeRequest::STATUS_APPROVED, $owner->id, $notes);

            app(NotificationService::class)->notifyExchangeApproved($exchange);

            return $exchange->fresh()->load(['items.variant', 'outlet', 'requester']);
        });
    }

    public function rejectRequest(ExchangeRequest $exchange, User $owner, string $reason): ExchangeRequest
    {
        return DB::transaction(function () use ($exchange, $owner, $reason) {
            if (! $exchange->isSubmitted()) {
                throw ValidationException::withMessages([
                    'status' => ['Only submitted exchange requests can be rejected.'],
                ]);
            }

            $from = $exchange->status;
            $exchange->update([
                'status' => ExchangeRequest::STATUS_REJECTED,
                'reviewed_by' => $owner->id,
                'reviewed_at' => now(),
                'review_notes' => $reason,
            ]);

            $this->recordHistory($exchange, $from, ExchangeRequest::STATUS_REJECTED, $owner->id, $reason);

            app(NotificationService::class)->notifyExchangeRejected($exchange, $reason);

            return $exchange->fresh()->load(['items.variant', 'outlet', 'requester']);
        });
    }

    /**
     * Optional step: transitions approved → preparing.
     * Not used by the current UI (markShipped accepts both approved and preparing).
     * Kept for API flexibility — callers may use this if a preparing workflow is needed.
     */
    public function markPreparing(ExchangeRequest $exchange, User $owner): ExchangeRequest
    {
        return DB::transaction(function () use ($exchange, $owner) {
            if (! $exchange->isApproved()) {
                throw ValidationException::withMessages([
                    'status' => ['Only approved exchanges can be marked as preparing.'],
                ]);
            }

            $from = $exchange->status;
            $exchange->update([
                'status' => ExchangeRequest::STATUS_PREPARING,
            ]);

            $this->recordHistory($exchange, $from, ExchangeRequest::STATUS_PREPARING, $owner->id);

            return $exchange->fresh()->load(['items.variant', 'outlet', 'requester']);
        });
    }

    public function markShipped(ExchangeRequest $exchange, User $owner): ExchangeRequest
    {
        return DB::transaction(function () use ($exchange, $owner) {
            $exchange = $this->lockExchange($exchange->id);

            if (! $exchange->isPreparing() && ! $exchange->isApproved()) {
                throw ValidationException::withMessages([
                    'status' => ['Only preparing or approved exchanges can be shipped.'],
                ]);
            }

            foreach ($exchange->items as $item) {
                $this->deductCenterInventory($exchange, $item->product_variant_id, $item->quantity, $owner->id);
            }

            $from = $exchange->status;
            $exchange->update([
                'status' => ExchangeRequest::STATUS_SHIPPED,
                'shipped_by' => $owner->id,
                'shipped_at' => now(),
            ]);

            $this->recordHistory($exchange, $from, ExchangeRequest::STATUS_SHIPPED, $owner->id);

            app(NotificationService::class)->notifyExchangeShipped($exchange);

            return $exchange->fresh()->load(['items.variant', 'outlet', 'requester']);
        });
    }

    public function confirmReceived(ExchangeRequest $exchange, User $outletUser, ?string $notes = null): ExchangeRequest
    {
        return DB::transaction(function () use ($exchange, $outletUser, $notes) {
            $exchange = $this->lockExchange($exchange->id);

            if (! $exchange->isShipped()) {
                throw ValidationException::withMessages([
                    'status' => ['Only shipped exchanges can be confirmed as received.'],
                ]);
            }

            // Add replacement stock to outlet
            foreach ($exchange->items as $item) {
                $this->addToOutletInventory($exchange->outlet_id, $item->product_variant_id, $item->quantity, $exchange->id, $outletUser->id);
            }

            $from = $exchange->status;
            $exchange->update([
                'status' => ExchangeRequest::STATUS_RECEIVED,
                'received_by' => $outletUser->id,
                'received_at' => now(),
                'received_notes' => $notes,
            ]);

            $this->recordHistory($exchange, $from, ExchangeRequest::STATUS_RECEIVED, $outletUser->id, $notes);

            app(NotificationService::class)->notifyExchangeReceived($exchange);

            return $exchange->fresh()->load(['items.variant', 'outlet', 'requester']);
        });
    }

    public function completeExchange(ExchangeRequest $exchange, User $owner): ExchangeRequest
    {
        return DB::transaction(function () use ($exchange, $owner) {
            $exchange = $this->lockExchange($exchange->id);

            if (! $exchange->isReceived()) {
                throw ValidationException::withMessages([
                    'status' => ['Only received exchanges can be completed.'],
                ]);
            }

            // Complete the linked return if exists
            if ($exchange->returnRequest && $exchange->returnRequest->isReceivedAtCenter()) {
                app(ReturnService::class)->completeReturn($exchange->returnRequest, $owner, notes: null, recordAdjustment: false);
            }

            $this->recordExchangeAdjustment($exchange, $owner);

            // Sync adjustment to settlement
            $outlet = $exchange->outlet;
            if ($outlet) {
                $this->settlementGeneratorService->syncAdjustments($outlet, $exchange->created_at);
            }

            $from = $exchange->status;
            $exchange->update([
                'status' => ExchangeRequest::STATUS_COMPLETED,
            ]);

            $this->recordHistory($exchange, $from, ExchangeRequest::STATUS_COMPLETED, $owner->id);

            app(NotificationService::class)->notifyExchangeCompleted($exchange);

            return $exchange->fresh()->load(['items.variant', 'outlet', 'requester']);
        });
    }

    public function getOwnerDashboard(): array
    {
        $pendingExchanges = ExchangeRequest::whereIn('status', [
            ExchangeRequest::STATUS_SUBMITTED,
            ExchangeRequest::STATUS_APPROVED,
            ExchangeRequest::STATUS_PREPARING,
        ])->count();

        $exchangeValue = ExchangeRequest::where('status', ExchangeRequest::STATUS_COMPLETED)
            ->sum('exchange_value');

        return [
            'pending_exchanges' => $pendingExchanges,
            'exchange_value' => $exchangeValue,
        ];
    }

    private function addToOutletInventory(int $outletId, int $variantId, int $quantity, int $exchangeId, int $userId): void
    {
        $variant = ProductVariant::findOrFail($variantId);
        $inventory = OutletInventory::lockForUpdate()
            ->firstOrCreate(
                ['outlet_id' => $outletId, 'product_variant_id' => $variantId],
                ['product_id' => $variant->product_id, 'current_stock' => 0, 'reserved_stock' => 0, 'minimum_stock' => 0]
            );

        $before = $inventory->current_stock;
        $inventory->increment('current_stock', $quantity);
        $after = $inventory->current_stock;

        StockMovement::create([
            'outlet_id' => $outletId,
            'product_variant_id' => $variantId,
            'type' => 'exchange_in',
            'quantity' => $quantity,
            'before_stock' => $before,
            'after_stock' => $after,
            'before_reserved' => $inventory->reserved_stock,
            'after_reserved' => $inventory->reserved_stock,
            'reference_type' => ExchangeRequest::class,
            'reference_id' => $exchangeId,
            'notes' => 'Exchange replacement stock received',
            'created_by' => $userId,
        ]);
    }

    private function deductCenterInventory(ExchangeRequest $exchange, int $variantId, int $quantity, int $userId): void
    {
        $variant = ProductVariant::query()->lockForUpdate()->findOrFail($variantId);
        $before = (int) $variant->center_stock;

        if ($before < $quantity) {
            throw ValidationException::withMessages([
                'inventory' => ["Stok pusat untuk {$variant->name} hanya {$before}."],
            ]);
        }

        $variant->decrement('center_stock', $quantity);
        $after = (int) $variant->fresh()->center_stock;

        StockMovement::create([
            'outlet_id' => $exchange->outlet_id,
            'product_variant_id' => $variantId,
            'type' => 'exchange_out',
            'quantity' => -$quantity,
            'before_stock' => $before,
            'after_stock' => $after,
            'before_reserved' => 0,
            'after_reserved' => 0,
            'reference_type' => ExchangeRequest::class,
            'reference_id' => $exchange->id,
            'notes' => 'Center stock shipped as exchange replacement',
            'created_by' => $userId,
        ]);
    }

    /**
     * Exchanges represent an outlet asking to replace stock it currently owns.
     * Prevent impossible requests before owner processing starts.
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

    private function recordHistory(ExchangeRequest $exchange, ?string $from, string $to, ?int $userId, ?string $notes = null): void
    {
        ExchangeStatusHistory::create([
            'exchange_request_id' => $exchange->id,
            'from_status' => $from,
            'to_status' => $to,
            'notes' => $notes,
            'changed_by' => $userId,
        ]);
    }

    private function recordExchangeAdjustment(ExchangeRequest $exchange, User $owner): void
    {
        $difference = (float) $exchange->exchange_value - (float) $exchange->return_value;

        if (abs($difference) < 0.00001) {
            return;
        }

        if (OutletPayable::query()
            ->where('reference_type', ExchangeRequest::class)
            ->where('reference_id', $exchange->id)
            ->where('type', 'adjustment')
            ->exists()) {
            return;
        }

        OutletPayable::create([
            'outlet_id' => $exchange->outlet_id,
            'type' => 'adjustment',
            'amount' => $difference,
            'center_share' => $difference,
            'outlet_margin' => 0,
            'reference_type' => ExchangeRequest::class,
            'reference_id' => $exchange->id,
            'notes' => sprintf(
                'Exchange #%d adjustment | return_value=%s | replacement_value=%s | difference=%s',
                $exchange->id,
                number_format((float) $exchange->return_value, 2, '.', ''),
                number_format((float) $exchange->exchange_value, 2, '.', ''),
                number_format($difference, 2, '.', '')
            ),
            'created_by' => $owner->id,
        ]);
    }

    private function lockExchange(int $exchangeId): ExchangeRequest
    {
        return ExchangeRequest::query()
            ->with(['items', 'returnRequest'])
            ->lockForUpdate()
            ->findOrFail($exchangeId);
    }
}
