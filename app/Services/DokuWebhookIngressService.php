<?php

namespace App\Services;

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
            return new WebhookReceipt(new PaymentWebhookLog, 400, 'Request-Id required');
        }
        $digest = base64_encode(hash('sha256', $rawBody, true));
        $invoice = data_get($payload, 'order.invoice_number');

        $existing = PaymentWebhookLog::query()->where('request_id', $requestId)->first();
        if ($existing) {
            if (! hash_equals((string) $existing->body_digest, $digest)) {
                return new WebhookReceipt($existing, 409, 'Request-Id body conflict');
            }
            if ($existing->status === 'processed') {
                return new WebhookReceipt($existing, 200, 'OK');
            }
            if ($existing->status === 'signature_invalid') {
                return new WebhookReceipt($existing, 401, 'Invalid signature');
            }
            $log = $existing;
        }

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
            $log = PaymentWebhookLog::query()->where('request_id', $requestId)->firstOrFail();
            if (! hash_equals((string) $log->body_digest, $digest)) {
                return new WebhookReceipt($log, 409, 'Request-Id body conflict');
            }
            if ($log->status === 'processed') {
                return new WebhookReceipt($log, 200, 'OK');
            }
            if ($log->status === 'signature_invalid') {
                return new WebhookReceipt($log, 401, 'Invalid signature');
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

        $claim = DB::transaction(function () use ($digest, $log): ?WebhookReceipt {
            $locked = PaymentWebhookLog::query()->whereKey($log->id)->lockForUpdate()->firstOrFail();
            if (! hash_equals((string) $locked->body_digest, $digest)) {
                return new WebhookReceipt($locked, 409, 'Request-Id body conflict');
            }
            if ($locked->status === 'processed') {
                return new WebhookReceipt($locked, 200, 'OK');
            }
            if ($locked->status === 'signature_invalid') {
                return new WebhookReceipt($locked, 401, 'Invalid signature');
            }
            if ($locked->status === 'processing') {
                return new WebhookReceipt($locked, 202, 'Processing');
            }
            $locked->update(['status' => 'processing', 'signature_valid' => true]);

            return null;
        });
        if ($claim !== null) {
            return $claim;
        }

        try {
            $event = $this->normalize($payload);
            $this->doku->handleNormalizedWebhook($event);
            $log->update(['status' => 'processed']);

            return new WebhookReceipt($log, 200, 'OK');
        } catch (\Throwable $exception) {
            PaymentWebhookLog::query()->whereKey($log->id)->update(['status' => 'retryable', 'error' => $exception->getMessage()]);

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
