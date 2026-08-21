<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\Product;
use App\Models\ReturnRequest;
use App\Models\ReturnRequestItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OutletReturnShowFixTest extends TestCase
{
    use RefreshDatabase;

    public function test_return_show_exposes_product_name(): void
    {
        $user = User::factory()->create(['role' => 'outlet']);
        $outlet = Outlet::factory()->create(['status' => 'active']);
        $user->update(['outlet_id' => $outlet->id]);

        $product = Product::factory()->create(['name' => 'Susu Segar 1L']);
        $return = ReturnRequest::factory()->create([
            'outlet_id' => $outlet->id,
            'requested_by' => $user->id,
        ]);
        ReturnRequestItem::factory()->create([
            'return_request_id' => $return->id,
            'product_id' => $product->id,
            'quantity' => 2,
        ]);

        $response = $this->actingAs($user)->get("/outlet/returns/{$return->id}");

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('outlet/returns/show')
            ->has('return.items', 1)
            ->where('return.items.0.product.name', 'Susu Segar 1L'));
    }
}
