<?php

namespace Tests\Feature;

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

    public function test_owner_marks_refund_pending_order_refunded_with_proof(): void
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

        $o = Order::find($order->id);
        $this->assertSame('refunded', $o->payment_status);
        $this->assertEquals($owner->id, $o->refunded_by);
        $this->assertNotNull($o->refund_proof_image);
        Storage::disk('public')->assertExists($o->refund_proof_image);
    }

    public function test_owner_reject_sets_refund_rejected(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create(['payment_status' => 'refund_pending']);

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/reject", ['reason' => 'Bukan salah kami'])
            ->assertRedirect();

        $this->assertSame('refund_rejected', Order::find($order->id)->payment_status);
    }

    public function test_cannot_refund_non_refund_pending_order(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create(['payment_status' => 'paid']);

        $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/mark-refunded", [
                'refund_amount' => 1,
                'refund_reason' => 'x',
                'proof' => UploadedFile::fake()->image('bukti.jpg'),
            ])->assertSessionHas('error');

        $this->assertSame('paid', Order::find($order->id)->payment_status);
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
