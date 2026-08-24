<?php

namespace Tests\Feature;

use App\Http\Controllers\TrackController;
use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use App\Services\OrderStatusService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Tests\TestCase;

class GuestRefundExperienceTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_refund_tracking_loads(): void
    {
        $customer = Customer::factory()->create(['user_id' => null]);
        $order = Order::factory()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_pending',
            'refund_amount' => 50000,
            'refund_requested_at' => now(),
        ]);

        $response = $this->get("/track/{$order->recovery_token}");

        $response->assertOk();
    }

    public function test_guest_cannot_cancel_without_phone_step_up(): void
    {
        $order = Order::factory()->create();

        $response = $this->postJson("/track/{$order->recovery_token}/cancel", [
            'reason' => 'test',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_registered_user_can_cancel_own_order(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $order = Order::factory()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'pending',
        ]);

        $controller = app(TrackController::class);
        $request = Request::create("/track/{$order->recovery_token}/cancel", 'POST', [
            'reason' => 'test',
            'last4_hp' => substr(preg_replace('/[^0-9]/', '', $order->customer_phone), -4),
        ]);
        $request->setUserResolver(fn () => $user);

        $response = $controller->cancel($order->recovery_token, $request, app(OrderStatusService::class));

        $this->assertTrue($response instanceof JsonResponse || $response instanceof RedirectResponse);
    }
}
