<?php

namespace Tests\Feature;

use App\Models\CourierProfile;
use App\Models\Customer;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\User;
use App\Services\OrderStatusService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A cancelled order used to keep an open delivery row. The courier saw a live
 * task for a dead order, and tapping it walked into the order's transition
 * guard — InvalidOrderTransitionException, caught nowhere, rendered as a 500.
 */
class CourierCancelledOrderTest extends TestCase
{
    use RefreshDatabase;

    private function context(string $orderStatus = 'ready_for_pickup'): array
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $courier = User::factory()->create([
            'role' => 'courier',
            'is_active' => true,
            'is_online' => true,
        ]);
        $customer = Customer::create([
            'name' => 'Test Customer',
            'phone' => '6281234567890'.rand(1000, 9999),
        ]);
        $outlet = Outlet::create([
            'user_id' => $owner->id,
            'name' => 'Outlet Test',
            'kelurahan' => 'Menteng',
            'kecamatan' => 'Menteng',
            'address' => 'Jl. Test',
            'latitude' => -6.2,
            'longitude' => 106.8,
            'phone' => '08123456789',
            'status' => 'active',
        ]);

        CourierProfile::create([
            'user_id' => $courier->id,
            'courier_source' => 'outlet',
            'outlet_id' => $outlet->id,
            'invitation_status' => CourierProfile::STATUS_ACTIVE,
        ]);

        $product = Product::create([
            'name' => 'Nasi Goreng',
            'selling_price' => 25000,
            'is_active' => true,
        ]);
        OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'current_stock' => 100,
            'reserved_stock' => 1,
            'minimum_stock' => 10,
        ]);

        $order = Order::create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'ORD-'.strtoupper(substr(uniqid(), -6)),
            'status' => $orderStatus,
            'fulfillment_type' => 'delivery_dombi',
            'payment_status' => 'paid',
            'subtotal' => 25000,
            'delivery_fee' => 5000,
            'total' => 30000,
            'customer_name' => 'Budi',
            'customer_phone' => '08123456789',
            'customer_address' => 'Jl. Customer',
            'latitude' => -6.21,
            'longitude' => 106.81,
            'ordered_at' => now(),
            // A paid order needs a verified payment for the refund step the
            // cancellation runs; RefundService reads paid_at when there is no
            // payment attempt row.
            'paid_at' => now(),
        ]);

        $delivery = Delivery::create([
            'order_id' => $order->id,
            'courier_id' => $courier->id,
            'status' => 'waiting_pickup',
            'assigned_at' => now(),
        ]);

        return compact('owner', 'courier', 'customer', 'outlet', 'product', 'order', 'delivery');
    }

    /**
     * The root cause: cancelling outlet-side has to close the delivery row, or
     * it stays on the courier's list as a task that cannot be completed.
     */
    public function test_cancelling_outlet_side_releases_the_delivery(): void
    {
        $ctx = $this->context();

        app(OrderStatusService::class)->transition($ctx['order'], 'cancelled_by_outlet', [
            'reason' => 'Stok Tidak Tersedia',
            'actor_id' => $ctx['owner']->id,
            'actor_type' => 'outlet',
        ]);

        $this->assertSame('cancelled_and_released', $ctx['delivery']->fresh()->status);
        $this->assertDatabaseHas('delivery_status_histories', [
            'delivery_id' => $ctx['delivery']->id,
            'from_status' => 'waiting_pickup',
            'to_status' => 'cancelled_and_released',
            'changed_by_type' => 'system',
            'reason' => 'cancelled_by_outlet',
        ]);
    }

    /**
     * The same hole existed on every other terminal path — customer cancel,
     * outlet rejection, and expiry all leave the courier holding a dead task.
     */
    public function test_every_terminal_order_path_releases_the_delivery(): void
    {
        foreach (['cancelled_by_customer', 'rejected_by_outlet', 'expired'] as $terminal) {
            // The map only allows these from specific states: a customer can
            // only cancel before the outlet confirms, expiry belongs to the
            // confirmation window, rejection to pending_confirmation.
            $from = match ($terminal) {
                'cancelled_by_customer' => 'awaiting_preparation',
                'expired' => 'pending_confirmation',
                default => 'pending_confirmation',
            };

            $ctx = $this->context($from);

            app(OrderStatusService::class)->transition($ctx['order'], $terminal, [
                'actor_type' => 'system',
            ]);

            $this->assertSame(
                'cancelled_and_released',
                $ctx['delivery']->fresh()->status,
                "Delivery was not released on {$terminal}."
            );
        }
    }

    /**
     * A delivery that already reached a final status of its own is left alone;
     * the release is about open tasks, not history.
     */
    public function test_a_completed_delivery_is_not_touched_by_a_cancellation(): void
    {
        $ctx = $this->context('ready_for_pickup');
        $ctx['delivery']->update(['status' => 'completed']);

        app(OrderStatusService::class)->transition($ctx['order'], 'cancelled_by_outlet', [
            'reason' => 'Gangguan Operasional',
            'actor_type' => 'outlet',
        ]);

        $this->assertSame('completed', $ctx['delivery']->fresh()->status);
    }

    /**
     * The 500. Before the guard, this response was a debug page carrying
     * "Invalid order transition: cancelled_by_outlet → picked_up".
     */
    public function test_confirming_pickup_on_a_cancelled_order_returns_a_message_not_a_500(): void
    {
        $ctx = $this->context('cancelled_by_outlet');

        $response = $this->actingAs($ctx['courier'])
            ->post("/courier/deliveries/{$ctx['delivery']->id}/confirm-pickup");

        $response->assertRedirect();
        $response->assertSessionHasErrors('status');

        $this->assertSame('waiting_pickup', $ctx['delivery']->fresh()->status);
    }

    /**
     * Rejecting does not go through the transition guard — it writes
     * status = ready_for_pickup straight to the row, which on a dead order
     * would resurrect it. The guard has to stop that too.
     */
    public function test_rejecting_on_a_cancelled_order_does_not_resurrect_the_order(): void
    {
        $ctx = $this->context('cancelled_by_outlet');

        $response = $this->actingAs($ctx['courier'])
            ->post("/courier/deliveries/{$ctx['delivery']->id}/reject", [
                'rejection_reason' => 'Kendala Pribadi',
            ]);

        $response->assertRedirect();
        $response->assertSessionHasErrors('status');

        $this->assertSame('cancelled_by_outlet', $ctx['order']->fresh()->status);
        $this->assertSame('waiting_pickup', $ctx['delivery']->fresh()->status);
    }

    /**
     * The page must not offer an action the order can no longer accept. The
     * rendered prop is what the courier actually looks at.
     */
    public function test_the_delivery_page_ships_the_order_status(): void
    {
        $ctx = $this->context('cancelled_by_outlet');

        $this->actingAs($ctx['courier'])
            ->get("/courier/deliveries/{$ctx['delivery']->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('courier/deliveries/show')
                ->where('delivery.order.status', 'cancelled_by_outlet'));
    }

    /**
     * A stale row that predates the fix is the state staging is actually in, so
     * the migration has to be able to clean it up.
     */
    public function test_the_backfill_migration_closes_deliveries_on_dead_orders(): void
    {
        $ctx = $this->context('cancelled_by_outlet');

        $migration = require database_path('migrations/2026_09_30_000001_release_deliveries_on_dead_orders.php');
        $migration->up();

        $this->assertSame('cancelled_and_released', $ctx['delivery']->fresh()->status);
        $this->assertDatabaseHas('delivery_status_histories', [
            'delivery_id' => $ctx['delivery']->id,
            'to_status' => 'cancelled_and_released',
            'changed_by_type' => 'system',
        ]);
    }

    /**
     * The backfill has to leave live orders alone, or it would release every
     * delivery in the system.
     */
    public function test_the_backfill_migration_leaves_live_orders_alone(): void
    {
        $ctx = $this->context('ready_for_pickup');

        $migration = require database_path('migrations/2026_09_30_000001_release_deliveries_on_dead_orders.php');
        $migration->up();

        $this->assertSame('waiting_pickup', $ctx['delivery']->fresh()->status);
    }
}
