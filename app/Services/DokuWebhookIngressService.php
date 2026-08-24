<?php

namespace App\Services;

use App\Models\PaymentAttempt;
use App\Models\PaymentWebhookLog;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final class DokuWebhookIngressService
{
    public function __construct(private readonly DokuService $doku) {}

    public function receive(string $rawBody, array $headers): WebhookReceipt
    {
        $payload = json_decode($rawBody, true) ?? [];
        $headers = array_change_key_case($headers, CASE_LOWER);
        $header = static fn (string $name): ?string => isset($headers[strtolower($name)]) ? (string) (is_array($headers[strtolower($name)]) ? ($headers[strtolower($name)][0] ?? '') : $headers[strtolower($name)]) : null;
        $requestId = trim($header('Request-Id') ?? '');
        if ($requestId === '') {
            $invoice = data_get($payload, 'order.invoice_number');
            $attempt = $invoice ? PaymentAttempt::query()->where('invoice_number', $invoice)->first() : null;
            app(PaymentObservabilityService::class)->event('webhook_rejected', ['order_id' => $attempt?->order_id, 'attempt_id' => $attempt?->id, 'invoice_number' => $invoice, 'processing_result' => 'rejected', 'error_reason' => 'missing_request_id']);

            return new WebhookReceipt(new PaymentWebhookLog, 400, 'Request-Id required');
        }
        $digest = base64_encode(hash('sha256', $rawBody, true));
        $invoice = data_get($payload, 'order.invoice_number');
        if (! $this->doku->verifySignature($payload, $requestId, $rawBody, $header('Request-Timestamp'), $header('Signature'), $header('Client-Id'))) {
            app(PaymentObservabilityService::class)->event('signature_invalid', ['request_id' => $requestId, 'invoice_number' => $invoice, 'processing_result' => 'rejected', 'error_reason' => 'invalid_signature']);

            return new WebhookReceipt(new PaymentWebhookLog, 401, 'Invalid signature');
        }

        $log = PaymentWebhookLog::query()->where('request_id', $requestId)->first();
        try {
            $log ??= DB::transaction(fn () => PaymentWebhookLog::create([
                'request_id' => $requestId,
                'source' => 'notify',
                'invoice_number' => $invoice,
                'status' => 'received',
                'signature_valid' => false,
                'payload' => $payload,
                'raw_body' => $rawBody,
                'body_digest' => $digest,
            ]));
        } catch (UniqueConstraintViolationException) {
            $log = null;
            for ($attempt = 0; $attempt < 3 && $log === null; $attempt++) {
                $log = PaymentWebhookLog::query()->where('request_id', $requestId)->first();
                if ($log === null) {
                    usleep(10_000 * ($attempt + 1));
                }
            }
            if ($log === null) {
                return new WebhookReceipt(new PaymentWebhookLog, 503, 'Webhook persistence unavailable');
            }
        }

        $valid = $this->doku->verifySignature(
            $payload,
            $requestId,
            $rawBody,
            $header('Request-Timestamp'),
            $header('Signature'),
            $header('Client-Id'),
        );
        if (! $valid) {
            $log->update(['status' => 'signature_invalid']);

            return new WebhookReceipt($log, 401, 'Invalid signature');
        }

        $claimToken = bin2hex(random_bytes(32));
        $claim = DB::transaction(function () use ($digest, $log, $claimToken): ?WebhookReceipt {
            $locked = PaymentWebhookLog::query()->whereKey($log->id)->lockForUpdate()->firstOrFail();
            if ($locked->body_digest === null) {
                if ($locked->status === 'retryable' && $locked->error === 'historical_raw_body_unavailable_reprocess_required') {
                    return new WebhookReceipt($locked, 422, 'Historical webhook requires operator recovery');
                }

                return new WebhookReceipt($locked, 409, 'Request-Id body conflict');
            }
            if (! hash_equals($locked->body_digest, $digest)) {
                return new WebhookReceipt($locked, 409, 'Request-Id body conflict');
            }
            if ($locked->status === 'processed') {
                return new WebhookReceipt($locked, 200, 'OK');
            }
            if ($locked->status === 'signature_invalid') {
                return new WebhookReceipt($locked, 401, 'Invalid signature');
            }
            if ($locked->status === 'processing' && $locked->claimed_at?->gt(now()->subMinutes(5))) {
                return new WebhookReceipt($locked, 202, 'Processing');
            }
            $locked->update(['status' => 'processing', 'signature_valid' => true, 'claimed_at' => now(), 'claim_token' => $claimToken]);

            return null;
        });
        if ($claim !== null) {
            return $claim;
        }

        try {
            $event = $this->normalize($payload);
            $this->doku->handleNormalizedWebhook($event);
            $updated = PaymentWebhookLog::query()->whereKey($log->id)->where('claim_token', $claimToken)->update(['status' => 'processed', 'claim_token' => null]);
            if ($updated !== 1) {
                return new WebhookReceipt($log, 409, 'Webhook claim lost');
            }

            return new WebhookReceipt($log, 200, 'OK');
        } catch (\Throwable $exception) {
            PaymentWebhookLog::query()->whereKey($log->id)->where('claim_token', $claimToken)->update(['status' => 'retryable', 'claimed_at' => null, 'claim_token' => null, 'error' => $exception->getMessage()]);

            return new WebhookReceipt($log, 500, 'Internal error');
        }
    }

    private function normalize(array $payload): NormalizedPaymentEvent
    {
        $invoice = data_get($payload, 'order.invoice_number');
        if (! is_string($invoice) || $invoice === '') {
            throw new \UnexpectedValueException('missing_invoice_number');
        }

        return new NormalizedPaymentEvent(
            source: 'doku-webhook',
            gatewayStatus: (string) data_get($payload, 'transaction.status', ''),
            amount: data_get($payload, 'order.amount') ?? data_get($payload, 'transaction.amount'),
            currency: (string) (data_get($payload, 'order.currency') ?? data_get($payload, 'transaction.currency', 'IDR')),
            gatewayReference: $invoice,
            receivedAt: now('UTC'),
            rawEvidence: $payload,
        );
    }
}
