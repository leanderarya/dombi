<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CheckoutAddressPersistenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_store_customer_persists_posted_address_verbatim(): void
    {
        $user = User::factory()->create();
        $customer = Customer::factory()->for($user)->create();
        $address = $customer->addresses()->create([
            'label' => 'Karang',
            'recipient_name' => 'Arya',
            'phone' => '6281234567890',
            'address' => 'Jl. Melati No. 5',
            'village' => 'Karang',
            'district' => 'Mekar',
            'city' => 'Bandung',
            'is_default' => true,
        ]);
        $other = $customer->addresses()->create([
            'label' => 'Lain',
            'recipient_name' => 'Arya',
            'phone' => '6281234567890',
            'address' => 'Jl. Lain No. 1',
            'village' => 'Lain',
            'district' => 'Sana',
            'city' => 'Jakarta',
            'is_default' => false,
        ]);

        $this->actingAs($user)
            ->withSession([
                'checkout.fulfillment' => ['fulfillment_type' => 'delivery_dombi'],
                'checkout.location' => ['address_id' => $other->id],
            ])
            ->post('/customer/checkout/customer', [
                'customer_name' => 'Arya',
                'phone_number' => '081234567890',
                'address_id' => $address->id,
                'address_line' => 'Jl. Melati No. 5',
                'address_detail' => 'Blok B',
                'province' => 'Jawa Barat',
                'city' => 'Bandung',
                'district' => 'Mekar',
                'village' => 'Karang',
                'postal_code' => '40123',
                'latitude' => -6.9175,
                'longitude' => 107.6191,
                'recipient_name' => '',
                'recipient_phone' => '',
                'save_recipient' => false,
            ]);

        $this->assertSame(
            $address->id,
            session('checkout.location.address_id'),
            'Posted address_id must be persisted, not the pre-existing session address.',
        );
        $this->assertSame(
            'Jl. Melati No. 5',
            session('checkout.location.address_line'),
        );
        $this->assertSame('Blok B', session('checkout.location.address_detail'));
    }
}