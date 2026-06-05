<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DevRoleSwitcherTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Force local environment for dev routes
        $this->app['env'] = 'local';
        config(['app.env' => 'local']);
    }

    // ─── LOCAL ENVIRONMENT TESTS ──────────────────────────────────────

    public function test_switch_to_owner_in_local(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);

        $this->get('/dev/switch/owner')
            ->assertRedirect(route('dashboard'));

        $this->assertAuthenticatedAs($owner);
    }

    public function test_switch_to_outlet_in_local(): void
    {
        $outlet = User::factory()->create(['role' => 'outlet', 'is_active' => true]);

        $this->get('/dev/switch/outlet')
            ->assertRedirect(route('dashboard'));

        $this->assertAuthenticatedAs($outlet);
    }

    public function test_switch_to_courier_in_local(): void
    {
        $courier = User::factory()->create(['role' => 'courier', 'is_active' => true]);

        $this->get('/dev/switch/courier')
            ->assertRedirect(route('dashboard'));

        $this->assertAuthenticatedAs($courier);
    }

    public function test_switch_to_customer_in_local(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'is_active' => true]);

        $this->get('/dev/switch/customer')
            ->assertRedirect(route('dashboard'));

        $this->assertAuthenticatedAs($customer);
    }

    public function test_switch_to_guest_in_local(): void
    {
        $user = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $this->actingAs($user);

        $this->get('/dev/switch/guest')
            ->assertRedirect('/');

        $this->assertGuest();
    }

    public function test_switch_returns_error_when_no_user_found(): void
    {
        // No owner exists
        $this->get('/dev/switch/owner')
            ->assertRedirect();
    }

    // ─── PRODUCTION ENVIRONMENT TESTS ─────────────────────────────────

    public function test_dev_routes_return_404_in_production(): void
    {
        // Force production environment
        $this->app['env'] = 'production';
        config(['app.env' => 'production']);

        // Re-register routes for production (routes are registered at boot time)
        $this->app->boot();

        $routes = [
            '/dev/switch/owner',
            '/dev/switch/outlet',
            '/dev/switch/courier',
            '/dev/switch/customer',
            '/dev/switch/guest',
        ];

        foreach ($routes as $route) {
            $this->get($route)->assertNotFound();
        }
    }

    // ─── AUTHENTICATION STATE TESTS ───────────────────────────────────

    public function test_switch_replaces_current_session(): void
    {
        $user1 = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $user2 = User::factory()->create(['role' => 'courier', 'is_active' => true]);

        $this->actingAs($user1);
        $this->assertAuthenticatedAs($user1);

        $this->get('/dev/switch/courier');
        $this->assertAuthenticatedAs($user2);
    }

    public function test_switch_to_guest_clears_session(): void
    {
        $user = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $this->actingAs($user);

        $this->get('/dev/switch/guest');
        $this->assertGuest();
    }

    // ─── SHARED DATA TESTS ────────────────────────────────────────────

    public function test_dev_data_shared_in_local(): void
    {
        $this->app['env'] = 'local';
        config(['app.env' => 'local']);

        $user = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $this->actingAs($user);

        $response = $this->get('/owner/dashboard');
        $response->assertSuccessful();

        $page = $response->viewData('page');
        $this->assertTrue($page['props']['dev']['isLocal']);
        $this->assertSame('local', $page['props']['dev']['env']);
        $this->assertSame('owner', $page['props']['dev']['currentRole']);
    }
}
