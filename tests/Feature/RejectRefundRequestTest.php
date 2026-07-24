<?php

namespace Tests\Feature;

use App\Enums\RefundRejectionReason;
use App\Models\Order;
use App\Models\User;
use App\Models\Customer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RejectRefundRequestTest extends TestCase
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
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'valid',
            'refund_amount' => 50000,
            'refund_requested_at' => now(),
        ]);
    }

    public function test_owner_authorized(): void
    {
        $response = $this->actingAs($this->owner)->post("/owner/refunds/{$this->order->id}/reject", [
            'reason' => 'invalid_destination',
        ]);

        $response->assertSessionHas('success');
    }

    public function test_non_owner_denied(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);

        $response = $this->actingAs($customer)->post("/owner/refunds/{$this->order->id}/reject", [
            'reason' => 'invalid_destination',
        ]);

        $response->assertRedirect();
    }

    public function test_other_reason_without_note_fails(): void
    {
        $response = $this->actingAs($this->owner)->post("/owner/refunds/{$this->order->id}/reject", [
            'reason' => 'other',
            'note' => '',
        ]);

        $response->assertSessionHasErrors('note');
    }
}
