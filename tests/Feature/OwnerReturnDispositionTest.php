<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ReturnRequest;
use App\Models\ReturnRequestItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OwnerReturnDispositionTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private ReturnRequest $returnRequest;

    private ReturnRequestItem $item;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['role' => 'owner']);

        $outlet = Outlet::factory()->create();
        $variant = Product::factory()->create(['center_stock' => 20]);

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_id' => $variant->id,
            'current_stock' => 10,
        ]);

        $this->returnRequest = ReturnRequest::factory()->create([
            'outlet_id' => $outlet->id,
            'status' => ReturnRequest::STATUS_RECEIVED_AT_CENTER,
        ]);

        $this->item = ReturnRequestItem::factory()->create([
            'return_request_id' => $this->returnRequest->id,
            'product_id' => $variant->id,
            'quantity' => 3,
            'unit_price' => 10000,
            'subtotal' => 30000,
        ]);
    }

    public function test_owner_can_store_item(): void
    {
        $this->actingAs($this->owner)
            ->post("/owner/returns/{$this->returnRequest->id}/items/{$this->item->id}/store")
            ->assertSessionHas('success');

        $this->assertDatabaseHas('return_request_items', [
            'id' => $this->item->id,
            'disposition' => 'stored',
        ]);
    }

    public function test_owner_can_dispose_item_and_stock_updated(): void
    {
        $variant = $this->item->variant;
        $beforeCenterStock = (int) $variant->center_stock;

        $this->actingAs($this->owner)
            ->post("/owner/returns/{$this->returnRequest->id}/items/{$this->item->id}/dispose")
            ->assertSessionHas('success');

        $this->assertDatabaseHas('return_request_items', [
            'id' => $this->item->id,
            'disposition' => 'disposed',
        ]);

        $variant->refresh();
        $this->assertSame($beforeCenterStock, (int) $variant->center_stock);

        $this->assertDatabaseHas('stock_movements', [
            'reference_type' => ReturnRequest::class,
            'reference_id' => $this->returnRequest->id,
            'type' => 'disposal',
            'quantity' => 0,
        ]);
    }

    public function test_owner_can_store_item_increases_center_stock(): void
    {
        $variant = $this->item->variant;
        $beforeCenterStock = (int) $variant->center_stock;

        $this->actingAs($this->owner)
            ->post("/owner/returns/{$this->returnRequest->id}/items/{$this->item->id}/store")
            ->assertSessionHas('success');

        $variant->refresh();
        $this->assertSame($beforeCenterStock + 3, (int) $variant->center_stock);

        $this->assertDatabaseHas('stock_movements', [
            'reference_type' => ReturnRequest::class,
            'reference_id' => $this->returnRequest->id,
            'type' => 'return_in',
            'quantity' => 3,
        ]);
    }

    public function test_owner_can_change_disposition_from_stored_to_disposed(): void
    {
        $this->actingAs($this->owner)
            ->post("/owner/returns/{$this->returnRequest->id}/items/{$this->item->id}/store")
            ->assertSessionHas('success');

        $variant = $this->item->variant->fresh();
        $this->assertSame(23, (int) $variant->center_stock);

        $this->actingAs($this->owner)
            ->post("/owner/returns/{$this->returnRequest->id}/items/{$this->item->id}/dispose")
            ->assertSessionHas('success');

        $variant->refresh();
        $this->assertSame(20, (int) $variant->center_stock);

        $this->assertDatabaseHas('return_request_items', [
            'id' => $this->item->id,
            'disposition' => 'disposed',
        ]);
    }

    public function test_owner_can_change_disposition_from_disposed_to_stored(): void
    {
        $this->actingAs($this->owner)
            ->post("/owner/returns/{$this->returnRequest->id}/items/{$this->item->id}/dispose")
            ->assertSessionHas('success');

        $variant = $this->item->variant->fresh();
        $this->assertSame(20, (int) $variant->center_stock);

        $this->actingAs($this->owner)
            ->post("/owner/returns/{$this->returnRequest->id}/items/{$this->item->id}/store")
            ->assertSessionHas('success');

        $variant->refresh();
        $this->assertSame(23, (int) $variant->center_stock);

        $this->assertDatabaseHas('return_request_items', [
            'id' => $this->item->id,
            'disposition' => 'stored',
        ]);
    }

    public function test_cannot_dispose_undecided_item_twice(): void
    {
        $this->actingAs($this->owner)
            ->post("/owner/returns/{$this->returnRequest->id}/items/{$this->item->id}/dispose")
            ->assertSessionHas('success');

        $this->actingAs($this->owner)
            ->post("/owner/returns/{$this->returnRequest->id}/items/{$this->item->id}/dispose")
            ->assertSessionHasErrors();
    }

    public function test_cannot_complete_return_with_undecided_items(): void
    {
        $this->actingAs($this->owner)
            ->post("/owner/returns/{$this->returnRequest->id}/complete")
            ->assertSessionHasErrors();
    }

    public function test_can_complete_return_after_all_items_decided(): void
    {
        $this->actingAs($this->owner)
            ->post("/owner/returns/{$this->returnRequest->id}/items/{$this->item->id}/store")
            ->assertSessionHas('success');

        $this->actingAs($this->owner)
            ->post("/owner/returns/{$this->returnRequest->id}/complete")
            ->assertSessionHas('success');

        $this->assertDatabaseHas('return_requests', [
            'id' => $this->returnRequest->id,
            'status' => ReturnRequest::STATUS_COMPLETED,
        ]);
    }

    public function test_owner_can_dispose_and_store_mixed(): void
    {
        $variant2 = Product::factory()->create(['center_stock' => 20]);
        $item2 = ReturnRequestItem::factory()->create([
            'return_request_id' => $this->returnRequest->id,
            'product_id' => $variant2->id,
            'quantity' => 2,
            'unit_price' => 15000,
            'subtotal' => 30000,
        ]);

        $this->actingAs($this->owner)
            ->post("/owner/returns/{$this->returnRequest->id}/items/{$this->item->id}/store")
            ->assertSessionHas('success');

        $this->actingAs($this->owner)
            ->post("/owner/returns/{$this->returnRequest->id}/items/{$item2->id}/dispose")
            ->assertSessionHas('success');

        $this->actingAs($this->owner)
            ->post("/owner/returns/{$this->returnRequest->id}/complete")
            ->assertSessionHas('success');

        $this->assertDatabaseHas('return_requests', [
            'id' => $this->returnRequest->id,
            'status' => ReturnRequest::STATUS_COMPLETED,
        ]);
    }
}
