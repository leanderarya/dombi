<?php

namespace Tests\Feature;

use App\Models\CourierProfile;
use App\Models\Customer;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use App\Services\DeliveryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Returning a delivery to the outlet is a single event.
 *
 * returnToOutlet only changes return_status, so the row stays "failed" and the
 * service's status guard still passes on a second call. Each repeat re-fires
 * notifyReturnedToOutlet and notifyReturnedDeliveryPending, so a double-tap
 * spams the outlet.
 */
class DeliveryReturnOnceTest extends TestCase
{
    use RefreshDatabase;

    private function failedDelivery(): array
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

        $order = Order::create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'ORD-'.strtoupper(substr(uniqid(), -6)),
            'status' => 'failed_delivery',
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

        $delivery = Delivery::create([
            'order_id' => $order->id,
            'courier_id' => $courier->id,
            'status' => 'failed',
            'assigned_at' => now(),
        ]);

        return compact('courier', 'order', 'delivery', 'outlet');
    }

    /** The first return works and leaves return_status behind as the marker. */
    public function test_the_first_return_sets_the_return_status(): void
    {
        $ctx = $this->failedDelivery();

        app(DeliveryService::class)->returnToOutlet($ctx['delivery'], $ctx['courier'], 'Outlet tutup');

        $fresh = $ctx['delivery']->fresh();
        $this->assertSame('returning_to_outlet', $fresh->return_status);
        $this->assertSame('failed', $fresh->status);
    }

    /** A second return is refused rather than re-notifying the outlet. */
    public function test_a_second_return_is_refused(): void
    {
        $ctx = $this->failedDelivery();

        app(DeliveryService::class)->returnToOutlet($ctx['delivery'], $ctx['courier']);

        $this->expectException(ValidationException::class);
        app(DeliveryService::class)->returnToOutlet($ctx['delivery']->fresh(), $ctx['courier']);
    }

    /** The HTTP path the courier actually taps — repeat leaves the row alone. */
    public function test_posting_the_return_twice_does_not_re_notify_the_outlet(): void
    {
        $ctx = $this->failedDelivery();

        $first = $this->actingAs($ctx['courier'])
            ->post("/courier/deliveries/{$ctx['delivery']->id}/return-to-outlet");
        $first->assertRedirect();

        $second = $this->actingAs($ctx['courier'])
            ->post("/courier/deliveries/{$ctx['delivery']->id}/return-to-outlet");

        $second->assertRedirect();
        $second->assertSessionHasErrors('status');

        $this->assertSame('returning_to_outlet', $ctx['delivery']->fresh()->return_status);
    }

    /** The page ships the marker so the button can be withheld. */
    public function test_the_delivery_page_ships_the_return_status(): void
    {
        $ctx = $this->failedDelivery();
        app(DeliveryService::class)->returnToOutlet($ctx['delivery'], $ctx['courier']);

        $this->actingAs($ctx['courier'])
            ->get("/courier/deliveries/{$ctx['delivery']->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('courier/deliveries/show')
                ->where('delivery.return_status', 'returning_to_outlet'));
    }
}
