<?php

namespace Tests\Feature;

use App\Http\Controllers\Customer\GuestOrderController;
use App\Models\Order;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Tests\TestCase;

class GuestCancellationRouteTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_orders_cancel_page_route_absent(): void
    {
        $this->assertFalse(\Route::has('guest.orders.cancel-page'));
        $this->assertFalse(\Route::has('guest.orders.cancel'));
    }

    public function test_old_guest_cancel_get_returns_404(): void
    {
        $order = Order::factory()->create();
        $response = $this->get("/guest/orders/{$order->id}/cancel/some-token");
        $response->assertStatus(404);
    }

    public function test_old_guest_cancel_post_returns_404(): void
    {
        $order = Order::factory()->create();
        $response = $this->post("/guest/orders/{$order->id}/cancel/some-token", [
            'reason' => 'test',
        ]);
        $response->assertStatus(404);
    }

    public function test_customer_cancel_route_remains(): void
    {
        $this->assertTrue(\Route::has('customer.orders.cancel'));
    }

    public function test_guest_cancel_action_returns_403(): void
    {
        try {
            $controller = new GuestOrderController;
            $controller->cancel();
            $this->fail('Expected exception not thrown');
        } catch (HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());
        }
    }

    public function test_guest_show_cancel_page_action_returns_404(): void
    {
        try {
            $controller = new GuestOrderController;
            $controller->showCancelPage();
            $this->fail('Expected exception not thrown');
        } catch (NotFoundHttpException $e) {
            $this->assertSame(404, $e->getStatusCode());
        }
    }
}
