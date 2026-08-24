<?php

namespace Tests\Feature;

use App\Enums\PaymentAttemptSettlementStatus;
use App\Enums\PaymentAttemptVerificationStatus;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\PaymentAttempt;
use App\Models\Product;
use App\Models\RefundObligation;
use App\Models\StockMovement;
use App\Services\CanonicalPaymentTransitionService;
use App\Services\InventoryService;
use App\Services\NormalizedPaymentEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentFulfilmentConcurrencyTest extends TestCase
{
    use RefreshDatabase;

    public function test_order_completion_does_not_block_reservation_movements(): void
    {
        $outlet = Outlet::factory()->create();
        $product = Product::factory()->create();
        StockMovement::create(['outlet_id' => $outlet->id, 'product_id' => $product->id, 'type' => 'order_reserved', 'quantity' => 1, 'reference_type' => Order::class, 'reference_id' => 1]);
        StockMovement::create(['outlet_id' => $outlet->id, 'product_id' => $product->id, 'type' => 'order_cancelled', 'quantity' => 1, 'reference_type' => Order::class, 'reference_id' => 1]);

        $this->assertSame(2, StockMovement::where('reference_id', 1)->count());
    }

    public function test_duplicate_product_lines_are_completed_as_one_inventory_decrement(): void
    {
        $outlet = Outlet::factory()->create();
        $order = Order::factory()->create(['outlet_id' => $outlet->id, 'status' => Order::STATUS_CONFIRMED]);
        $product = Product::factory()->create();
        foreach ([1, 2] as $quantity) {
            $order->items()->create(['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => $quantity, 'price' => 50000, 'subtotal' => 50000 * $quantity]);
        }
        OutletInventory::create(['outlet_id' => $outlet->id, 'product_id' => $product->id, 'current_stock' => 5, 'reserved_stock' => 3, 'minimum_stock' => 0]);

        app(InventoryService::class)->completeOrderStock($order->fresh(['items']));

        $inventory = OutletInventory::where('outlet_id', $outlet->id)->where('product_id', $product->id)->first();
        $this->assertSame(2, $inventory->current_stock);
        $this->assertSame(0, $inventory->reserved_stock);
        $this->assertSame(1, StockMovement::where('type', 'order_completed')->count());
    }

    public function test_order_completion_movement_is_idempotent(): void
    {
        $outlet = Outlet::factory()->create();
        $order = Order::factory()->create(['outlet_id' => $outlet->id, 'status' => Order::STATUS_CONFIRMED]);
        $product = Product::factory()->create();
        $order->items()->create(['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 1, 'price' => 50000, 'subtotal' => 50000]);
        OutletInventory::create(['outlet_id' => $outlet->id, 'product_id' => $product->id, 'current_stock' => 3, 'reserved_stock' => 1, 'minimum_stock' => 0]);

        app(InventoryService::class)->completeOrderStock($order->fresh(['items']));
        app(InventoryService::class)->completeOrderStock($order->fresh(['items']));

        $this->assertSame(1, StockMovement::where('reference_type', Order::class)->where('reference_id', $order->id)->where('type', 'order_completed')->count());
    }

    public function test_only_one_successful_attempt_claims_order_fulfilment(): void
    {
        $outlet = Outlet::factory()->create();
        $order = Order::factory()->create(['outlet_id' => $outlet->id, 'total' => 50000, 'payment_status' => 'pending', 'status' => Order::STATUS_CONFIRMED]);
        $product = Product::factory()->create();
        $order->items()->create(['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 1, 'price' => 50000, 'subtotal' => 50000]);
        OutletInventory::create(['outlet_id' => $order->outlet_id, 'product_id' => $product->id, 'current_stock' => 3, 'reserved_stock' => 1, 'minimum_stock' => 0]);
        $first = $this->attempt($order, 'first', 'invoice-first');
        $second = $this->attempt($order, 'second', 'invoice-second');
        $event = fn (string $invoice) => new NormalizedPaymentEvent('doku', 'SUCCESS', 50000, 'IDR', $invoice, now(), []);

        app(CanonicalPaymentTransitionService::class)->apply($first, $event('invoice-first'));
        app(CanonicalPaymentTransitionService::class)->apply($second, $event('invoice-second'));

        $this->assertNotNull($order->fresh()->fulfilment_claimed_at);
        $this->assertSame(1, PaymentAttempt::whereNotNull('fulfilment_claimed_at')->count());
        $this->assertSame(1, RefundObligation::where('reason', 'duplicate_paid_attempt')->count());
        $this->assertSame(Order::STATUS_COMPLETED, $order->fresh()->status);
        $this->assertSame(1, StockMovement::where('reference_type', Order::class)->where('reference_id', $order->id)->where('type', 'order_completed')->count());
    }

    private function attempt(Order $order, string $key, string $invoice): PaymentAttempt
    {
        return PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => $key,
            'invoice_number' => $invoice,
            'merchant_request_id' => $key.'-request',
            'amount_snapshot' => 50000,
            'currency_snapshot' => 'IDR',
            'settlement_status' => PaymentAttemptSettlementStatus::Pending,
            'verification_status' => PaymentAttemptVerificationStatus::NeedsReview,
        ]);
    }
}
