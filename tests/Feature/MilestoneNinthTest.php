<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\OperationalLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class MilestoneNinthTest extends TestCase
{
    use RefreshDatabase;

    // ─── HEALTH & SYSTEM ENDPOINTS ───────────────────────────────────

    public function test_health_endpoint_returns_healthy(): void
    {
        $this->get('/api/health')
            ->assertOk()
            ->assertJson(['status' => 'healthy'])
            ->assertJsonStructure(['status', 'checks', 'version', 'timestamp']);
    }

    public function test_version_endpoint_returns_version(): void
    {
        $this->get('/api/version')
            ->assertOk()
            ->assertJsonStructure(['version', 'build']);
    }

    public function test_status_endpoint_requires_owner_auth(): void
    {
        $this->get('/api/status')->assertRedirect('/login');

        $customer = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $this->actingAs($customer)->get('/api/status')->assertRedirect('/customer/home');

        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $this->actingAs($owner)->get('/api/status')
            ->assertOk()
            ->assertJsonStructure(['app', 'php', 'laravel', 'database', 'cache', 'queue', 'storage']);
    }

    // ─── RATE LIMITING ───────────────────────────────────────────────

    public function test_login_is_rate_limited(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->post('/login', ['email' => 'fake@test.com', 'password' => 'wrong']);
        }

        $this->post('/login', ['email' => 'fake@test.com', 'password' => 'wrong'])
            ->assertStatus(429);
    }

    public function test_export_is_rate_limited(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);

        for ($i = 0; $i < 5; $i++) {
            $this->actingAs($owner)->get('/owner/reports/export-csv');
        }

        $this->actingAs($owner)->get('/owner/reports/export-csv')
            ->assertStatus(429);
    }

    // ─── AUTHORIZATION ───────────────────────────────────────────────

    public function test_outlet_cannot_access_owner_routes(): void
    {
        $outlet = User::factory()->create(['role' => 'outlet', 'is_active' => true]);

        $this->actingAs($outlet)->get('/owner/dashboard')->assertRedirect('/outlet/dashboard');
        $this->actingAs($outlet)->get('/owner/reports')->assertRedirect('/outlet/dashboard');
        $this->actingAs($outlet)->get('/owner/stock-movements')->assertRedirect('/outlet/dashboard');
    }

    public function test_courier_cannot_access_outlet_routes(): void
    {
        $courier = User::factory()->create(['role' => 'courier', 'is_active' => true]);

        $this->actingAs($courier)->get('/outlet/dashboard')->assertRedirect('/courier/dashboard');
        $this->actingAs($courier)->get('/outlet/orders')->assertRedirect('/courier/dashboard');
    }

    public function test_inactive_user_is_blocked(): void
    {
        $user = User::factory()->create(['role' => 'owner', 'is_active' => false]);

        $this->actingAs($user)->get('/owner/dashboard')->assertForbidden();
    }

    // ─── OPERATIONAL LOGGING ─────────────────────────────────────────

    public function test_operational_log_helper_writes_to_channel(): void
    {
        Log::shouldReceive('channel')
            ->with('operational')
            ->andReturnSelf()
            ->times(3);

        Log::shouldReceive('info')->once();
        Log::shouldReceive('warning')->once();
        Log::shouldReceive('error')->once();

        OperationalLog::stockAdjustment(1, 1, 10, 15, 'test');
        OperationalLog::deliveryFailed(1, 1, 1, 'test reason');
        OperationalLog::inventoryException(1, 1, 'current_stock', 5, 2);
    }

    // ─── APP VERSION ─────────────────────────────────────────────────

    public function test_app_version_is_shared_via_inertia(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);

        $this->actingAs($owner)
            ->get('/owner/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->has('appVersion'));
    }

    // ─── CONFIG ──────────────────────────────────────────────────────

    public function test_app_config_has_version(): void
    {
        $this->assertNotNull(config('app.version'));
    }

    public function test_logging_config_has_operational_channel(): void
    {
        $this->assertNotNull(config('logging.channels.operational'));
        $this->assertSame('daily', config('logging.channels.operational.driver'));
    }

    // ─── PWA VERSION ENDPOINT ────────────────────────────────────────

    public function test_version_endpoint_includes_build_timestamp(): void
    {
        $response = $this->get('/api/version')->assertOk();
        $data = $response->json();

        $this->assertArrayHasKey('version', $data);
        $this->assertArrayHasKey('build', $data);
    }

    // ─── DOCUMENTATION ───────────────────────────────────────────────

    public function test_deployment_docs_exist(): void
    {
        $this->assertFileExists(base_path('docs/DEPLOYMENT.md'));
        $content = file_get_contents(base_path('docs/DEPLOYMENT.md'));
        $this->assertStringContainsString('Production Setup', $content);
        $this->assertStringContainsString('Rollback', $content);
        $this->assertStringContainsString('Health Check', $content);
    }
}
