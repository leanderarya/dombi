<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\User;
use App\Services\OutletProvisioningService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class OwnerOutletManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_outlet_index_exposes_operational_metrics(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outlet = Outlet::create([
            'name' => 'Outlet Tembalang',
            'kelurahan' => 'Tembalang',
            'kecamatan' => 'Tembalang',
            'address' => 'Jl. Tembalang',
            'latitude' => -7.0559000,
            'longitude' => 110.4375000,
            'status' => 'active',
        ]);
        $product = Product::create(['name' => 'Susu 500ml', 'slug' => 'susu-500ml-test', 'unit' => 'botol', 'price' => 25000, 'is_active' => true]);
        OutletInventory::create(['outlet_id' => $outlet->id, 'product_id' => $product->id, 'current_stock' => 1, 'reserved_stock' => 0, 'minimum_stock' => 2]);

        $this->actingAs($owner)
            ->get(route('owner.outlets.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('owner/outlets/index')
                ->has('outlets.data', 1)
                ->where('outlets.data.0.active_orders_count', 0)
                ->where('outlets.data.0.low_stock_count', 1)
                ->where('outlets.data.0.inventory_items_count', 1)
            );
    }

    public function test_owner_can_create_outlet_only_with_map_coordinates_and_region(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);

        $this->actingAs($owner)
            ->post(route('owner.outlets.store'), [
                'name' => 'Outlet Banyumanik',
                'kelurahan' => 'Banyumanik',
                'kecamatan' => 'Banyumanik',
                'address' => 'Jl. Banyumanik',
                'status' => 'active',
            ])
            ->assertSessionHasErrors(['latitude', 'longitude']);

        $this->actingAs($owner)
            ->post(route('owner.outlets.store'), [
                'name' => 'Outlet Banyumanik',
                'kelurahan' => 'Banyumanik',
                'kecamatan' => 'Banyumanik',
                'city' => 'Semarang',
                'province' => 'Jawa Tengah',
                'postal_code' => '50263',
                'address' => 'Jl. Banyumanik',
                'latitude' => -7.0700000,
                'longitude' => 110.4200000,
                'phone' => '08123456789',
                'delivery_radius_km' => 8,
                'prep_estimate_minutes' => 15,
                'status' => 'active',
            ])
            ->assertRedirect(route('owner.outlets.index'))
            ->assertSessionHas('outlet_provisioning');

        $outlet = Outlet::where('name', 'Outlet Banyumanik')->firstOrFail();
        $user = User::where('email', 'outlet-banyumanik@dombi.local')->firstOrFail();

        $this->assertDatabaseHas('outlets', [
            'name' => 'Outlet Banyumanik',
            'city' => 'Semarang',
            'province' => 'Jawa Tengah',
            'postal_code' => '50263',
            'delivery_radius_km' => 8,
            'prep_estimate_minutes' => 15,
            'user_id' => $user->id,
        ]);

        $this->assertSame('outlet', $user->role);
        $this->assertTrue($user->is_active);
        $this->assertTrue($user->must_change_password);
        $this->assertSame($outlet->id, $user->outlet_id);
        $this->assertNotEmpty(session('outlet_provisioning.temporary_password'));
        $this->assertTrue(Hash::check(session('outlet_provisioning.temporary_password'), $user->password));
    }

    public function test_generated_outlet_username_is_unique_and_readable(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        User::factory()->create(['email' => 'outlet-banyumanik@dombi.local', 'role' => 'outlet', 'is_active' => true]);

        $this->actingAs($owner)
            ->post(route('owner.outlets.store'), $this->validOutletPayload(['name' => 'Outlet Banyumanik']))
            ->assertRedirect(route('owner.outlets.index'));

        $this->assertDatabaseHas('users', [
            'email' => 'outlet-banyumanik-2@dombi.local',
            'role' => 'outlet',
            'must_change_password' => true,
        ]);
    }

    public function test_outlet_provisioning_rolls_back_when_account_creation_fails(): void
    {
        User::factory()->create(['email' => 'outlet-conflict@dombi.local', 'role' => 'outlet', 'is_active' => true]);

        $service = new class extends OutletProvisioningService
        {
            public function generateOutletEmail(string $outletName): string
            {
                return 'outlet-conflict@dombi.local';
            }
        };

        $this->expectException(QueryException::class);

        try {
            $service->createOutletWithAccount($this->validOutletPayload(['name' => 'Outlet Conflict']));
        } finally {
            $this->assertDatabaseMissing('outlets', ['name' => 'Outlet Conflict']);
        }
    }

    public function test_outlet_with_temporary_password_must_change_password_before_dashboard(): void
    {
        $outlet = Outlet::create($this->validOutletPayload(['name' => 'Outlet Login']));
        $user = User::factory()->create([
            'role' => 'outlet',
            'is_active' => true,
            'outlet_id' => $outlet->id,
            'must_change_password' => true,
            'password' => Hash::make('DMB-TEST123'),
        ]);
        $outlet->update(['user_id' => $user->id]);

        $this->actingAs($user)
            ->get(route('outlet.dashboard'))
            ->assertRedirect(route('password.change'));

        $this->actingAs($user)
            ->put(route('password.update'), [
                'current_password' => 'DMB-TEST123',
                'password' => 'new-password-123',
                'password_confirmation' => 'new-password-123',
            ])
            ->assertRedirect(route('dashboard'));

        $this->assertFalse($user->fresh()->must_change_password);
    }

    public function test_owner_outlet_detail_page_is_operationally_accessible(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outlet = Outlet::create([
            'name' => 'Outlet Pedurungan',
            'kelurahan' => 'Pedurungan',
            'kecamatan' => 'Pedurungan',
            'address' => 'Jl. Pedurungan',
            'latitude' => -7.0010000,
            'longitude' => 110.4800000,
            'status' => 'active',
        ]);

        $this->actingAs($owner)
            ->get(route('owner.outlets.show', $outlet))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('owner/outlets/show')
                ->where('outlet.id', $outlet->id)
                ->has('inventoryHealth')
                ->has('recentRestocks')
                ->where('activeDeliveriesCount', 0)
            );
    }

    private function validOutletPayload(array $overrides = []): array
    {
        return [
            'name' => 'Outlet Banyumanik',
            'kelurahan' => 'Banyumanik',
            'kecamatan' => 'Banyumanik',
            'city' => 'Semarang',
            'province' => 'Jawa Tengah',
            'postal_code' => '50263',
            'address' => 'Jl. Banyumanik',
            'latitude' => -7.0700000,
            'longitude' => 110.4200000,
            'phone' => '08123456789',
            'delivery_radius_km' => 8,
            'prep_estimate_minutes' => 15,
            'status' => 'active',
            ...$overrides,
        ];
    }
}
