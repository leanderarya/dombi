<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductFlavorGroup;
use App\Models\User;
use App\Services\ProductSkuGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Soft-deleted products and categories used to be a one-way door: still in the
 * database, invisible everywhere, and — because the unique rules count trashed
 * rows — holding their name, sku and flavor+size slot against every future
 * create. Two live bugs came out of that, and this covers both the door back
 * and the 500s that stood in front of it.
 */
class ProductRestoreTest extends TestCase
{
    use RefreshDatabase;

    private function owner(): User
    {
        return User::factory()->create(['role' => 'owner']);
    }

    public function test_restore_routes_exist(): void
    {
        $this->assertTrue(Route::has('owner.products.restore'));
        $this->assertTrue(Route::has('owner.product-categories.restore'));
    }

    public function test_a_trashed_product_can_be_restored(): void
    {
        $category = ProductCategory::factory()->create();
        $product = Product::factory()->create([
            'product_category_id' => $category->id,
            'is_active' => false,
        ]);
        $product->delete();

        $this->assertTrue($product->fresh()->trashed());

        $this->actingAs($this->owner())
            ->patch("/owner/products/{$product->id}/restore")
            ->assertRedirect();

        $this->assertFalse($product->fresh()->trashed());
        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'deleted_at' => null,
        ]);
    }

    /**
     * The route binds with withTrashed(); without it the id of a trashed product
     * would 404 and the whole action would be unreachable.
     */
    public function test_the_restore_route_resolves_a_trashed_product(): void
    {
        $category = ProductCategory::factory()->create();
        $product = Product::factory()->create(['product_category_id' => $category->id]);
        $product->delete();

        $this->actingAs($this->owner())
            ->patch("/owner/products/{$product->id}/restore")
            ->assertRedirect();

        $this->assertFalse($product->fresh()->trashed());
    }

    public function test_a_trashed_category_can_be_restored(): void
    {
        $category = ProductCategory::factory()->create();
        $category->delete();

        $this->actingAs($this->owner())
            ->patch("/owner/product-categories/{$category->id}/restore")
            ->assertRedirect();

        $this->assertFalse($category->fresh()->trashed());
    }

    /**
     * The index is the only page that surfaces a trashed category, so it has to
     * ship the list.
     */
    public function test_the_category_index_ships_trashed_categories(): void
    {
        $live = ProductCategory::factory()->create();
        $trashed = ProductCategory::factory()->create();
        $trashed->delete();

        $this->actingAs($this->owner())
            ->get('/owner/product-categories')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('owner/product-categories/index')
                ->has('categories', 1)
                ->where('categories.0.id', $live->id)
                ->has('trashedCategories', 1)
                ->where('trashedCategories.0.id', $trashed->id));
    }

    public function test_the_category_page_ships_trashed_products(): void
    {
        $category = ProductCategory::factory()->create();
        $live = Product::factory()->create(['product_category_id' => $category->id]);
        $trashed = Product::factory()->create(['product_category_id' => $category->id]);
        $trashed->delete();

        $this->actingAs($this->owner())
            ->get("/owner/product-categories/{$category->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('owner/product-categories/show')
                // Kept out of the main list so the grouping and the per-group
                // "varian" count keep describing the live catalogue only.
                ->has('category.products', 1)
                ->where('category.products.0.id', $live->id)
                ->has('trashedProducts', 1)
                ->where('trashedProducts.0.id', $trashed->id));
    }

    /**
     * Before the guard, this store died on the UNIQUE
     * (flavor group, normalized size) index with a 500. It now comes back as a
     * validation error that names the row holding the slot.
     */
    public function test_creating_over_a_trashed_size_slot_is_refused_with_a_message(): void
    {
        $category = ProductCategory::factory()->create();
        $group = ProductFlavorGroup::factory()->create([
            'product_category_id' => $category->id,
        ]);
        $trashed = Product::factory()->create([
            'product_category_id' => $category->id,
            'product_flavor_group_id' => $group->id,
            'name' => 'Biogoat 1L',
            'flavor' => $group->flavor,
            'size' => '1L',
            'sku' => 'BIO-GOA-1L-001',
        ]);
        $trashed->delete();

        $this->actingAs($this->owner())
            ->post("/owner/product-categories/{$category->id}/products", [
                'name' => 'Biogoat 1L Baru',
                'flavor' => $group->flavor,
                'size' => '1L',
                'center_price' => 10000,
                'selling_price' => 15000,
            ])
            ->assertSessionHasErrors('size');

        $this->assertSame(1, Product::withTrashed()->count());
    }

    /**
     * The sku generator probes with withTrashed() for the same reason: a trashed
     * row keeps its sku in the UNIQUE index, so a probe that ignored it proposed
     * a sku that could not be inserted. The generated sku for this category,
     * flavor and size is BIO-TAK-1L-001 — the trashed row already holds it.
     */
    public function test_the_sku_generator_does_not_propose_a_trashed_sku(): void
    {
        $category = ProductCategory::factory()->create(['name' => 'Biogoat']);
        $trashed = Product::factory()->create([
            'product_category_id' => $category->id,
            'sku' => 'BIO-TAK-1L-001',
        ]);
        $trashed->delete();

        $proposed = app(ProductSkuGenerator::class)
            ->uniqueForCategory($category->id, 'Tak En', 'Tak En', '1L');

        // Without the fix the generator cannot see the trashed row, proposes the
        // same sku again, and the insert dies on the constraint.
        $this->assertNotSame('BIO-TAK-1L-001', $proposed);
    }

    /**
     * A product in another flavor group is not this store's problem, so it must
     * not block a create it could never have collided with.
     */
    public function test_a_trashed_product_in_another_group_does_not_block_a_create(): void
    {
        $category = ProductCategory::factory()->create();
        $sizes = ['1L', '2L'];
        $groups = ProductFlavorGroup::factory()->count(2)->sequence(
            fn ($seq) => ['flavor' => 'Rasa '.$seq->index, 'normalized_flavor' => 'rasa '.$seq->index],
        )->create(['product_category_id' => $category->id]);

        $trashed = Product::factory()->create([
            'product_category_id' => $category->id,
            'product_flavor_group_id' => $groups[0]->id,
            'flavor' => 'Rasa 1',
            'size' => '1L',
        ]);
        $trashed->delete();

        $this->actingAs($this->owner())
            ->post("/owner/product-categories/{$category->id}/products", [
                'name' => 'Rasa 2 2L',
                'flavor' => 'Rasa 2',
                'size' => $sizes[1],
                'center_price' => 10000,
                'selling_price' => 15000,
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(1, Product::count());
    }
}
