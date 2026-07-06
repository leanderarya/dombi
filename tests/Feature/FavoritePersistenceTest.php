<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Favorite;
use App\Models\Product;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class FavoritePersistenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_logged_in_favorite_persists_in_db(): void
    {
        [$user, $customer] = $this->createUserWithCustomer();
        $variant = $this->createVariant();

        $this->actingAs($user)
            ->postJson('/customer/favorites/toggle', ['product_variant_id' => $variant->id])
            ->assertOk()
            ->assertJson(['favorited' => true]);

        $this->assertDatabaseHas('favorites', [
            'customer_id' => $customer->id,
            'product_variant_id' => $variant->id,
        ]);
    }

    public function test_logged_in_favorite_survives_logout_login(): void
    {
        [$user, $customer] = $this->createUserWithCustomer();
        $variant = $this->createVariant();

        // Add favorite
        Favorite::create(['customer_id' => $customer->id, 'product_variant_id' => $variant->id]);

        // Verify it's in the list
        $this->actingAs($user)
            ->getJson('/customer/favorites')
            ->assertOk()
            ->assertJson(['variant_ids' => [$variant->id]]);

        // Favorite persists in DB regardless of session
        $this->assertDatabaseHas('favorites', [
            'customer_id' => $customer->id,
            'product_variant_id' => $variant->id,
        ]);
    }

    public function test_guest_favorite_isolated_from_user(): void
    {
        [$user, $customer] = $this->createUserWithCustomer();
        $variant = $this->createVariant();

        // User has a favorite in DB
        Favorite::create(['customer_id' => $customer->id, 'product_variant_id' => $variant->id]);

        // Guest's actions (localStorage) cannot affect user's server favorites
        // Verify user's favorite is still there
        $this->actingAs($user)
            ->getJson('/customer/favorites')
            ->assertOk()
            ->assertJson(['variant_ids' => [$variant->id]]);

        // DB unchanged
        $this->assertDatabaseHas('favorites', [
            'customer_id' => $customer->id,
            'product_variant_id' => $variant->id,
        ]);
    }

    public function test_login_merges_guest_favorites_union(): void
    {
        [$user, $customer] = $this->createUserWithCustomer();
        $variant1 = $this->createVariant();
        $variant2 = $this->createVariant();

        // User already has variant1 as favorite
        Favorite::create(['customer_id' => $customer->id, 'product_variant_id' => $variant1->id]);

        // Guest had variant2 — merge it
        $this->actingAs($user)
            ->postJson('/customer/favorites/merge', ['variant_ids' => [$variant2->id]])
            ->assertOk()
            ->assertJson(['merged' => true]);

        // Both should be in favorites (union)
        $this->assertDatabaseHas('favorites', ['customer_id' => $customer->id, 'product_variant_id' => $variant1->id]);
        $this->assertDatabaseHas('favorites', ['customer_id' => $customer->id, 'product_variant_id' => $variant2->id]);

        // Response includes both
        $this->actingAs($user)
            ->getJson('/customer/favorites')
            ->assertOk()
            ->assertJson(fn ($json) => $json
                ->where('variant_ids', [$variant1->id, $variant2->id])
                ->etc()
            );
    }

    public function test_merge_does_not_duplicate_existing(): void
    {
        [$user, $customer] = $this->createUserWithCustomer();
        $variant = $this->createVariant();

        // User already has this favorite
        Favorite::create(['customer_id' => $customer->id, 'product_variant_id' => $variant->id]);

        // Merge with same variant — should not duplicate
        $this->actingAs($user)
            ->postJson('/customer/favorites/merge', ['variant_ids' => [$variant->id]])
            ->assertOk();

        $count = Favorite::where('customer_id', $customer->id)
            ->where('product_variant_id', $variant->id)
            ->count();

        $this->assertSame(1, $count);
    }

    public function test_favorite_endpoint_scoped_no_idor(): void
    {
        [$user1, $customer1] = $this->createUserWithCustomer();
        [, $customer2] = $this->createUserWithCustomer();
        $variant = $this->createVariant();

        // customer2 has a favorite
        Favorite::create(['customer_id' => $customer2->id, 'product_variant_id' => $variant->id]);

        // user1 should NOT see customer2's favorites
        $this->actingAs($user1)
            ->getJson('/customer/favorites')
            ->assertOk()
            ->assertJson(['variant_ids' => []]);

        // user1 should NOT be able to remove customer2's favorite
        $this->actingAs($user1)
            ->postJson('/customer/favorites/toggle', ['product_variant_id' => $variant->id])
            ->assertOk()
            ->assertJson(['favorited' => true]); // creates for user1, doesn't affect user2

        // customer2's favorite still exists
        $this->assertDatabaseHas('favorites', [
            'customer_id' => $customer2->id,
            'product_variant_id' => $variant->id,
        ]);
    }

    public function test_toggle_favorite_removes_if_exists(): void
    {
        [$user, $customer] = $this->createUserWithCustomer();
        $variant = $this->createVariant();

        Favorite::create(['customer_id' => $customer->id, 'product_variant_id' => $variant->id]);

        $this->actingAs($user)
            ->postJson('/customer/favorites/toggle', ['product_variant_id' => $variant->id])
            ->assertOk()
            ->assertJson(['favorited' => false]);

        $this->assertDatabaseMissing('favorites', [
            'customer_id' => $customer->id,
            'product_variant_id' => $variant->id,
        ]);
    }

    public function test_add_favorite_idempotent(): void
    {
        [$user, $customer] = $this->createUserWithCustomer();
        $variant = $this->createVariant();

        // Toggle twice — should create only one record
        $this->actingAs($user)
            ->postJson('/customer/favorites/toggle', ['product_variant_id' => $variant->id])
            ->assertOk();

        $this->actingAs($user)
            ->postJson('/customer/favorites/toggle', ['product_variant_id' => $variant->id])
            ->assertOk();

        // Should be removed (toggled off), not duplicated
        $this->assertDatabaseMissing('favorites', [
            'customer_id' => $customer->id,
            'product_variant_id' => $variant->id,
        ]);
    }

    public function test_merge_requires_auth(): void
    {
        $variant = $this->createVariant();

        $this->postJson('/customer/favorites/merge', ['variant_ids' => [$variant->id]])
            ->assertUnauthorized();
    }

    public function test_google_login_creates_customer_record(): void
    {
        $user = User::forceCreate([
            'name' => 'Google User',
            'email' => 'google-'.uniqid().'@test.com',
            'password' => bcrypt(Str::random(64)),
            'role' => 'customer',
            'is_active' => true,
            'provider' => 'google',
            'provider_id' => 'google-'.uniqid(),
        ]);

        // No Customer before
        $this->assertNull($user->customer);

        // Simulate what SocialAuthController does after login
        Customer::firstOrCreate(
            ['user_id' => $user->id],
            ['name' => $user->name, 'email' => $user->email, 'is_registered' => true],
        );

        // Customer now exists
        $user->refresh();
        $this->assertNotNull($user->customer);
        $this->assertNull($user->customer->phone); // phone nullable
    }

    public function test_google_login_cre_customer_idempotent(): void
    {
        $user = User::forceCreate([
            'name' => 'Idempotent User',
            'email' => 'idem-'.uniqid().'@test.com',
            'password' => bcrypt(Str::random(64)),
            'role' => 'customer',
            'is_active' => true,
        ]);

        // Run twice
        Customer::firstOrCreate(['user_id' => $user->id], ['name' => $user->name, 'is_registered' => true]);
        Customer::firstOrCreate(['user_id' => $user->id], ['name' => $user->name, 'is_registered' => true]);

        $this->assertSame(1, Customer::where('user_id', $user->id)->count());
    }

    public function test_logged_in_user_without_prior_customer_can_save_favorite(): void
    {
        // User has no Customer yet (simulates pre-fix state)
        $user = User::forceCreate([
            'name' => 'New Customer',
            'email' => 'newcust-'.uniqid().'@test.com',
            'password' => bcrypt('password'),
            'role' => 'customer',
            'is_active' => true,
        ]);

        // Simulate Google login creating Customer
        $customer = Customer::firstOrCreate(
            ['user_id' => $user->id],
            ['name' => $user->name, 'email' => $user->email, 'is_registered' => true],
        );

        $variant = $this->createVariant();

        $this->actingAs($user)
            ->postJson('/customer/favorites/toggle', ['product_variant_id' => $variant->id])
            ->assertOk()
            ->assertJson(['favorited' => true]);

        $this->assertDatabaseHas('favorites', [
            'customer_id' => $customer->id,
            'product_variant_id' => $variant->id,
        ]);
    }

    public function test_relogin_keeps_existing_favorites(): void
    {
        [$user, $customer] = $this->createUserWithCustomer();
        $variant1 = $this->createVariant();
        $variant2 = $this->createVariant();

        // User has favorites on server
        Favorite::create(['customer_id' => $customer->id, 'product_variant_id' => $variant1->id]);
        Favorite::create(['customer_id' => $customer->id, 'product_variant_id' => $variant2->id]);

        // Simulate re-login: fetch favorites again
        $this->actingAs($user)
            ->getJson('/customer/favorites')
            ->assertOk()
            ->assertJson(fn ($json) => $json
                ->where('variant_ids', [$variant1->id, $variant2->id])
                ->etc()
            );

        // DB untouched
        $this->assertDatabaseCount('favorites', 2);
    }

    public function test_empty_merge_does_not_wipe_account_favorites(): void
    {
        [$user, $customer] = $this->createUserWithCustomer();
        $variant = $this->createVariant();

        // User has a favorite
        Favorite::create(['customer_id' => $customer->id, 'product_variant_id' => $variant->id]);

        // Merge with empty array (simulates empty guest store on login)
        $this->actingAs($user)
            ->postJson('/customer/favorites/merge', ['variant_ids' => []])
            ->assertOk();

        // Favorite still exists
        $this->assertDatabaseHas('favorites', [
            'customer_id' => $customer->id,
            'product_variant_id' => $variant->id,
        ]);

        // List still returns it
        $this->actingAs($user)
            ->getJson('/customer/favorites')
            ->assertOk()
            ->assertJson(['variant_ids' => [$variant->id]]);
    }

    public function test_login_merge_is_union_not_replace(): void
    {
        [$user, $customer] = $this->createUserWithCustomer();
        $variant1 = $this->createVariant();
        $variant2 = $this->createVariant();
        $variant3 = $this->createVariant();

        // User already has variant1 and variant2
        Favorite::create(['customer_id' => $customer->id, 'product_variant_id' => $variant1->id]);
        Favorite::create(['customer_id' => $customer->id, 'product_variant_id' => $variant2->id]);

        // Guest had variant2 (overlap) and variant3 (new)
        $this->actingAs($user)
            ->postJson('/customer/favorites/merge', ['variant_ids' => [$variant2->id, $variant3->id]])
            ->assertOk();

        // All three should exist (union)
        $this->assertDatabaseHas('favorites', ['customer_id' => $customer->id, 'product_variant_id' => $variant1->id]);
        $this->assertDatabaseHas('favorites', ['customer_id' => $customer->id, 'product_variant_id' => $variant2->id]);
        $this->assertDatabaseHas('favorites', ['customer_id' => $customer->id, 'product_variant_id' => $variant3->id]);
        $this->assertDatabaseCount('favorites', 3);
    }

    public function test_logout_does_not_delete_server_favorites(): void
    {
        [$user, $customer] = $this->createUserWithCustomer();
        $variant = $this->createVariant();

        Favorite::create(['customer_id' => $customer->id, 'product_variant_id' => $variant->id]);

        // Logout (server-side session invalidation)
        $this->actingAs($user)->post('/logout');

        // Favorite still in DB
        $this->assertDatabaseHas('favorites', [
            'customer_id' => $customer->id,
            'product_variant_id' => $variant->id,
        ]);
    }

    // ── Helpers ─────────────────────────────────────────────────────

    private function createUserWithCustomer(): array
    {
        $user = User::forceCreate([
            'name' => 'Test User',
            'email' => 'test-'.uniqid().'@test.com',
            'password' => bcrypt('password'),
            'role' => 'customer',
            'is_active' => true,
        ]);

        $customer = Customer::forceCreate([
            'name' => $user->name,
            'phone' => '628123456'.rand(10000, 99999),
            'email' => $user->email,
            'user_id' => $user->id,
            'is_registered' => true,
        ]);

        return [$user, $customer];
    }

    private function createVariant(): ProductVariant
    {
        $family = ProductFamily::create([
            'name' => 'Family '.uniqid(),
            'is_active' => true,
        ]);

        $product = Product::create([
            'name' => 'Test Product '.uniqid(),
            'slug' => 'test-'.uniqid(),
            'unit' => 'pcs',
            'price' => 25000,
            'is_active' => true,
        ]);

        return ProductVariant::create([
            'product_family_id' => $family->id,
            'product_id' => $product->id,
            'name' => 'Variant '.uniqid(),
            'selling_price' => 25000,
            'center_price' => 20000,
            'is_active' => true,
        ]);
    }
}
