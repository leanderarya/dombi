<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use App\Models\Customer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RollbackRefundRequestTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private Order $order;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create(['role' => 'owner']);
        $customer = Customer::factory()->create(['user_id' => User::factory()->create(['role' => 'customer'])->id]);
        $this->order = Order::factory()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_in_progress',
            'refund_amount' => 50000,
            'refund_requested_at' => now(),
            'refund_started_at' => now(),
        ]);
    }

    public function test_owner_authorized(): void
    {
        $response = $this->actingAs($this->owner)->post("/owner/refunds/{$this->order->id}/rollback", [
            'mode' => 'retry',
            'reason' => 'Test rollback',
        ]);

        $response->assertSessionHas('success');
    }

    public function test_customer_denied(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);

        $response = $this->actingAs($customer)->post("/owner/refunds/{$this->order->id}/rollback", [
            'mode' => 'retry',
            'reason' => 'Test rollback',
        ]);

        $response->assertRedirect();
    }

    public function test_mode_required_as_retry_or_fix_destination(): void
    {
        $response = $this->actingAs($this->owner)->post("/owner/refunds/{$this->order->id}/rollback", [
            'mode' => 'invalid',
            'reason' => 'test',
        ]);

        $response->assertSessionHasErrors(['mode']);
    }

    public function test_reason_required(): void
    {
        $response = $this->actingAs($this->owner)->post("/owner/refunds/{$this->order->id}/rollback", [
            'mode' => 'retry',
            'reason' => '',
        ]);

        $response->assertSessionHasErrors(['reason']);
    }
}
