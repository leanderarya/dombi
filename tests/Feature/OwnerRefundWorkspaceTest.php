<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OwnerRefundWorkspaceTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private Customer $guest;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create(['role' => 'owner']);
        $this->guest = Customer::factory()->create(['user_id' => null]);
    }

    public function test_finance_tab_refund_loads(): void
    {
        $response = $this->actingAs($this->owner)->get('/owner/finance?tab=refund');
        $response->assertOk();
    }

    public function test_awaiting_guest_queue(): void
    {
        Order::factory()->create([
            'customer_id' => $this->guest->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'missing',
            'refund_amount' => 50000,
            'refund_requested_at' => now(),
        ]);

        $response = $this->actingAs($this->owner)->get('/owner/finance?tab=refund&filter=awaiting_guest');
        $response->assertOk();
    }

    public function test_ready_queue(): void
    {
        $customer = Customer::factory()->create(['user_id' => User::factory()->create(['role' => 'customer'])->id]);
        Order::factory()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'valid',
            'refund_amount' => 50000,
            'refund_requested_at' => now(),
        ]);

        $response = $this->actingAs($this->owner)->get('/owner/finance?tab=refund&filter=ready');
        $response->assertOk();
    }

    public function test_refund_failed_is_action_required(): void
    {
        $customer = Customer::factory()->create(['user_id' => User::factory()->create(['role' => 'customer'])->id]);
        Order::factory()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_failed',
            'refund_amount' => 50000,
        ]);

        $response = $this->actingAs($this->owner)->get('/owner/finance?tab=refund&filter=action_required');
        $response->assertOk();
    }
}
