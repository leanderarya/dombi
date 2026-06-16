<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OwnershipBypassTest extends TestCase
{
    use RefreshDatabase;

    private function createCustomerUser(string $email = 'customer@example.com', string $phone = '08123456789'): User
    {
        $user = User::forceCreate([
            'name' => 'Customer',
            'email' => $email,
            'password' => bcrypt('password'),
            'role' => 'customer',
            'phone' => $phone,
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
            'order_code' => 'ORD-' . uniqid(),
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

    private function createAddressForCustomer(Customer $customer): CustomerAddress
    {
        return CustomerAddress::forceCreate([
            'customer_id' => $customer->id,
            'label' => 'Rumah',
            'recipient_name' => 'Budi',
            'phone' => '08123456789',
            'address' => 'Jl. Sudirman No. 1',
            'is_default' => true,
        ]);
    }

    // === Order Show Tests ===

    public function test_customer_can_view_own_order(): void
    {
        $user = $this->createCustomerUser();
        $outlet = $this->createOutlet();
        $order = $this->createOrderForCustomer($user->customer, $outlet);

        $response = $this->actingAs($user)->get("/customer/orders/{$order->id}");

        $response->assertOk();
    }

    public function test_customer_cannot_view_other_customer_order(): void
    {
        $user = $this->createCustomerUser();
        $otherUser = $this->createCustomerUser('other@example.com', '08999999999');
        $outlet = $this->createOutlet();
        $order = $this->createOrderForCustomer($otherUser->customer, $outlet);

        $response = $this->actingAs($user)->get("/customer/orders/{$order->id}");

        $response->assertForbidden();
    }

    public function test_unauthenticated_user_cannot_view_order(): void
    {
        $user = $this->createCustomerUser();
        $outlet = $this->createOutlet();
        $order = $this->createOrderForCustomer($user->customer, $outlet);

        $response = $this->get("/customer/orders/{$order->id}");

        $response->assertRedirect('/login');
    }

    // === Order Repeat Tests ===

    public function test_customer_can_repeat_own_order(): void
    {
        $user = $this->createCustomerUser();
        $outlet = $this->createOutlet();
        $order = $this->createOrderForCustomer($user->customer, $outlet);

        $response = $this->actingAs($user)->post("/customer/orders/{$order->id}/repeat");

        $response->assertRedirect();
    }

    public function test_customer_cannot_repeat_other_customer_order(): void
    {
        $user = $this->createCustomerUser();
        $otherUser = $this->createCustomerUser('other@example.com', '08999999999');
        $outlet = $this->createOutlet();
        $order = $this->createOrderForCustomer($otherUser->customer, $outlet);

        $response = $this->actingAs($user)->post("/customer/orders/{$order->id}/repeat");

        $response->assertForbidden();
    }

    // === Address Edit Tests ===

    public function test_customer_can_edit_own_address(): void
    {
        $user = $this->createCustomerUser();
        $address = $this->createAddressForCustomer($user->customer);

        $response = $this->actingAs($user)->get("/customer/addresses/{$address->id}/edit");

        $response->assertOk();
    }

    public function test_customer_cannot_edit_other_customer_address(): void
    {
        $user = $this->createCustomerUser();
        $otherUser = $this->createCustomerUser('other@example.com', '08999999999');
        $address = $this->createAddressForCustomer($otherUser->customer);

        $response = $this->actingAs($user)->get("/customer/addresses/{$address->id}/edit");

        $response->assertForbidden();
    }

    // === Address Update Tests ===

    public function test_customer_can_update_own_address(): void
    {
        $user = $this->createCustomerUser();
        $address = $this->createAddressForCustomer($user->customer);

        $response = $this->actingAs($user)->putJson("/customer/addresses/{$address->id}", [
            'label' => 'Kantor',
            'recipient_name' => 'Budi Updated',
            'phone' => '08123456789',
            'address' => 'Jl. Thamrin No. 2',
            'latitude' => -6.2088,
            'longitude' => 106.8456,
        ]);

        $response->assertRedirect();
    }

    public function test_customer_cannot_update_other_customer_address(): void
    {
        $user = $this->createCustomerUser();
        $otherUser = $this->createCustomerUser('other@example.com', '08999999999');
        $address = $this->createAddressForCustomer($otherUser->customer);

        $response = $this->actingAs($user)->putJson("/customer/addresses/{$address->id}", [
            'label' => 'Kantor',
            'recipient_name' => 'Budi Updated',
            'phone' => '08123456789',
            'address' => 'Jl. Thamrin No. 2',
            'latitude' => -6.2088,
            'longitude' => 106.8456,
        ]);

        $response->assertForbidden();
    }

    // === Address Destroy Tests ===

    public function test_customer_can_delete_own_address(): void
    {
        $user = $this->createCustomerUser();
        $address = $this->createAddressForCustomer($user->customer);

        $response = $this->actingAs($user)->delete("/customer/addresses/{$address->id}");

        $response->assertRedirect();
        $this->assertDatabaseMissing('customer_addresses', ['id' => $address->id]);
    }

    public function test_customer_cannot_delete_other_customer_address(): void
    {
        $user = $this->createCustomerUser();
        $otherUser = $this->createCustomerUser('other@example.com', '08999999999');
        $address = $this->createAddressForCustomer($otherUser->customer);

        $response = $this->actingAs($user)->delete("/customer/addresses/{$address->id}");

        $response->assertForbidden();
        $this->assertDatabaseHas('customer_addresses', ['id' => $address->id]);
    }

    // === Address Set Default Tests ===

    public function test_customer_can_set_own_address_as_default(): void
    {
        $user = $this->createCustomerUser();
        $address = $this->createAddressForCustomer($user->customer);

        // Create a second address to set as default
        $address2 = CustomerAddress::forceCreate([
            'customer_id' => $user->customer->id,
            'label' => 'Kantor',
            'recipient_name' => 'Budi',
            'phone' => '08123456789',
            'address' => 'Jl. Thamrin No. 2',
            'is_default' => false,
        ]);

        $response = $this->actingAs($user)->post("/customer/addresses/{$address2->id}/set-default");

        $response->assertRedirect();
        $address2->refresh();
        $this->assertTrue($address2->is_default);
    }

    public function test_customer_cannot_set_other_customer_address_as_default(): void
    {
        $user = $this->createCustomerUser();
        $otherUser = $this->createCustomerUser('other@example.com', '08999999999');
        $address = $this->createAddressForCustomer($otherUser->customer);

        $response = $this->actingAs($user)->post("/customer/addresses/{$address->id}/set-default");

        $response->assertForbidden();
    }
}
