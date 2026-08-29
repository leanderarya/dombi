<?php

namespace Tests\Feature;

use App\Models\OutletInventory;
use App\Models\Product;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Mockery;
use RuntimeException;
use Tests\TestCase;
use Tests\WithTestOutlet;

class CheckoutOrderFailureLoggingTest extends TestCase
{
    use RefreshDatabase;
    use WithTestOutlet;

    public function test_order_creation_failure_is_safely_logged_with_response_correlation_id(): void
    {
        $outlet = $this->withOutletSession();
        $product = Product::factory()->create(['selling_price' => 25000]);
        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'current_stock' => 10,
            'reserved_stock' => 0,
            'is_active' => true,
        ]);

        $orderService = Mockery::mock(OrderService::class);
        $orderService->shouldReceive('createCheckoutOrder')
            ->once()
            ->andThrow(new RuntimeException('database detail that must not reach customer'));
        $this->app->instance(OrderService::class, $orderService);

        Log::spy();

        $response = $this->withSession([
            'checkout.cart' => [['product_id' => $product->id, 'quantity' => 1]],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'pickup',
                'selected_outlet_id' => $outlet->id,
            ],
            'checkout.customer' => [
                'customer_name' => 'Arya',
                'phone_number' => '6281234567890',
            ],
        ])->postJson('/customer/checkout/payment', ['payment_method' => 'qris']);

        $response->assertStatus(500)
            ->assertJsonPath('message', 'Terjadi kesalahan saat membuat pesanan. Silakan coba lagi.')
            ->assertJsonStructure(['error_id'])
            ->assertJsonMissing(['phone_number', 'customer_name']);

        $errorId = $response->json('error_id');
        $this->assertMatchesRegularExpression('/^[0-9a-f-]{36}$/', $errorId);

        Log::shouldHaveReceived('error')->once()->with(
            'Checkout order creation failed',
            Mockery::on(fn (array $context): bool => $context['error_id'] === $errorId
                && $context['exception'] === RuntimeException::class
                && $context['fulfillment_type'] === 'pickup'
                && $context['selected_outlet_id'] === $outlet->id
                && $context['item_count'] === 1
                && $context['product_ids'] === [$product->id]
                && ! array_key_exists('phone_number', $context)
                && ! array_key_exists('customer_name', $context)),
        );
    }
}
