<?php

namespace Tests\Feature;

use App\Enums\RefundRejectionReason;
use App\Models\Notification;
use App\Models\Order;
use App\Models\User;
use App\Services\PaymentStatusService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class OwnerManualRefundTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_starts_refund_processing(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create([
            'payment_status' => 'refund_pending',
            'total' => 100000,
            'refund_destination_type' => 'bank_transfer',
            'refund_destination_submitted_at' => now(),
        ]);

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/start")
            ->assertRedirect()
            ->assertSessionHas('success');

        $order->refresh();
        $this->assertSame('refund_in_progress', $order->payment_status);
        $this->assertNotNull($order->refund_started_at);
        $this->assertEquals($owner->id, $order->refund_started_by);
    }

    public function test_owner_cannot_start_without_destination(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create([
            'payment_status' => 'refund_pending',
            'total' => 100000,
        ]);

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/start")
            ->assertRedirect()
            ->assertSessionHas('error');
    }

    public function test_owner_cannot_start_non_pending_order(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create([
            'payment_status' => 'refund_in_progress',
            'total' => 100000,
            'refund_destination_type' => 'bank_transfer',
            'refund_destination_submitted_at' => now(),
        ]);

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/start")
            ->assertRedirect()
            ->assertSessionHas('error');
    }

    public function test_owner_rejects_refund_pending_order(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create([
            'payment_status' => 'refund_pending',
            'total' => 100000,
            'refund_destination_type' => 'bank_transfer',
            'refund_destination_submitted_at' => now(),
        ]);

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/reject", [
                'reason' => RefundRejectionReason::Other->value,
                'note' => 'Manual check needed',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $order->refresh();
        $this->assertSame('refund_rejected', $order->payment_status);
        $this->assertEquals(RefundRejectionReason::Other->value, $order->refund_rejected_reason);
        $this->assertEquals('Manual check needed', $order->refund_rejection_note);
        $this->assertNotNull($order->refund_rejected_at);
        $this->assertEquals($owner->id, $order->refund_rejected_by);
    }

    public function test_owner_cannot_reject_non_pending_order(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create([
            'payment_status' => 'refund_in_progress',
            'total' => 100000,
        ]);

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/reject", [
                'reason' => RefundRejectionReason::Other->value,
            ])
            ->assertRedirect()
            ->assertSessionHas('error');

        $this->assertSame('refund_in_progress', Order::find($order->id)->payment_status);
    }

    public function test_owner_completes_refund_with_reference_and_note(): void
    {
        Storage::fake('public');
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create([
            'payment_status' => 'refund_in_progress',
            'total' => 100000,
            'refund_started_at' => now(),
            'refund_started_by' => $owner->id,
        ]);

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/complete", [
                'proof' => UploadedFile::fake()->image('proof.jpg'),
                'transfer_reference' => 'TRX-001',
                'transfer_note' => 'Already sent via BCA',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $order->refresh();
        $this->assertSame('refunded', $order->payment_status);
        $this->assertEquals(100000.00, (float) $order->refund_amount);
        $this->assertNotNull($order->refund_proof_image);
        $this->assertEquals('TRX-001', $order->refund_transfer_reference);
        $this->assertEquals('Already sent via BCA', $order->refund_transfer_note);
        $this->assertEquals($owner->id, $order->refunded_by);
        $this->assertNotNull($order->refunded_at);
        Storage::disk('public')->assertExists($order->refund_proof_image);
    }

    public function test_owner_cannot_complete_non_in_progress_order(): void
    {
        Storage::fake('public');
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create([
            'payment_status' => 'refund_pending',
            'total' => 100000,
        ]);

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/complete", [
                'proof' => UploadedFile::fake()->image('proof.jpg'),
            ])
            ->assertRedirect()
            ->assertSessionHas('error');

        $this->assertSame('refund_pending', Order::find($order->id)->payment_status);
    }

    public function test_complete_requires_proof(): void
    {
        Storage::fake('public');
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create([
            'payment_status' => 'refund_in_progress',
            'total' => 100000,
        ]);

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/complete", [])
            ->assertRedirect()
            ->assertSessionHasErrors('proof');
    }

    public function test_complete_amount_equals_order_total(): void
    {
        Storage::fake('public');
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create([
            'payment_status' => 'refund_in_progress',
            'total' => 75000,
            'refund_started_at' => now(),
            'refund_started_by' => $owner->id,
        ]);

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/complete", [
                'proof' => UploadedFile::fake()->image('proof.jpg'),
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $order->refresh();
        $this->assertEquals(75000.00, (float) $order->refund_amount);
    }

    public function test_duplicate_complete_does_not_duplicate_notification(): void
    {
        Storage::fake('public');
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create([
            'payment_status' => 'refund_in_progress',
            'total' => 100000,
            'refund_started_at' => now(),
            'refund_started_by' => $owner->id,
        ]);

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/complete", [
                'proof' => UploadedFile::fake()->image('proof.jpg'),
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $order->refresh();
        $this->assertSame('refunded', $order->payment_status);

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/complete", [
                'proof' => UploadedFile::fake()->image('proof2.jpg'),
            ])
            ->assertRedirect()
            ->assertSessionHas('error');

        $order->refresh();
        $this->assertSame('refunded', $order->payment_status);
    }

    public function test_race_condition_handled_gracefully(): void
    {
        Storage::fake('public');
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create([
            'payment_status' => 'refund_in_progress',
            'total' => 100000,
            'refund_started_at' => now(),
            'refund_started_by' => $owner->id,
        ]);

        Order::where('id', $order->id)->update(['payment_status' => 'refunded']);
        $order->refresh();

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/complete", [
                'proof' => UploadedFile::fake()->image('proof.jpg'),
            ])
            ->assertRedirect()
            ->assertSessionHas('error');

        $this->assertSame('refunded', Order::find($order->id)->payment_status);
    }

    public function test_duplicate_complete_fires_notification_once(): void
    {
        Storage::fake('public');
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create([
            'payment_status' => 'refund_pending',
            'refund_amount' => 50000,
        ]);
        $proof = UploadedFile::fake()->image('bukti.jpg');

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/mark-refunded", [
                'refund_amount' => 50000,
                'refund_reason' => 'Sudah transfer',
                'proof' => $proof,
            ])->assertRedirect();

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/mark-refunded", [
                'refund_amount' => 50000,
                'refund_reason' => 'Sudah transfer',
                'proof' => UploadedFile::fake()->image('bukti2.jpg'),
            ])->assertSessionHas('error');

        $this->assertEquals(1, Notification::where('type', 'order.refund_processed')->count());
    }

    public function test_race_lost_request_cleans_uploaded_proof(): void
    {
        Storage::fake('public');
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create([
            'payment_status' => 'refund_pending',
            'refund_amount' => 50000,
        ]);
        $proof = UploadedFile::fake()->image('proof.jpg');

        $this->partialMock(PaymentStatusService::class, function ($mock) {
            $mock->shouldReceive('transition')->once()->andReturnFalse();
        });

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/mark-refunded", [
                'refund_amount' => 50000,
                'refund_reason' => 'Sudah transfer',
                'proof' => $proof,
            ])->assertSessionHas('error');

        $this->assertSame('refund_pending', Order::find($order->id)->payment_status);
        $this->assertCount(0, Storage::disk('public')->allFiles('refunds'));
    }
}
