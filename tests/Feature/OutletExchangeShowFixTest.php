<?php

namespace Tests\Feature;

use App\Models\ExchangeRequest;
use App\Models\ExchangeRequestItem;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\ReturnRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OutletExchangeShowFixTest extends TestCase
{
    use RefreshDatabase;

    public function test_exchange_show_exposes_product_name(): void
    {
        $user = User::factory()->create(['role' => 'outlet']);
        $outlet = Outlet::factory()->create(['status' => 'active']);
        $user->update(['outlet_id' => $outlet->id]);

        $product = Product::factory()->create(['name' => 'Baru 500ml']);
        $return = ReturnRequest::factory()->create([
            'outlet_id' => $outlet->id,
            'requested_by' => $user->id,
        ]);
        $exchange = ExchangeRequest::create([
            'return_request_id' => $return->id,
            'outlet_id' => $outlet->id,
            'requested_by' => $user->id,
            'status' => ExchangeRequest::STATUS_SUBMITTED,
        ]);
        ExchangeRequestItem::create([
            'exchange_request_id' => $exchange->id,
            'product_id' => $product->id,
            'quantity' => 1,
            'unit_price' => 5000,
            'subtotal' => 5000,
        ]);

        $response = $this->actingAs($user)->get("/outlet/exchanges/{$exchange->id}");

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('outlet/exchanges/show')
            ->where('exchange.items.0.product.name', 'Baru 500ml'));
    }
}
