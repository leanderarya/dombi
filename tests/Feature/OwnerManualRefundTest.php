<?php

namespace Tests\Feature;

use App\Enums\PaymentStatus;
use App\Models\Customer;
use App\Models\Order;
use App\Models\PaymentTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class OwnerManualRefundTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create(['role' => 'owner']);
    }

    public function test_redirect_invalid_filter_to_ready(): void
    {
        $response = $this->actingAs($this->owner)->get('/owner/refunds?filter=invalid');

        $response->assertRedirectContains('tab=refund');
    }

    public function test_start_action(): void
    {
        $customer = Customer::factory()->create(['user_id' => User::factory()->create(['role' => 'customer'])->id]);
        $order = Order::factory()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'valid',
            'refund_destination_type' => 'bank',
            'refund_bank_name' => 'BCA',
            'refund_account_number' => '1234567890',
            'refund_account_holder' => 'Test',
            'refund_amount' => 50000,
            'refund_requested_at' => now(),
        ]);

        $response = $this->actingAs($this->owner)->post("/owner/refunds/{$order->id}/start");

        $response->assertSessionHas('success', 'Proses refund dimulai.');
    }

    public function test_reject_action(): void
    {
        $customer = Customer::factory()->create(['user_id' => User::factory()->create(['role' => 'customer'])->id]);
        $order = Order::factory()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'valid',
            'refund_amount' => 50000,
            'refund_requested_at' => now(),
        ]);

        $response = $this->actingAs($this->owner)->post("/owner/refunds/{$order->id}/reject", [
            'reason' => 'invalid_destination',
        ]);

        $response->assertSessionHas('success');
    }

    public function test_complete_action(): void
    {
        Storage::fake('local');
        $customer = Customer::factory()->create(['user_id' => User::factory()->create(['role' => 'customer'])->id]);
        $order = Order::factory()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_in_progress',
            'refund_amount' => 50000,
            'refund_requested_at' => now(),
            'refund_started_at' => now(),
        ]);

        $file = \Illuminate\Http\UploadedFile::fake()->image('proof.jpg');

        $response = $this->actingAs($this->owner)->post("/owner/refunds/{$order->id}/complete", [
            'proof' => $file,
            'transfer_reference' => 'REF123',
            'transfer_note' => 'Test completion',
        ]);

        $response->assertSessionHas('success', 'Refund ditandai selesai.');
    }

    public function test_stale_error_on_already_refunded(): void
    {
        $customer = Customer::factory()->create(['user_id' => User::factory()->create(['role' => 'customer'])->id]);
        $order = Order::factory()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refunded',
            'refund_amount' => 50000,
        ]);

        $response = $this->actingAs($this->owner)->post("/owner/refunds/{$order->id}/start");

        $response->assertSessionHas('error');
    }
}
