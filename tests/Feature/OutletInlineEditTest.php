<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OutletInlineEditTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected Outlet $outlet;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['role' => 'owner']);
        $this->outlet = Outlet::factory()->create([
            'status' => 'active',
            'name' => 'Original Name',
            'phone' => '08123456789',
        ]);
    }

    public function test_owner_can_update_outlet_name_via_patch(): void
    {
        $this->actingAs($this->owner)
            ->patch(route('owner.outlets.update', $this->outlet), [
                'name' => 'Updated Outlet Name',
            ])
            ->assertRedirect();

        $this->assertEquals('Updated Outlet Name', $this->outlet->fresh()->name);
        $this->assertEquals('08123456789', $this->outlet->fresh()->phone);
    }

    public function test_owner_can_update_outlet_location_via_patch(): void
    {
        $this->actingAs($this->owner)
            ->patch(route('owner.outlets.update', $this->outlet), [
                'latitude' => -7.0051,
                'longitude' => 110.4381,
                'kelurahan' => 'Test Kelurahan',
                'kecamatan' => 'Test Kecamatan',
            ]);

        $outlet = $this->outlet->fresh();
        $this->assertEquals(-7.0051, (float) $outlet->latitude);
        $this->assertEquals(110.4381, (float) $outlet->longitude);
    }

    public function test_non_owner_cannot_update_outlet(): void
    {
        $nonOwner = User::factory()->create(['role' => 'outlet']);

        $this->actingAs($nonOwner)
            ->patch(route('owner.outlets.update', $this->outlet), [
                'name' => 'Hacked Name',
            ])
            ->assertRedirect();

        $this->assertEquals('Original Name', $this->outlet->fresh()->name);
    }

    public function test_partial_update_without_field_skips_validation(): void
    {
        $this->actingAs($this->owner)
            ->patch(route('owner.outlets.update', $this->outlet), [
                'phone' => '08111111111',
            ])
            ->assertRedirect();

        $this->assertEquals('Original Name', $this->outlet->fresh()->name);
        $this->assertEquals('08111111111', $this->outlet->fresh()->phone);
    }

    public function test_partial_update_with_empty_name_fails_when_name_is_sent(): void
    {
        $this->actingAs($this->owner)
            ->patch(route('owner.outlets.update', $this->outlet), [
                'name' => '',
            ])
            ->assertSessionHasErrors(['name']);
    }

    public function test_audit_log_created_on_partial_update(): void
    {
        $this->actingAs($this->owner)
            ->patch(route('owner.outlets.update', $this->outlet), [
                'name' => 'Audit Test Name',
            ]);

        $this->assertDatabaseHas('outlet_audit_logs', [
            'outlet_id' => $this->outlet->id,
            'field' => 'name',
        ]);
    }
}
