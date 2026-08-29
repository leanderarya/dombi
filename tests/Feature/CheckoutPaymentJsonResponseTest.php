<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CheckoutPaymentJsonResponseTest extends TestCase
{
    use RefreshDatabase;

    public function test_json_payment_request_returns_actionable_json_when_delivery_location_is_missing(): void
    {
        $this->withoutExceptionHandling();

        $this->withSession([
            'checkout.fulfillment' => ['fulfillment_type' => 'delivery_dombi'],
            'checkout.customer' => [
                'customer_name' => 'Arya',
                'phone_number' => '6281234567890',
            ],
            'checkout.cart' => [['product_id' => 1, 'quantity' => 1]],
        ])->postJson('/customer/checkout/payment', [
            'payment_method' => 'qris',
        ])->assertStatus(422)->assertJson([
            'message' => 'Lengkapi alamat pengiriman terlebih dahulu.',
            'redirect_url' => route('customer.checkout.customer'),
        ]);
    }
}
