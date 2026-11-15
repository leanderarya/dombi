<?php

namespace Tests\Feature;

use App\Models\PaymentWebhookLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;
use Tests\WithTestOutlet;

/**
 * Focused contract for the maintenance-mode exceptions declared in
 * bootstrap/app.php (`$middleware->preventRequestsDuringMaintenance`).
 *
 * These tests drive the real Laravel maintenance mode (file driver) and assert
 * what is and is not reachable while the application is down. They do not prove
 * anything about the deploy window: the exceptions only apply once Laravel can
 * bootstrap and evaluate middleware.
 */
class MaintenanceModeExceptionsTest extends TestCase
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
        // Never leave the suite (or a developer machine) in maintenance mode.
        Artisan::call('up');

        parent::tearDown();
    }

    private function down(): void
    {
        Artisan::call('down');

        $this->assertTrue(
            app()->isDownForMaintenance(),
            'Expected the application to be in maintenance mode for this assertion.'
        );
    }

    private function signed(string $requestId, string $body): array
    {
        $timestamp = (string) time();
        $signature = base64_encode(hash_hmac('sha256', $requestId.$timestamp.$body, config('doku.api_key'), true));

        return [
            'HTTP_Request-Id' => $requestId,
            'HTTP_Request-Timestamp' => $timestamp,
            'HTTP_Signature' => $signature,
            'HTTP_Client-Id' => config('doku.client_id'),
            'CONTENT_TYPE' => 'application/json',
        ];
    }

    public function test_ordinary_customer_request_is_rejected_while_down(): void
    {
        $this->down();

        $this->get('/')->assertStatus(503);
        $this->post('/customer/checkout', [])->assertStatus(503);
    }

    public function test_health_endpoint_remains_reachable_while_down(): void
    {
        $this->down();

        $response = $this->get('/up');

        $response->assertOk();
    }

    public function test_doku_notify_route_is_reachable_while_down_but_never_false_acks(): void
    {
        $this->down();

        $body = json_encode([
            'order' => ['invoice_number' => 'DMB1'.str_repeat('M', 24)],
            'transaction' => ['status' => 'SUCCESS'],
        ], JSON_THROW_ON_ERROR);

        // No Request-Id header: the ingress must reject it, and crucially this
        // must not be a 2xx merely because the route is exempt from maintenance.
        $response = $this->call('POST', route('doku.notify'), [], [], [], ['CONTENT_TYPE' => 'application/json'], $body);

        $this->assertNotSame(200, $response->getStatusCode());
        $this->assertNotSame(202, $response->getStatusCode());
        $this->assertSame(0, PaymentWebhookLog::query()->count());
    }

    public function test_doku_notify_route_is_not_swallowed_by_maintenance(): void
    {
        $this->down();

        // An invalid request reaching the controller proves the route was
        // actually executed rather than short-circuited by the 503 template.
        $response = $this->call('POST', route('doku.notify'), [], [], [], ['CONTENT_TYPE' => 'application/json'], '{}');

        $this->assertNotSame(503, $response->getStatusCode());
        $this->assertSame(400, $response->getStatusCode());
    }

    public function test_doku_redirect_route_is_reachable_while_down(): void
    {
        $this->down();

        $response = $this->get(route('doku.redirect'));

        $this->assertNotSame(503, $response->getStatusCode());
        $this->assertTrue($response->isRedirect());
    }

    public function test_wildcard_free_scope_does_not_reopen_unrelated_routes(): void
    {
        $this->down();

        // The exception list is exact-match, so neighbouring paths stay closed.
        // `/payment/doku/other` has no route, but maintenance runs first, so it
        // must still be the maintenance response rather than a 404 — proving the
        // exemption did not widen into `/payment/doku/*`.
        $this->get('/payment/doku/other')->assertStatus(503);
        $this->get('/payments/doku/notify')->assertStatus(503);
        $this->get('/payment/doku/notify/extra')->assertStatus(503);
        $this->get('/payment/doku')->assertStatus(503);
    }

    public function test_maintenance_off_leaves_customer_admission_behaviour_unchanged(): void
    {
        config(['admission.customer_checkout' => 'open']);

        $this->assertFalse(app()->isDownForMaintenance());
        $this->get('/up')->assertOk();

        // Gate is open by default, so the route is not short-circuited by the
        // admission middleware; a validation failure (not 503) proves it ran.
        $response = $this->post('/customer/checkout', []);
        $this->assertNotSame(503, $response->getStatusCode());
    }
}
