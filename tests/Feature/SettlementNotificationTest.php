<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\SettlementPayment;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettlementNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_payment_submitted_notifies_owner(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $outlet = Outlet::factory()->create();
        $user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id]);

        $payment = SettlementPayment::factory()->create([
            'outlet_id' => $outlet->id,
            'amount' => 100000,
            'reference_number' => 'TEST-001',
        ]);
        $payment->load('outlet');

        $service = app(NotificationService::class);
        $service->notifyPaymentSubmitted($payment);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $owner->id,
            'type' => 'payment.submitted',
        ]);
    }

    public function test_payment_verified_notifies_outlet(): void
    {
        $outlet = Outlet::factory()->create();
        $user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id]);

        $payment = SettlementPayment::factory()->create([
            'outlet_id' => $outlet->id,
            'amount' => 100000,
            'reference_number' => 'TEST-002',
        ]);
        $payment->load('outlet');

        $service = app(NotificationService::class);
        $service->notifyPaymentVerified($payment);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $user->id,
            'type' => 'payment.verified',
        ]);
    }

    public function test_payment_rejected_notifies_outlet_with_reason(): void
    {
        $outlet = Outlet::factory()->create();
        $user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id]);

        $payment = SettlementPayment::factory()->create([
            'outlet_id' => $outlet->id,
            'amount' => 100000,
            'reference_number' => 'TEST-003',
        ]);
        $payment->load('outlet');

        $service = app(NotificationService::class);
        $service->notifyPaymentRejected($payment, 'Bukti tidak jelas');

        $this->assertDatabaseHas('notifications', [
            'user_id' => $user->id,
            'type' => 'payment.rejected',
        ]);
    }
}
