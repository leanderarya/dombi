<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PhoneVerificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_show_verify_phone_page(): void
    {
        $user = User::factory()->create();
        Customer::create(['user_id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'is_registered' => true]);

        $this->actingAs($user)
            ->get('/customer/verify-phone')
            ->assertOk();
    }

    public function test_show_verify_phone_redirects_if_already_has_phone(): void
    {
        $user = User::factory()->create();
        Customer::create(['user_id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'phone' => '6281234567890', 'is_registered' => true]);

        $this->actingAs($user)
            ->get('/customer/verify-phone')
            ->assertRedirect(route('customer.home'));
    }

    public function test_verify_phone_links_phone_to_customer(): void
    {
        $user = User::factory()->create();
        Customer::create(['user_id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'is_registered' => true]);

        $this->actingAs($user)
            ->postJson('/customer/verify-phone', ['phone' => '6281234567890'])
            ->assertOk()
            ->assertJson([
                'verified' => true,
                'status' => 'created',
            ]);

        $this->assertDatabaseHas('customers', [
            'user_id' => $user->id,
            'phone' => '6281234567890',
        ]);
    }

    public function test_verify_phone_rejects_phone_linked_to_another_user(): void
    {
        $userA = User::factory()->create();
        Customer::create(['user_id' => $userA->id, 'name' => 'A', 'email' => $userA->email, 'phone' => '6281234567890', 'is_registered' => true]);

        $userB = User::factory()->create();
        Customer::create(['user_id' => $userB->id, 'name' => 'B', 'email' => $userB->email, 'is_registered' => true]);

        $this->actingAs($userB)
            ->postJson('/customer/verify-phone', ['phone' => '6281234567890'])
            ->assertStatus(422)
            ->assertJsonStructure(['error']);
    }

    public function test_verify_phone_merges_guest_orders(): void
    {
        $user = User::factory()->create();
        $registeredCustomer = Customer::create(['user_id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'is_registered' => true]);

        $guestCustomer = Customer::create(['name' => 'Guest', 'phone' => '6281234567890', 'is_registered' => false]);
        $guestOrder = Order::factory()->create(['customer_id' => $guestCustomer->id]);

        $this->actingAs($user)
            ->postJson('/customer/verify-phone', ['phone' => '6281234567890'])
            ->assertOk()
            ->assertJson(['verified' => true, 'status' => 'linked']);

        $guestOrder->refresh();
        $this->assertEquals($registeredCustomer->id, $guestOrder->customer_id);
        $this->assertDatabaseMissing('customers', ['id' => $guestCustomer->id]);
    }

    public function test_verify_phone_rejects_invalid_phone(): void
    {
        $user = User::factory()->create();
        Customer::create(['user_id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'is_registered' => true]);

        $this->actingAs($user)
            ->postJson('/customer/verify-phone', ['phone' => 'invalid'])
            ->assertStatus(422);
    }

    public function test_verify_phone_rejects_unauthenticated(): void
    {
        $this->postJson('/customer/verify-phone', ['phone' => '6281234567890'])
            ->assertStatus(401);
    }
}
