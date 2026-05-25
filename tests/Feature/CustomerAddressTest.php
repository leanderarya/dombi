<?php

namespace Tests\Feature;

use App\Models\CustomerAddress;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerAddressTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_create_address_with_coordinates(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'is_active' => true]);

        $this->actingAs($customer)
            ->post('/customer/addresses', [
                'label' => 'Rumah',
                'recipient_name' => 'Budi',
                'phone' => '08123456789',
                'address' => 'Jl. Sudirman No. 1',
                'kelurahan' => 'Tembalang',
                'kecamatan' => 'Tembalang',
                'latitude' => -7.0559,
                'longitude' => 110.4375,
                'is_default' => true,
            ])
            ->assertRedirect('/customer/addresses');

        $this->assertDatabaseHas('customer_addresses', [
            'user_id' => $customer->id,
            'label' => 'Rumah',
            'latitude' => -7.0559000,
            'longitude' => 110.4375000,
            'is_default' => true,
        ]);
    }

    public function test_first_address_is_automatically_default(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'is_active' => true]);

        $this->actingAs($customer)
            ->post('/customer/addresses', [
                'recipient_name' => 'Budi',
                'phone' => '08123456789',
                'address' => 'Jl. Test',
                'latitude' => -7.05,
                'longitude' => 110.43,
                'is_default' => false,
            ])
            ->assertRedirect();

        $address = CustomerAddress::where('user_id', $customer->id)->first();
        $this->assertTrue($address->is_default);
    }

    public function test_only_one_default_address_exists(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'is_active' => true]);

        // Create first address (auto-default)
        CustomerAddress::create([
            'user_id' => $customer->id, 'recipient_name' => 'A', 'phone' => '081',
            'address' => 'Addr 1', 'latitude' => -7.05, 'longitude' => 110.43, 'is_default' => true,
        ]);

        // Create second address as default
        $this->actingAs($customer)
            ->post('/customer/addresses', [
                'recipient_name' => 'B',
                'phone' => '082',
                'address' => 'Addr 2',
                'latitude' => -7.06,
                'longitude' => 110.44,
                'is_default' => true,
            ])
            ->assertRedirect();

        $this->assertSame(1, CustomerAddress::where('user_id', $customer->id)->where('is_default', true)->count());
    }

    public function test_customer_can_update_address(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $address = CustomerAddress::create([
            'user_id' => $customer->id, 'recipient_name' => 'Old', 'phone' => '08123456789',
            'address' => 'Old addr', 'latitude' => -7.05, 'longitude' => 110.43, 'is_default' => true,
        ]);

        $this->actingAs($customer)
            ->put("/customer/addresses/{$address->id}", [
                'recipient_name' => 'New Name',
                'phone' => '08234567890',
                'address' => 'New addr',
                'latitude' => -7.07,
                'longitude' => 110.45,
                'is_default' => true,
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('customer_addresses', ['id' => $address->id, 'recipient_name' => 'New Name']);
    }

    public function test_customer_can_set_default_address(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $addr1 = CustomerAddress::create(['user_id' => $customer->id, 'recipient_name' => 'A', 'phone' => '081', 'address' => 'A', 'latitude' => -7.05, 'longitude' => 110.43, 'is_default' => true]);
        $addr2 = CustomerAddress::create(['user_id' => $customer->id, 'recipient_name' => 'B', 'phone' => '082', 'address' => 'B', 'latitude' => -7.06, 'longitude' => 110.44, 'is_default' => false]);

        $this->actingAs($customer)
            ->post("/customer/addresses/{$addr2->id}/set-default")
            ->assertRedirect();

        $this->assertTrue($addr2->fresh()->is_default);
        $this->assertFalse($addr1->fresh()->is_default);
    }

    public function test_deleting_default_address_reassigns_fallback(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $addr1 = CustomerAddress::create(['user_id' => $customer->id, 'recipient_name' => 'A', 'phone' => '081', 'address' => 'A', 'latitude' => -7.05, 'longitude' => 110.43, 'is_default' => true]);
        $addr2 = CustomerAddress::create(['user_id' => $customer->id, 'recipient_name' => 'B', 'phone' => '082', 'address' => 'B', 'latitude' => -7.06, 'longitude' => 110.44, 'is_default' => false]);

        $this->actingAs($customer)
            ->delete("/customer/addresses/{$addr1->id}")
            ->assertRedirect();

        $this->assertDatabaseMissing('customer_addresses', ['id' => $addr1->id]);
        $this->assertTrue($addr2->fresh()->is_default);
    }

    public function test_latitude_longitude_required(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'is_active' => true]);

        $this->actingAs($customer)
            ->post('/customer/addresses', [
                'recipient_name' => 'Budi',
                'phone' => '08123456789',
                'address' => 'Jl. Test',
                // No latitude/longitude
            ])
            ->assertSessionHasErrors(['latitude', 'longitude']);
    }

    public function test_customer_cannot_access_other_customer_address(): void
    {
        $customer1 = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $customer2 = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $address = CustomerAddress::create(['user_id' => $customer1->id, 'recipient_name' => 'A', 'phone' => '081', 'address' => 'A', 'latitude' => -7.05, 'longitude' => 110.43, 'is_default' => true]);

        $this->actingAs($customer2)
            ->get("/customer/addresses/{$address->id}/edit")
            ->assertForbidden();

        $this->actingAs($customer2)
            ->delete("/customer/addresses/{$address->id}")
            ->assertForbidden();
    }

    public function test_address_index_page_accessible(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'is_active' => true]);

        $this->actingAs($customer)
            ->get('/customer/addresses')
            ->assertOk();
    }

    public function test_address_create_page_accessible(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'is_active' => true]);

        $this->actingAs($customer)
            ->get('/customer/addresses/create')
            ->assertOk();
    }
}
