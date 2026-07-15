<?php

namespace Tests\Unit;

use App\Services\DokuService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class WebhookSecurityTest extends TestCase
{
    use RefreshDatabase;

    private function makeDoku(): DokuService
    {
        $doku = app(DokuService::class);
        $doku->refreshKeysForTest(Config::get('doku.client_id'), Config::get('doku.api_key'));
        return $doku;
    }

    public function test_webhook_rejected_when_timestamp_older_than_5_minutes(): void
    {
        $doku = $this->makeDoku();
        $oldTs = now('UTC')->subMinutes(10)->format('Y-m-d\TH:i:s\Z');
        $body = json_encode(['order' => ['invoice_number' => 'X']]);
        $reqId = 'REQ-1';
        $sig = $doku->signForTest($reqId, $oldTs, '/payment/doku/notify', $body);

        $this->assertFalse($doku->verifySignature(['timestamp' => $oldTs], $reqId, $body, $oldTs, $sig));
    }

    public function test_webhook_rejected_when_client_id_mismatch(): void
    {
        $doku = $this->makeDoku();
        $ts = now('UTC')->format('Y-m-d\TH:i:s\Z');
        $body = json_encode(['order' => ['invoice_number' => 'X']]);
        $reqId = 'REQ-2';
        $sig = $doku->signForTest($reqId, $ts, '/payment/doku/notify', $body);

        $this->assertFalse($doku->verifySignature(['timestamp' => $ts], $reqId, $body, $ts, $sig, 'wrong-client'));
    }

    public function test_valid_fresh_signature_with_correct_client_id_passes(): void
    {
        $doku = $this->makeDoku();
        $ts = now('UTC')->format('Y-m-d\TH:i:s\Z');
        $body = json_encode(['order' => ['invoice_number' => 'X']]);
        $reqId = 'REQ-3';
        $sig = $doku->signForTest($reqId, $ts, '/payment/doku/notify', $body);

        $this->assertTrue($doku->verifySignature(['timestamp' => $ts], $reqId, $body, $ts, $sig, Config::get('doku.client_id')));
    }
}
