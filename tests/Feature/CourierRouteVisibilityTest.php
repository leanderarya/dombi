<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * "Optimasi Rute" is gated on whether the courier holds any active delivery.
 *
 * The client used to answer that from the page slice it was handed
 * (`deliveries.data.some(...)`) while the query is latest()->paginate(20): an
 * active delivery past the first page, or filtered out by the status chip,
 * hid the button even though the route endpoint would have returned it.
 */
class CourierRouteVisibilityTest extends TestCase
{
    use RefreshDatabase;

    private User $courier;

    private Outlet $outlet;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->courier = User::factory()->create([
            'role' => 'courier',
            'is_active' => true,
            'is_online' => true,
        ]);

        $owner = User::factory()->create(['role' => 'owner']);
        $this->outlet = Outlet::create([
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

        $this->customer = Customer::create([
            'name' => 'Test Customer',
            'phone' => '6281234567890'.rand(1000, 9999),
        ]);
    }

    private function deliveryWith(string $deliveryStatus, string $orderStatus): Delivery
    {
        $order = Order::create([
            'customer_id' => $this->customer->id,
            'outlet_id' => $this->outlet->id,
            'order_code' => 'ORD-'.strtoupper(substr(uniqid(), -8)),
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
        ]);

        return Delivery::create([
            'order_id' => $order->id,
            'courier_id' => $this->courier->id,
            'status' => $deliveryStatus,
            'assigned_at' => now(),
        ]);
    }

    /** The flag is counted over every delivery, not the twenty on screen. */
    public function test_an_active_delivery_off_the_page_still_flags_the_route_button(): void
    {
        $this->deliveryWith('waiting_pickup', 'ready_for_pickup');

        // Push it off page one: 20 later rows, newest first, so the active
        // delivery is the 21st and absent from the payload.
        foreach (range(1, 20) as $i) {
            $this->deliveryWith('completed', 'completed');
        }

        $response = $this->actingAs($this->courier)->get('/courier/deliveries');

        $response->assertOk()->assertInertia(fn ($page) => $page
            ->component('courier/deliveries/index')
            ->where('hasActiveDeliveries', true)
            ->has('deliveries.data', 20));
    }

    /** A status filter narrows the slice, not the question the flag answers. */
    public function test_a_status_filter_does_not_hide_the_active_delivery(): void
    {
        $this->deliveryWith('waiting_pickup', 'ready_for_pickup');
        $this->deliveryWith('completed', 'completed');

        $response = $this->actingAs($this->courier)
            ->get('/courier/deliveries?status=completed');

        $response->assertOk()->assertInertia(fn ($page) => $page
            ->where('hasActiveDeliveries', true)
            ->has('deliveries.data', 1));
    }

    /** Nothing open means there is no route to optimise. */
    public function test_finished_deliveries_leave_the_flag_false(): void
    {
        foreach (['completed', 'failed', 'cancelled_and_released'] as $status) {
            $this->deliveryWith($status, 'completed');
        }

        $response = $this->actingAs($this->courier)->get('/courier/deliveries');

        $response->assertOk()->assertInertia(fn ($page) => $page
            ->where('hasActiveDeliveries', false));
    }
}
