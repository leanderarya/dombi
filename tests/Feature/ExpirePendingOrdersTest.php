<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Outlet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class ExpirePendingOrdersTest extends TestCase
{
    use RefreshDatabase;

    public function test_pending_confirmation_defaults_to_thirty_minutes(): void
    {
        Carbon::setTestNow('2026-08-28 12:00:00');

        $order = Order::factory()->create(['status' => Order::STATUS_PENDING_CONFIRMATION]);

        $this->assertSame('2026-08-28T12:30:00+00:00', $order->confirmation_expires_at->toIso8601String());
    }

    public function test_outlet_confirmation_timeout_overrides_default(): void
    {
        Carbon::setTestNow('2026-08-28 12:00:00');
        $outlet = Outlet::factory()->create(['confirmation_timeout_minutes' => 45]);

        $order = Order::factory()->create([
            'outlet_id' => $outlet->id,
            'status' => Order::STATUS_PENDING_CONFIRMATION,
        ]);

        $this->assertSame('2026-08-28T12:45:00+00:00', $order->confirmation_expires_at->toIso8601String());
    }

    public function test_scheduler_expires_only_after_confirmation_deadline(): void
    {
        Carbon::setTestNow('2026-08-28 12:00:00');
        $future = Order::factory()->create([
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'confirmation_expires_at' => now()->addSecond(),
        ]);
        $past = Order::factory()->create([
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'confirmation_expires_at' => now()->subSecond(),
        ]);

        $this->artisan('orders:expire-pending')->assertSuccessful();

        $this->assertSame(Order::STATUS_PENDING_CONFIRMATION, $future->fresh()->status);
        $expired = $past->fresh();
        $this->assertSame(Order::STATUS_EXPIRED, $expired->status);
        $this->assertNotNull($expired->expired_at);
        $this->assertSame('Confirmation timeout', $expired->expired_reason);
        $this->assertDatabaseHas('order_status_histories', [
            'order_id' => $past->id,
            'from_status' => Order::STATUS_PENDING_CONFIRMATION,
            'to_status' => Order::STATUS_EXPIRED,
            'reason' => 'Confirmation timeout',
        ]);
    }

    public function test_failed_payment_expires_after_retry_window_and_not_before_confirmation_window(): void
    {
        Carbon::setTestNow('2026-08-28 12:00:00');
        $order = Order::factory()->create([
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'payment_status' => 'failed',
            'confirmation_expires_at' => now()->addMinutes(15),
        ]);

        $this->artisan('orders:expire-pending')->assertSuccessful();
        $this->assertSame(Order::STATUS_PENDING_CONFIRMATION, $order->fresh()->status);

        Carbon::setTestNow('2026-08-28 12:16:00');
        $this->artisan('orders:expire-pending')->assertSuccessful();

        $expired = $order->fresh();
        $this->assertSame(Order::STATUS_EXPIRED, $expired->status);
        $this->assertSame('Payment failed (grace period expired)', $expired->expired_reason);
        $this->assertNotNull($expired->expired_at);
    }
}
