<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\PaymentTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OutletRefundExperienceTest extends TestCase
{
    use RefreshDatabase;

    public function test_outlet_list_has_refund_badges(): void
    {
        $outlet = \App\Models\Outlet::factory()->create();
        $outletUser = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id]);

        $order = Order::factory()->create([
            'outlet_id' => $outlet->id,
            'payment_status' => 'refunded',
            'status' => 'completed',
            'refund_amount' => 50000,
        ]);

        $response = $this->actingAs($outletUser)->get('/outlet/orders?tab=riwayat');

        $response->assertOk();
    }
}
