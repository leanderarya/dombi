<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\Product;
use App\Models\ReturnRequest;
use App\Models\ReturnRequestItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OutletExchangeCreateFixTest extends TestCase
{
    use RefreshDatabase;

    public function test_exchange_create_receives_return_requests_with_product(): void
    {
        $user = User::factory()->create(['role' => 'outlet']);
        $outlet = Outlet::factory()->create(['status' => 'active']);
        $user->update(['outlet_id' => $outlet->id]);

        $product = Product::factory()->create(['name' => 'Susu Kambing 1L']);
        $return = ReturnRequest::factory()->create([
            'outlet_id' => $outlet->id,
            'requested_by' => $user->id,
            'status' => ReturnRequest::STATUS_APPROVED,
        ]);
        ReturnRequestItem::factory()->create([
            'return_request_id' => $return->id,
            'product_id' => $product->id,
            'quantity' => 1,
        ]);

        $response = $this->actingAs($user)->get('/outlet/exchanges/create');

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('outlet/exchanges/create')
            ->has('returnRequests', 1)
            ->where('returnRequests.0.items.0.product.name', 'Susu Kambing 1L'));
    }
}
