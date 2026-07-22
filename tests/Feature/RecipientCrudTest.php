<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\Recipient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RecipientCrudTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Customer $customer;

    private ProductVariant $variant;

    private Outlet $outlet;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create([
            'role' => 'customer',
            'is_active' => true,
            'name' => 'Budi Santoso',
        ]);

        $this->customer = Customer::create([
            'name' => 'Budi Santoso',
            'phone' => '6281234567890',
            'user_id' => $this->user->id,
            'is_registered' => true,
        ]);

        $family = ProductFamily::create([
            'name' => 'Domilk',
            'brand' => 'Domilk',
            'is_active' => true,
        ]);

        $product = Product::create([
            'name' => 'Domilk Premium',
            'slug' => 'domilk-premium-recipient-crud-'.uniqid(),
            'unit' => 'liter',
            'price' => 18000,
            'selling_price' => 25000,
            'center_price' => 18000,
            'is_active' => true,
        ]);

        $this->variant = ProductVariant::create([
            'product_family_id' => $family->id,
            'product_id' => $product->id,
            'name' => 'Coffee 1L',
            'flavor' => 'Coffee',
            'size' => '1L',
            'center_price' => 18000,
            'selling_price' => 25000,
            'is_active' => true,
        ]);

        $this->outlet = Outlet::create([
            'name' => 'Outlet Test',
            'kelurahan' => 'Sumurboto',
            'kecamatan' => 'Banyumanik',
            'address' => 'Jl. Banyumanik',
            'latitude' => -7.0731000,
            'longitude' => 110.4216000,
            'status' => 'active',
        ]);

        OutletInventory::create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $product->id,
            'product_variant_id' => $this->variant->id,
            'current_stock' => 50,
            'reserved_stock' => 0,
            'minimum_stock' => 5,
        ]);
    }

    public function test_recipient_can_be_saved_after_order_optin(): void
    {
        $this->actingAs($this->user);

        $this->session([
            'checkout.cart' => [['product_variant_id' => $this->variant->id, 'quantity' => 2]],
            'checkout.fulfillment' => ['fulfillment_type' => 'delivery_dombi'],
        ]);

        $this->post('/customer/checkout/customer', [
            'customer_name' => 'Budi Santoso',
            'phone_number' => '6281234567890',
            'recipient_name' => 'Siti Rahayu',
            'recipient_phone' => '6289876543210',
            'save_recipient' => true,
            'latitude' => -7.0500000,
            'longitude' => 110.4300000,
            'address_line' => 'Jl. Test',
        ])->assertRedirect();

        $this->assertDatabaseCount('recipients', 1);

        $recipient = Recipient::first();
        $this->assertSame($this->customer->id, $recipient->customer_id);
        $this->assertSame('Siti Rahayu', $recipient->name);
        $this->assertSame('6289876543210', $recipient->phone);
        $this->assertTrue($recipient->is_default);
    }

    public function test_recipient_not_saved_without_optin(): void
    {
        $this->actingAs($this->user);

        $this->session([
            'checkout.cart' => [['product_variant_id' => $this->variant->id, 'quantity' => 2]],
            'checkout.fulfillment' => ['fulfillment_type' => 'delivery_dombi'],
        ]);

        $this->post('/customer/checkout/customer', [
            'customer_name' => 'Budi Santoso',
            'phone_number' => '6281234567890',
            'recipient_name' => 'Siti Rahayu',
            'recipient_phone' => '6289876543210',
            'latitude' => -7.0500000,
            'longitude' => 110.4300000,
            'address_line' => 'Jl. Test',
        ])->assertRedirect();

        $this->assertDatabaseCount('recipients', 0);
    }

    public function test_saved_recipient_appears_in_selector(): void
    {
        Recipient::create([
            'customer_id' => $this->customer->id,
            'label' => 'Rumah Ibu',
            'name' => 'Ibu Santoso',
            'phone' => '6281111222333',
            'is_default' => false,
        ]);

        $this->actingAs($this->user);

        $this->session([
            'checkout.cart' => [['product_variant_id' => $this->variant->id, 'quantity' => 2]],
            'checkout.fulfillment' => ['fulfillment_type' => 'delivery_dombi'],
        ]);

        $this->get('/customer/checkout/customer')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('savedRecipients', 1)
                ->where('savedRecipients.0.label', 'Rumah Ibu')
                ->where('savedRecipients.0.name', 'Ibu Santoso')
            );
    }

    public function test_default_recipient_is_account_owner(): void
    {
        $this->actingAs($this->user);

        $this->session([
            'checkout.cart' => [['product_variant_id' => $this->variant->id, 'quantity' => 2]],
            'checkout.fulfillment' => ['fulfillment_type' => 'delivery_dombi'],
        ]);

        $this->get('/customer/checkout/customer')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('recipientDefaults.name', 'Budi Santoso')
                ->where('recipientDefaults.phone', '6281234567890')
            );
    }

    public function test_recipient_belongs_to_customer_only(): void
    {
        $otherUser = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $otherCustomer = Customer::create([
            'name' => 'Other User',
            'phone' => '6285556667777',
            'user_id' => $otherUser->id,
            'is_registered' => true,
        ]);

        $recipient = Recipient::create([
            'customer_id' => $otherCustomer->id,
            'label' => 'Rumah Other',
            'name' => 'Other Recipient',
            'phone' => '6285556667777',
        ]);

        $this->actingAs($this->user);

        $this->putJson("/customer/recipients/{$recipient->id}", [
            'name' => 'Hacked Name',
        ])->assertForbidden();

        $this->deleteJson("/customer/recipients/{$recipient->id}")
            ->assertForbidden();

        $recipient->refresh();
        $this->assertSame('Other Recipient', $recipient->name);
    }

    public function test_recipient_store_via_api(): void
    {
        $this->actingAs($this->user);

        $this->postJson('/customer/recipients', [
            'label' => 'Kantor',
            'name' => 'Pak RT',
            'phone' => '6281234500000',
        ])->assertCreated()
            ->assertJsonPath('recipient.name', 'Pak RT');

        $this->assertDatabaseHas('recipients', [
            'customer_id' => $this->customer->id,
            'label' => 'Kantor',
            'name' => 'Pak RT',
        ]);
    }

    public function test_recipient_update_via_api(): void
    {
        $recipient = Recipient::create([
            'customer_id' => $this->customer->id,
            'name' => 'Old Name',
            'phone' => '6281234500000',
        ]);

        $this->actingAs($this->user);

        $this->putJson("/customer/recipients/{$recipient->id}", [
            'name' => 'New Name',
        ])->assertOk();

        $recipient->refresh();
        $this->assertSame('New Name', $recipient->name);
    }

    public function test_recipient_delete_via_api(): void
    {
        $recipient = Recipient::create([
            'customer_id' => $this->customer->id,
            'name' => 'To Delete',
            'phone' => '6281234500000',
        ]);

        $this->actingAs($this->user);

        $this->deleteJson("/customer/recipients/{$recipient->id}")
            ->assertOk();

        $this->assertDatabaseCount('recipients', 0);
    }

    public function test_pickup_flow_unchanged(): void
    {
        $this->actingAs($this->user);

        $this->get('/customer/home')
            ->assertOk();
    }
}
