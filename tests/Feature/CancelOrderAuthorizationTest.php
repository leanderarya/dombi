<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CancelOrderAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    private function createCustomerUser(): User
    {
        $user = User::forceCreate([
            'name' => 'Customer',
            'email' => 'customer@example.com',
            'password' => bcrypt('password'),
            'role' => 'customer',
            'phone' => '08123456789',
            'is_active' => true,
        ]);

        Customer::forceCreate([
            'name' => $user->name,
            'phone' => $user->phone,
            'email' => $user->email,
            'user_id' => $user->id,
            'is_registered' => true,
        ]);

        return $user;
    }

    private function createOwnerUser(): User
    {
        return User::forceCreate([
            'name' => 'Owner',
            'email' => 'owner@example.com',
            'password' => bcrypt('password'),
            'role' => 'owner',
            'phone' => '08111111111',
            'is_active' => true,
        ]);
    }

    private function createOutlet(): Outlet
    {
        return Outlet::forceCreate([
            'name' => 'Test Outlet',
            'kelurahan' => 'Test Kelurahan',
            'kecamatan' => 'Test Kecamatan',
            'address' => 'Test Address',
            'status' => 'active',
        ]);
    }

    private function createOrderForCustomer(Customer $customer, Outlet $outlet): Order
    {
        return Order::forceCreate([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'ORD-'.uniqid(),
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'subtotal' => 10000,
            'delivery_fee' => 5000,
            'total' => 15000,
            'payment_method' => 'cash',
            'customer_name' => $customer->name,
            'customer_phone' => $customer->phone,
            'customer_address' => '123 Test Street',
        ]);
    }

    public function test_customer_can_cancel_own_order(): void
    {
        $user = $this->createCustomerUser();
        $outlet = $this->createOutlet();
        $order = $this->createOrderForCustomer($user->customer, $outlet);

        $response = $this->actingAs($user)->postJson("/customer/orders/{$order->id}/cancel", [
            'reason' => 'Tidak Jadi Membeli',
        ]);

        $response->assertRedirect();
    }

    public function test_customer_cannot_cancel_other_customer_order(): void
    {
        $user = $this->createCustomerUser();
        $outlet = $this->createOutlet();

        $otherUser = User::forceCreate([
            'name' => 'Other Customer',
            'email' => 'other@example.com',
            'password' => bcrypt('password'),
            'role' => 'customer',
            'phone' => '08999999999',
            'is_active' => true,
        ]);

        $otherCustomer = Customer::forceCreate([
            'name' => $otherUser->name,
            'phone' => $otherUser->phone,
            'email' => $otherUser->email,
            'user_id' => $otherUser->id,
            'is_registered' => true,
        ]);

        $otherOrder = $this->createOrderForCustomer($otherCustomer, $outlet);

        $response = $this->actingAs($user)->postJson("/customer/orders/{$otherOrder->id}/cancel", [
            'reason' => 'Tidak Jadi Membeli',
        ]);

        $response->assertForbidden();
    }

    public function test_owner_can_cancel_any_order(): void
    {
        $owner = $this->createOwnerUser();
        $outlet = $this->createOutlet();

        $customer = User::forceCreate([
            'name' => 'Customer',
            'email' => 'customer2@example.com',
            'password' => bcrypt('password'),
            'role' => 'customer',
            'phone' => '08222222222',
            'is_active' => true,
        ]);

        $customerProfile = Customer::forceCreate([
            'name' => $customer->name,
            'phone' => $customer->phone,
            'email' => $customer->email,
            'user_id' => $customer->id,
            'is_registered' => true,
        ]);

        $order = $this->createOrderForCustomer($customerProfile, $outlet);

        $response = $this->actingAs($owner)->postJson("/customer/orders/{$order->id}/cancel", [
            'reason' => 'Tidak Jadi Membeli',
        ]);

        $response->assertRedirect();
    }

    public function test_unauthenticated_user_cannot_cancel_order(): void
    {
        $outlet = $this->createOutlet();

        $customer = User::forceCreate([
            'name' => 'Customer',
            'email' => 'customer3@example.com',
            'password' => bcrypt('password'),
            'role' => 'customer',
            'phone' => '08333333333',
            'is_active' => true,
        ]);

        $customerProfile = Customer::forceCreate([
            'name' => $customer->name,
            'phone' => $customer->phone,
            'email' => $customer->email,
            'user_id' => $customer->id,
            'is_registered' => true,
        ]);

        $order = $this->createOrderForCustomer($customerProfile, $outlet);

        $response = $this->postJson("/customer/orders/{$order->id}/cancel", [
            'reason' => 'Tidak Jadi Membeli',
        ]);

        $response->assertUnauthorized();
    }
}
