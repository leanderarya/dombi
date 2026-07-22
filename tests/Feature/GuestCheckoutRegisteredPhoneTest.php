<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\WithTestOutlet;

class GuestCheckoutRegisteredPhoneTest extends TestCase
{
    use RefreshDatabase;
    use WithTestOutlet;

    private Outlet $outlet;

    protected function setUp(): void
    {
        parent::setUp();
        $this->outlet = $this->withOutletSession();
    }

    public function test_guest_cannot_checkout_with_registered_phone(): void
    {
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        Customer::create([
            'name' => $user->name,
            'phone' => '6281234567890',
            'email' => $user->email,
            'user_id' => $user->id,
            'is_registered' => true,
        ]);

        $product = $this->createStockedProduct();

        $response = $this->seedCheckoutDraft([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'pickup',
            ],
        ])->post('/customer/checkout/customer', [
            'customer_name' => 'Guest User',
            'phone_number' => '6281234567890',
            'selected_outlet_id' => $this->outlet->id,
        ]);

        $response->assertSessionHasErrors('phone_number');
        $errors = session('errors')->get('phone_number');
        $this->assertStringContainsString('sudah terdaftar', $errors[0]);
    }

    public function test_guest_can_checkout_with_guest_phone(): void
    {
        // Customer exists but user_id is null (guest from previous order)
        Customer::create([
            'name' => 'Previous Guest',
            'phone' => '6281234567891',
            'user_id' => null,
            'is_registered' => false,
        ]);

        $product = $this->createStockedProduct();
        $outlet = $this->outlet;

        $response = $this->seedCheckoutDraft([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'pickup',
            ],
        ])->post('/customer/checkout/customer', [
            'customer_name' => 'Guest User',
            'phone_number' => '6281234567891',
            'selected_outlet_id' => $outlet->id,
        ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();
    }

    public function test_guest_can_checkout_with_new_phone(): void
    {
        $product = $this->createStockedProduct();
        $outlet = $this->outlet;

        $response = $this->seedCheckoutDraft([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'pickup',
            ],
        ])->post('/customer/checkout/customer', [
            'customer_name' => 'New Guest',
            'phone_number' => '6289999999999',
            'selected_outlet_id' => $outlet->id,
        ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();
    }

    public function test_authenticated_user_can_checkout_with_own_registered_phone(): void
    {
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $customer = Customer::create([
            'name' => $user->name,
            'phone' => '6281234567892',
            'email' => $user->email,
            'user_id' => $user->id,
            'is_registered' => true,
        ]);

        $product = $this->createStockedProduct();
        $outlet = $this->outlet;

        $response = $this->actingAs($user)
            ->seedCheckoutDraft([
                'checkout.cart' => [
                    ['product_id' => $product->id, 'quantity' => 1],
                ],
                'checkout.fulfillment' => [
                    'fulfillment_type' => 'pickup',
                ],
            ])
            ->post('/customer/checkout/customer', [
                'customer_name' => $user->name,
                'phone_number' => '6281234567892',
                'selected_outlet_id' => $outlet->id,
            ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();
    }

    public function test_authenticated_user_cannot_checkout_with_other_registered_phone(): void
    {
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $otherUser = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        Customer::create([
            'name' => $otherUser->name,
            'phone' => '6281234567893',
            'email' => $otherUser->email,
            'user_id' => $otherUser->id,
            'is_registered' => true,
        ]);

        $product = $this->createStockedProduct();
        $outlet = $this->outlet;

        $response = $this->actingAs($user)
            ->seedCheckoutDraft([
                'checkout.cart' => [
                    ['product_id' => $product->id, 'quantity' => 1],
                ],
                'checkout.fulfillment' => [
                    'fulfillment_type' => 'pickup',
                ],
            ])
            ->post('/customer/checkout/customer', [
                'customer_name' => $user->name,
                'phone_number' => '6281234567893',
                'selected_outlet_id' => $outlet->id,
            ]);

        $response->assertSessionHasErrors('phone_number');
        $errors = session('errors')->get('phone_number');
        $this->assertStringContainsString('milik akun lain', $errors[0]);
    }

    private function createStockedProduct(): Product
    {
        $product = Product::create([
            'name' => 'Susu Kambing 500ml',
            'slug' => 'susu-kambing-500ml-'.uniqid(),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        OutletInventory::create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $product->id,
            'current_stock' => 10,
            'reserved_stock' => 0,
            'minimum_stock' => 0,
        ]);

        return $product;
    }

    private function seedCheckoutDraft(array $session): self
    {
        $session['checkout.fulfillment']['selected_outlet_id'] = $this->outlet->id;
        return $this->withSession($session);
    }
}
