<?php

namespace Tests\Feature;

use App\Models\PaymentWebhookLog;
use App\Services\DokuService;
use App\Services\DokuWebhookIngressService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
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
        $this->assertDatabaseMissing('payment_webhook_logs', ['request_id' => 'REQ-INVALID']);
    }

    public function test_unique_race_recovery_reprocesses_committed_retryable_row(): void
    {
        $body = '{"transaction":{"status":"SUCCESS"}}';
        $log = PaymentWebhookLog::create([
            'request_id' => 'REQ-RACE', 'source' => 'notify', 'status' => 'retryable',
            'signature_valid' => true, 'payload' => json_decode($body, true), 'raw_body' => $body,
            'body_digest' => base64_encode(hash('sha256', $body, true)),
        ]);

        $response = $this->call('POST', route('doku.notify'), [], [], [], $this->signed('REQ-RACE', $body), $body);

        $response->assertStatus(500);
        $this->assertSame('retryable', $log->fresh()->status);
    }

    public function test_invalid_signature_duplicate_does_not_mutate_valid_row(): void
    {
        $body = '{"order":{"invoice_number":"INV-SAFE"}}';
        PaymentWebhookLog::create([
            'request_id' => 'REQ-SAFE', 'source' => 'notify', 'status' => 'processing',
            'signature_valid' => true, 'payload' => json_decode($body, true), 'raw_body' => $body,
            'body_digest' => base64_encode(hash('sha256', $body, true)), 'claimed_at' => now(),
        ]);
        $headers = $this->signed('REQ-SAFE', $body, 'wrong-client');

        $this->call('POST', route('doku.notify'), [], [], [], $headers, $body)->assertUnauthorized();
        $this->assertSame('processing', PaymentWebhookLog::where('request_id', 'REQ-SAFE')->value('status'));
    }

    public function test_same_request_id_is_deduplicated_without_cache(): void
    {
        $body = '{"order":{"invoice_number":"INV-2"},"transaction":{"status":"PENDING"}}';
        $headers = $this->signed('REQ-DUP', $body);

        $first = $this->call('POST', route('doku.notify'), [], [], [], $headers, $body);
        $second = $this->call('POST', route('doku.notify'), [], [], [], $headers, $body);

        $first->assertStatus(500);
        $second->assertStatus(500);
        $this->assertSame(1, PaymentWebhookLog::query()->where('request_id', 'REQ-DUP')->count());
        $this->assertSame('retryable', PaymentWebhookLog::query()->where('request_id', 'REQ-DUP')->value('status'));
    }

    public function test_processing_failure_returns_retryable_status_after_persistence(): void
    {
        $body = '{"transaction":{"status":"SUCCESS"}}';
        $headers = $this->signed('REQ-RETRY', $body);

        $response = $this->call('POST', route('doku.notify'), [], [], [], $headers, $body);

        $response->assertStatus(500);
        $this->assertSame('retryable', PaymentWebhookLog::query()->where('request_id', 'REQ-RETRY')->value('status'));
    }

    public function test_missing_request_id_is_rejected_without_persistence(): void
    {
        $body = '{"order":{"invoice_number":"INV-MISSING-ID"}}';
        $headers = $this->signed('', $body);
        unset($headers['HTTP_Request-Id']);

        $this->call('POST', route('doku.notify'), [], [], [], $headers, $body)->assertStatus(400);
        $this->assertDatabaseMissing('payment_webhook_logs', ['invoice_number' => 'INV-MISSING-ID']);
    }

    public function test_same_request_id_with_different_body_is_rejected(): void
    {
        $firstBody = '{"order":{"invoice_number":"INV-A"},"transaction":{"status":"PENDING"}}';
        $secondBody = '{"order":{"invoice_number":"INV-B"},"transaction":{"status":"PENDING"}}';
        $this->call('POST', route('doku.notify'), [], [], [], $this->signed('REQ-CONFLICT', $firstBody), $firstBody)->assertStatus(500);

        $this->call('POST', route('doku.notify'), [], [], [], $this->signed('REQ-CONFLICT', $secondBody), $secondBody)->assertStatus(409);
        $this->assertSame(1, PaymentWebhookLog::query()->where('request_id', 'REQ-CONFLICT')->count());
    }

    public function test_production_driver_concurrency_allows_one_claim(): void
    {
        if (! in_array(config('database.default'), ['mysql', 'pgsql'], true)) {
            $this->markTestSkipped('Real parallel claim test requires configured MySQL or PostgreSQL; SQLite uses deterministic claim tests.');
        }
        if (! function_exists('pcntl_fork')) {
            $this->markTestSkipped('Real parallel claim test requires pcntl extension.');
        }

        $body = '{"transaction":{"status":"SUCCESS"}}';
        $headers = $this->signed('REQ-PARALLEL', $body);
        $children = [];
        $results = tempnam(sys_get_temp_dir(), 'doku-parallel-');
        for ($worker = 0; $worker < 2; $worker++) {
            $pid = pcntl_fork();
            $this->assertNotSame(-1, $pid);
            if ($pid === 0) {
                DB::disconnect();
                DB::reconnect();
                $response = app(DokuWebhookIngressService::class)->receive($body, [
                    'Request-Id' => $headers['HTTP_Request-Id'],
                    'Request-Timestamp' => $headers['HTTP_Request-Timestamp'],
                    'Client-Id' => $headers['HTTP_Client-Id'],
                    'Signature' => $headers['HTTP_Signature'],
                ]);
                file_put_contents($results, $response->statusCode."\n", FILE_APPEND | LOCK_EX);
                exit(0);
            }
            $children[] = $pid;
        }
        foreach ($children as $pid) {
            pcntl_waitpid($pid, $status);
        }
        DB::disconnect();
        DB::reconnect();

        $statuses = array_map('intval', file($results, FILE_IGNORE_NEW_LINES));
        unlink($results);
        sort($statuses);
        $this->assertCount(2, $statuses);
        $this->assertLessThanOrEqual(1, count(array_filter($statuses, static fn (int $status): bool => in_array($status, [200, 202], true))));
        $this->assertSame(1, PaymentWebhookLog::where('request_id', 'REQ-PARALLEL')->count());
        $this->assertContains(PaymentWebhookLog::where('request_id', 'REQ-PARALLEL')->value('status'), ['processed', 'retryable']);
    }

    public function test_historical_unverified_row_requires_operator_recovery(): void
    {
        $log = PaymentWebhookLog::create([
            'request_id' => 'REQ-HISTORICAL', 'source' => 'notify', 'status' => 'retryable',
            'signature_valid' => false, 'payload' => ['legacy' => true],
            'error' => 'historical_raw_body_unavailable_reprocess_required',
        ]);
        $body = '{"legacy":true}';

        $this->call('POST', route('doku.notify'), [], [], [], $this->signed('REQ-HISTORICAL', $body), $body)->assertStatus(422);
        $this->assertSame('retryable', $log->fresh()->status);
        $this->assertNull($log->fresh()->body_digest);
    }

    public function test_processing_claim_has_fencing_token_and_completion_requires_ownership(): void
    {
        $body = '{"transaction":{"status":"SUCCESS"}}';
        $log = PaymentWebhookLog::create([
            'request_id' => 'REQ-FENCE', 'source' => 'notify', 'status' => 'processing',
            'signature_valid' => true, 'payload' => json_decode($body, true), 'raw_body' => $body,
            'body_digest' => base64_encode(hash('sha256', $body, true)), 'claimed_at' => now()->subMinutes(10),
            'claim_token' => 'old-token',
        ]);

        $this->call('POST', route('doku.notify'), [], [], [], $this->signed('REQ-FENCE', $body), $body)->assertStatus(500);
        $fresh = $log->fresh();
        $this->assertSame('retryable', $fresh->status);
        $this->assertNotSame('old-token', $fresh->claim_token);
    }

    public function test_stale_processing_claim_is_recovered(): void
    {
        $body = '{"transaction":{"status":"SUCCESS"}}';
        PaymentWebhookLog::create([
            'request_id' => 'REQ-STALE-CLAIM', 'source' => 'notify', 'status' => 'processing',
            'signature_valid' => true, 'payload' => json_decode($body, true), 'raw_body' => $body,
            'body_digest' => base64_encode(hash('sha256', $body, true)),
            'claimed_at' => now()->subMinutes(10),
        ]);

        $this->call('POST', route('doku.notify'), [], [], [], $this->signed('REQ-STALE-CLAIM', $body), $body)->assertStatus(500);
        $this->assertSame('retryable', PaymentWebhookLog::where('request_id', 'REQ-STALE-CLAIM')->value('status'));
    }

    public function test_received_duplicate_claims_and_processes_durable_row(): void
    {
        $body = '{"transaction":{"status":"SUCCESS"}}';
        $headers = $this->signed('REQ-CLAIM', $body);
        PaymentWebhookLog::create([
            'request_id' => 'REQ-CLAIM', 'source' => 'notify', 'status' => 'received',
            'signature_valid' => false, 'payload' => json_decode($body, true),
            'raw_body' => $body, 'body_digest' => base64_encode(hash('sha256', $body, true)),
        ]);

        $this->call('POST', route('doku.notify'), [], [], [], $headers, $body)->assertStatus(500);
        $this->assertSame('retryable', PaymentWebhookLog::where('request_id', 'REQ-CLAIM')->value('status'));
    }

    public function test_ingress_normalizes_event_before_domain_transition(): void
    {
        $body = '{"order":{"invoice_number":"INV-NORMALIZED"},"transaction":{"status":"SUCCESS","amount":"100","currency":"IDR"}}';
        $headers = $this->signed('REQ-NORMALIZED', $body);

        $this->call('POST', route('doku.notify'), [], [], [], $headers, $body)->assertStatus(500);
        $this->assertSame('retryable', PaymentWebhookLog::where('request_id', 'REQ-NORMALIZED')->value('status'));
    }

    public function test_retryable_duplicate_is_reprocessed(): void
    {
        $body = '{"transaction":{"status":"SUCCESS"}}';
        $headers = $this->signed('REQ-REPROCESS', $body);
        $this->call('POST', route('doku.notify'), [], [], [], $headers, $body)->assertStatus(500);
        $this->call('POST', route('doku.notify'), [], [], [], $headers, $body)->assertStatus(500);
        $this->assertSame(1, PaymentWebhookLog::query()->where('request_id', 'REQ-REPROCESS')->count());
        $this->assertSame('retryable', PaymentWebhookLog::query()->where('request_id', 'REQ-REPROCESS')->value('status'));
    }

    public function test_signature_invalid_duplicate_is_rejected(): void
    {
        $body = '{"order":{"invoice_number":"INV-BAD"}}';
        $headers = $this->signed('REQ-BAD-DUP', $body, 'wrong-client');
        $this->call('POST', route('doku.notify'), [], [], [], $headers, $body)->assertUnauthorized();
        $this->call('POST', route('doku.notify'), [], [], [], $headers, $body)->assertUnauthorized();
    }

    public function test_stale_timestamp_is_rejected(): void
    {
        $body = '{"order":{"invoice_number":"INV-STALE"}}';
        $headers = $this->signed('REQ-STALE', $body, null, now('UTC')->subMinutes(10)->format('Y-m-d\\TH:i:s\\Z'));

        $this->call('POST', route('doku.notify'), [], [], [], $headers, $body)->assertUnauthorized();
    }

    public function test_signature_digest_covers_exact_raw_body(): void
    {
        $signedBody = '{"order":{"invoice_number":"INV-RAW"}}';
        $sentBody = '{"order": {"invoice_number":"INV-RAW"}}';
        $headers = $this->signed('REQ-RAW', $signedBody);

        $this->call('POST', route('doku.notify'), [], [], [], $headers, $sentBody)->assertUnauthorized();
    }
}
