<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class SystemStatusAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_access_detailed_system_status(): void
    {
        $this->getJson(route('system.status'))->assertUnauthorized();
    }

    public function test_non_owner_cannot_access_detailed_system_status(): void
    {
        $outlet = User::factory()->create([
            'role' => 'outlet',
            'is_active' => true,
            'must_change_password' => false,
        ]);

        $this->actingAs($outlet)
            ->getJson(route('system.status'))
            ->assertRedirect('/outlet/dashboard');
    }

    public function test_owner_with_pending_password_change_cannot_retrieve_status_metadata(): void
    {
        $owner = User::factory()->create([
            'role' => 'owner',
            'is_active' => true,
            'must_change_password' => true,
        ]);

        $response = $this->actingAs($owner)->getJson(route('system.status'));

        $response->assertRedirect(route('password.change'));
        $response->assertDontSee('database');
        $response->assertDontSee('scheduler');
    }

    public function test_owner_who_changed_password_can_access_system_status(): void
    {
        $owner = User::factory()->create([
            'role' => 'owner',
            'is_active' => true,
            'must_change_password' => false,
        ]);

        $this->actingAs($owner)
            ->getJson(route('system.status'))
            ->assertOk()
            ->assertJsonStructure([
                'app' => ['name', 'version', 'env', 'debug', 'url'],
                'php',
                'laravel',
                'database' => ['connected', 'driver'],
                'cache' => ['connected', 'driver'],
                'queue' => ['driver', 'size'],
                'scheduler' => ['healthy', 'last_heartbeat', 'minutes_since_last_beat'],
                'storage' => ['writable', 'disk_free_bytes'],
            ]);
    }

    public function test_public_health_routes_remain_available_to_guests(): void
    {
        $this->getJson('/api/health')
            ->assertOk()
            ->assertJsonPath('status', 'healthy');

        $this->get('/up')->assertOk();
    }

    public function test_no_public_password_reset_route_is_registered(): void
    {
        $this->assertFalse(Route::has('password.request'));
        $this->assertFalse(Route::has('password.email'));
        $this->assertFalse(Route::has('password.store'));
    }
}
