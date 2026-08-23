<?php

namespace Tests\Feature;

use App\Models\PaymentWebhookLog;
use App\Services\DokuService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class DokuWebhookIngressTest extends TestCase
{
    use RefreshDatabase;

    private function signed(string $requestId, string $body, ?string $clientId = null, ?string $timestamp = null): array
    {
        $doku = app(DokuService::class);
        $doku->refreshKeysForTest(Config::get('doku.client_id'), Config::get('doku.api_key'));
        $timestamp ??= now('UTC')->format('Y-m-d\\TH:i:s\\Z');

        return [
            'HTTP_Client-Id' => $clientId ?? Config::get('doku.client_id'),
            'HTTP_Request-Id' => $requestId,
            'HTTP_Request-Timestamp' => $timestamp,
            'HTTP_Signature' => $doku->signForTest($requestId, $timestamp, '/payment/doku/notify', $body),
        ];
    }

    public function test_invalid_transport_is_rejected_and_raw_body_is_persisted(): void
    {
        $body = '{"order":{"invoice_number":"INV-1"}}';
        $headers = $this->signed('REQ-INVALID', $body, 'wrong-client');

        $response = $this->postJson(route('doku.notify'), json_decode($body, true), $headers);

        $response->assertUnauthorized();
        $this->assertSame($body, PaymentWebhookLog::query()->where('request_id', 'REQ-INVALID')->firstOrFail()->raw_body);
        $this->assertSame('signature_invalid', PaymentWebhookLog::query()->where('request_id', 'REQ-INVALID')->first()->status);
    }

    public function test_same_request_id_is_deduplicated_without_cache(): void
    {
        $body = '{"order":{"invoice_number":"INV-2"},"transaction":{"status":"PENDING"}}';
        $headers = $this->signed('REQ-DUP', $body);

        $first = $this->call('POST', route('doku.notify'), [], [], [], $headers, $body);
        $second = $this->call('POST', route('doku.notify'), [], [], [], $headers, $body);

        $first->assertOk();
        $second->assertOk();
        $this->assertSame(1, PaymentWebhookLog::query()->where('request_id', 'REQ-DUP')->count());
        $this->assertSame('processed', PaymentWebhookLog::query()->where('request_id', 'REQ-DUP')->value('status'));
    }

    public function test_processing_failure_returns_retryable_status_after_persistence(): void
    {
        $body = '{"transaction":{"status":"SUCCESS"}}';
        $headers = $this->signed('REQ-RETRY', $body);

        $response = $this->call('POST', route('doku.notify'), [], [], [], $headers, $body);

        $response->assertStatus(500);
        $this->assertSame('retryable', PaymentWebhookLog::query()->where('request_id', 'REQ-RETRY')->value('status'));
    }
}
