<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RefundNotificationNavigationTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_notification_returns_200(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);

        Notification::create([
            'id' => 99991,
            'user_type' => 'customer',
            'customer_id' => $customer->id,
            'user_id' => $user->id,
            'type' => 'order.refund_processed',
            'title' => 'Refund Selesai',
            'message' => 'Refund telah diproses.',
            'data' => ['url' => '/customer/orders/1'],
            'entity_type' => 'order',
            'entity_id' => 1,
        ]);

        $response = $this->actingAs($user)->get('/notifications');

        $response->assertOk();
    }

    public function test_other_customer_notification_not_returned(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);

        Notification::create([
            'id' => 99992,
            'user_type' => 'customer',
            'customer_id' => 99999,
            'type' => 'order.refund_processed',
            'title' => 'Refund Selesai',
            'message' => 'Refund telah diproses.',
            'data' => ['url' => '/customer/orders/1'],
            'entity_type' => 'order',
            'entity_id' => 1,
        ]);

        $response = $this->actingAs($user)->get('/notifications');

        $this->assertCount(0, $response->json('notifications'));
    }
}
