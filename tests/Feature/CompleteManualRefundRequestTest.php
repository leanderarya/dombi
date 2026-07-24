<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class CompleteManualRefundRequestTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_complete_manual_refund_with_proof(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create(['payment_status' => 'refund_in_progress']);
        $proof = UploadedFile::fake()->image('transfer.jpg');

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/complete", [
                'proof' => $proof,
                'reference' => 'TRF-001',
                'note' => 'Transfer via BCA ke rekening customer',
            ])->assertRedirect();

        $this->assertSame('refunded', $order->fresh()->payment_status);
        $this->assertNotNull($order->fresh()->refund_proof_image);
    }

    public function test_non_owner_cannot_complete_manual_refund(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $order = Order::factory()->create(['payment_status' => 'refund_in_progress']);

        $this->actingAs($user)
            ->post("/owner/refunds/{$order->id}/complete", [
                'proof' => UploadedFile::fake()->image('transfer.jpg'),
            ])->assertRedirect();
    }

    public function test_proof_is_required(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create(['payment_status' => 'refund_in_progress']);

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/complete", [])
            ->assertSessionHasErrors('proof');
    }

    public function test_proof_must_be_an_image(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create(['payment_status' => 'refund_in_progress']);

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/complete", [
                'proof' => UploadedFile::fake()->create('doc.pdf', 100),
            ])->assertSessionHasErrors('proof');
    }

    public function test_proof_max_2048kb(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create(['payment_status' => 'refund_in_progress']);

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/complete", [
                'proof' => UploadedFile::fake()->image('large.jpg')->size(3000),
            ])->assertSessionHasErrors('proof');
    }

    public function test_reference_is_optional(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create(['payment_status' => 'refund_in_progress']);

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/complete", [
                'proof' => UploadedFile::fake()->image('transfer.jpg'),
            ])->assertRedirect();
    }

    public function test_reference_max_255_chars(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create(['payment_status' => 'refund_in_progress']);

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/complete", [
                'proof' => UploadedFile::fake()->image('transfer.jpg'),
                'reference' => str_repeat('a', 256),
            ])->assertSessionHasErrors('reference');
    }

    public function test_note_is_optional(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create(['payment_status' => 'refund_in_progress']);

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/complete", [
                'proof' => UploadedFile::fake()->image('transfer.jpg'),
            ])->assertRedirect();
    }

    public function test_note_max_500_chars(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create(['payment_status' => 'refund_in_progress']);

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/complete", [
                'proof' => UploadedFile::fake()->image('transfer.jpg'),
                'note' => str_repeat('a', 501),
            ])->assertSessionHasErrors('note');
    }
}
