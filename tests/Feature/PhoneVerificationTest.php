<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
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

    public function test_send_otp_returns_sent(): void
    {
        Http::fake(['*' => Http::response(['status' => 'sent'], 200)]);

        $user = User::factory()->create();
        Customer::create(['user_id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'is_registered' => true]);

        $this->actingAs($user)
            ->post('/customer/send-phone-otp', ['phone' => '6281234567890'])
            ->assertOk()
            ->assertJson(['sent' => true]);
    }

    public function test_verify_phone_links_customer(): void
    {
        Http::fake(['*' => Http::response(['status' => 'sent'], 200)]);

        $user = User::factory()->create();
        Customer::create(['user_id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'is_registered' => true]);

        $this->actingAs($user)
            ->post('/customer/send-phone-otp', ['phone' => '6281234567890'])
            ->assertOk();

        $code = session('phone_verification.code');

        $this->actingAs($user)
            ->post('/customer/verify-phone', ['phone' => '6281234567890', 'code' => $code])
            ->assertOk()
            ->assertJson(['verified' => true]);
    }

    public function test_verify_wrong_code_returns_422(): void
    {
        Http::fake(['*' => Http::response(['status' => 'sent'], 200)]);

        $user = User::factory()->create();
        Customer::create(['user_id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'is_registered' => true]);

        $this->actingAs($user)
            ->post('/customer/send-phone-otp', ['phone' => '6281234567890']);

        $this->actingAs($user)
            ->post('/customer/verify-phone', ['phone' => '6281234567890', 'code' => '000000'])
            ->assertStatus(422);
    }

    public function test_send_otp_rejects_invalid_phone(): void
    {
        $user = User::factory()->create();
        Customer::create(['user_id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'is_registered' => true]);

        $response = $this->actingAs($user)
            ->postJson('/customer/send-phone-otp', ['phone' => 'invalid']);

        $response->assertStatus(422);
    }

    public function test_verify_phone_merges_guest_orders(): void
    {
        Http::fake(['*' => Http::response(['status' => 'sent'], 200)]);

        $user = User::factory()->create();
        Customer::create(['user_id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'is_registered' => true]);

        // Create guest customer with same phone
        $guestCustomer = Customer::create(['name' => 'Guest', 'phone' => '6281234567890', 'is_registered' => false]);

        $this->actingAs($user)
            ->post('/customer/send-phone-otp', ['phone' => '6281234567890'])
            ->assertOk();

        $code = session('phone_verification.code');

        $this->actingAs($user)
            ->post('/customer/verify-phone', ['phone' => '6281234567890', 'code' => $code])
            ->assertOk()
            ->assertJson(['verified' => true]);

        // Guest customer should be deleted
        $this->assertDatabaseMissing('customers', ['id' => $guestCustomer->id]);
    }
}
