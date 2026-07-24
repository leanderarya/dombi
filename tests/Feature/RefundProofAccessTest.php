<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class RefundProofAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_stream_private_proof(): void
    {
        Storage::fake('local');
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create(['payment_status' => 'refunded']);
        $order->update(['refund_proof_image' => 'private:refund-proofs/'.$order->id.'/proof.jpg']);
        Storage::disk('local')->put('refund-proofs/'.$order->id.'/proof.jpg', 'fake-image-content');

        $response = $this->actingAs($owner)->get("/refunds/{$order->id}/proof");

        $response->assertOk();
        $response->assertHeader('Content-Disposition', 'inline; filename="refund-'.$order->order_code.'.jpg"');
    }

    public function test_owner_can_stream_legacy_public_proof(): void
    {
        Storage::fake('public');
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create(['payment_status' => 'refunded']);
        $order->update(['refund_proof_image' => 'refunds/proof.jpg']);
        Storage::disk('public')->put('refunds/proof.jpg', 'fake-image-content');

        $response = $this->actingAs($owner)->get("/refunds/{$order->id}/proof");

        $response->assertOk();
    }

    public function test_customer_can_stream_own_proof(): void
    {
        Storage::fake('local');
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $order = Order::factory()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refunded',
        ]);
        $order->update(['refund_proof_image' => 'private:refund-proofs/'.$order->id.'/proof.jpg']);
        Storage::disk('local')->put('refund-proofs/'.$order->id.'/proof.jpg', 'fake-image-content');

        $response = $this->actingAs($user)->get("/refunds/{$order->id}/proof");

        $response->assertOk();
    }

    public function test_other_customer_gets_403(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        Customer::factory()->create(['user_id' => $user->id]);
        $other = Order::factory()->create(['payment_status' => 'refunded']);

        $response = $this->actingAs($user)->get("/refunds/{$other->id}/proof");

        $response->assertStatus(403);
    }

    public function test_guest_gets_403(): void
    {
        $customer = Customer::factory()->create(['user_id' => null]);
        $order = Order::factory()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refunded',
        ]);

        $response = $this->actingAs(User::factory()->create(['role' => 'customer']))->get("/refunds/{$order->id}/proof");

        $response->assertStatus(403);
    }

    public function test_missing_proof_returns_404(): void
    {
        Storage::fake('local');
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create(['payment_status' => 'refunded']);
        $order->update(['refund_proof_image' => 'private:refund-proofs/'.$order->id.'/nonexistent.jpg']);

        $response = $this->actingAs($owner)->get("/refunds/{$order->id}/proof");

        $response->assertStatus(404);
    }

    public function test_query_path_parameter_ignored(): void
    {
        Storage::fake('local');
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create(['payment_status' => 'refunded']);
        $order->update(['refund_proof_image' => 'private:refund-proofs/'.$order->id.'/proof.jpg']);
        Storage::disk('local')->put('refund-proofs/'.$order->id.'/proof.jpg', 'authorized-content');

        $response = $this->actingAs($owner)->get("/refunds/{$order->id}/proof?path=unauthorized/path.jpg");

        $response->assertOk();
    }

    public function test_not_refunded_returns_404(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create(['payment_status' => 'paid']);

        $response = $this->actingAs($owner)->get("/refunds/{$order->id}/proof");

        $response->assertStatus(404);
    }
}
