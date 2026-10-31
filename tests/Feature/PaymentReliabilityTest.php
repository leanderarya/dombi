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
        $invoiceNumber = $this->newInvoiceNumber('retry-success');
        Http::fake([
            'api-sandbox.doku.com/orders/v1/status/*' => Http::sequence()
                ->push('', 503)
                ->push(['transaction' => ['status' => 'SUCCESS']], 200),
        ]);

        $order = Order::factory()->create(['doku_order_id' => $invoiceNumber, 'payment_status' => 'pending']);
        $result = app(DokuService::class)->checkStatus($order);

        $this->assertNotNull($result);
        $this->assertSame('SUCCESS', $result['transaction']['status']);
    }

    public function test_check_status_returns_null_after_max_retries_exhausted(): void
    {
        $invoiceNumber = $this->newInvoiceNumber('retry-exhausted');
        Http::fake([
            'api-sandbox.doku.com/orders/v1/status/*' => Http::response('', 500),
        ]);

        $order = Order::factory()->create(['doku_order_id' => $invoiceNumber, 'payment_status' => 'pending']);
        $this->assertNull(app(DokuService::class)->checkStatus($order));
    }

    private function newInvoiceNumber(string $seed): string
    {
        return 'DMB1'.strtoupper(substr(hash('sha256', $seed), 0, 24));
    }
}
