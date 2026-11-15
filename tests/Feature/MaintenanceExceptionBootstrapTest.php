<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;
use Tests\WithTestOutlet;

/**
 * Maintenance-mode exceptions on the main-lineage bootstrap release.
 *
 * `bootstrap/app.php` declares exactly three exempt paths. These tests prove the
 * exemption set is honoured and that nothing else reopens while the application
 * is down. They are the only coverage the bootstrap release adds beyond the
 * admission gate itself, because the deployed code had no maintenance
 * exceptions at all.
 */
class MaintenanceExceptionBootstrapTest extends TestCase
{
    use RefreshDatabase;
    use WithTestOutlet;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'doku.client_id' => 'test-client-id',
            'doku.api_key' => 'test-api-key',
            'doku.webhook_max_age_seconds' => 300,
        ]);

        $this->withOutletSession();
    }

    protected function tearDown(): void
    {
        // Never leave the suite in maintenance mode.
        Artisan::call('up');

        parent::tearDown();
    }

    private function down(): void
    {
        Artisan::call('down');
        $this->assertTrue(app()->isDownForMaintenance());
    }

    public function test_ordinary_requests_are_rejected_while_down(): void
    {
        $this->down();

        $this->get('/')->assertStatus(503);
        $this->post('/customer/checkout', [])->assertStatus(503);
    }

    public function test_health_endpoint_stays_reachable_while_down(): void
    {
        $this->down();

        $this->get('/up')->assertOk();
    }

    public function test_doku_notify_is_not_swallowed_by_maintenance(): void
    {
        $this->down();

        // Reaching the controller proves the route executed rather than being
        // short-circuited by the maintenance template.
        $response = $this->call('POST', route('doku.notify'), [], [], [],
            ['CONTENT_TYPE' => 'application/json'], '{}');

        $this->assertNotSame(503, $response->getStatusCode());
        $this->assertSame(400, $response->getStatusCode());
    }

    public function test_doku_redirect_stays_reachable_while_down(): void
    {
        $this->down();

        $response = $this->get(route('doku.redirect'));

        $this->assertNotSame(503, $response->getStatusCode());
        $this->assertTrue($response->isRedirect());
    }

    public function test_neighbouring_paths_are_not_exempted(): void
    {
        $this->down();

        // Exact-path matching only: no `/payment/doku/*` or `/customer/*` widening.
        $this->get('/payment/doku/other')->assertStatus(503);
        $this->get('/payments/doku/notify')->assertStatus(503);
        $this->get('/payment/doku/notify/extra')->assertStatus(503);
        $this->get('/customer/orders/1/payment-status')->assertStatus(503);
    }

    public function test_restoration_returns_to_normal_service(): void
    {
        $this->down();
        Artisan::call('up');

        $this->assertFalse(app()->isDownForMaintenance());
        $this->get('/up')->assertOk();
    }
}
