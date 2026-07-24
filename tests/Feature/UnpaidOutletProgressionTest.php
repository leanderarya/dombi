<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use App\Models\Outlet as OutletModel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UnpaidOutletProgressionTest extends TestCase
{
    use RefreshDatabase;

    public function test_paid_order_allows_outlet_progression(): void
    {
        $outlet = OutletModel::factory()->create();
        $user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id]);
        $order = Order::factory()->create([
            'outlet_id' => $outlet->id,
            'payment_status' => 'paid',
            'status' => 'confirmed',
        ]);

        $response = $this->actingAs($user)->post("/outlet/orders/{$order->id}/status", [
            'status' => 'preparing',
        ]);

        $response->assertSessionHas('success');
    }

    public function test_pending_payment_blocked(): void
    {
        $outlet = OutletModel::factory()->create();
        $user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id]);
        $order = Order::factory()->create([
            'outlet_id' => $outlet->id,
            'payment_status' => 'pending',
            'status' => 'confirmed',
        ]);

        $response = $this->actingAs($user)->post("/outlet/orders/{$order->id}/status", [
            'status' => 'preparing',
        ]);

        $response->assertSessionHasErrors('payment_status');
    }
}
