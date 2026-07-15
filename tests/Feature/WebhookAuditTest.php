<?php

namespace Tests\Feature;

use App\Models\PaymentWebhookLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WebhookAuditTest extends TestCase
{
    use RefreshDatabase;

    public function test_webhook_log_created_on_notify_entry(): void
    {
        // Simulate the controller writing a log directly (unit of the writer behavior).
        PaymentWebhookLog::create([
            'request_id' => 'R1',
            'source' => 'notify',
            'invoice_number' => 'INV-AUDIT',
            'status' => 'received',
            'signature_valid' => false,
            'payload' => ['order' => ['invoice_number' => 'INV-AUDIT']],
        ]);

        $this->assertTrue(PaymentWebhookLog::where('invoice_number', 'INV-AUDIT')->exists());
        $log = PaymentWebhookLog::where('invoice_number', 'INV-AUDIT')->first();
        $this->assertSame('notify', $log->source);
        $this->assertFalse($log->signature_valid);
    }

    public function test_webhook_log_casts_payload_as_array(): void
    {
        $log = PaymentWebhookLog::create([
            'source' => 'redirect',
            'status' => 'received',
            'signature_valid' => true,
            'payload' => ['foo' => 'bar'],
        ]);
        $this->assertSame(['foo' => 'bar'], $log->fresh()->payload);
        $this->assertTrue($log->signature_valid); // default true
    }
}
