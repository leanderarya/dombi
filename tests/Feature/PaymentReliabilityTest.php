<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Services\DokuService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PaymentReliabilityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'doku.client_id' => 'test-client',
            'doku.api_key' => 'test-key',
            'doku.base_url' => 'https://api-sandbox.doku.com',
        ]);
    }

    public function test_check_status_retries_on_transient_failure_then_succeeds(): void
    {
        Http::fake([
            'api-sandbox.doku.com/checkout/v1/payment/*' => Http::sequence()
                ->push('', 503)
                ->push(['transaction' => ['status' => 'SUCCESS']], 200),
        ]);

        $order = Order::factory()->create(['doku_order_id' => 'INV-RETRY', 'payment_status' => 'pending']);
        $result = app(DokuService::class)->checkStatus($order);

        $this->assertNotNull($result);
        $this->assertSame('SUCCESS', $result['transaction']['status']);
    }

    public function test_check_status_returns_null_after_max_retries_exhausted(): void
    {
        Http::fake([
            'api-sandbox.doku.com/checkout/v1/payment/*' => Http::response('', 500),
        ]);

        $order = Order::factory()->create(['doku_order_id' => 'INV-FAIL', 'payment_status' => 'pending']);
        $this->assertNull(app(DokuService::class)->checkStatus($order));
    }
}
