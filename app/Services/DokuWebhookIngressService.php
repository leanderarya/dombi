<?php

namespace App\Services;

use App\Models\PaymentWebhookLog;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final class DokuWebhookIngressService
{
    public function __construct(private readonly DokuService $doku)
    {
    }

    public function receive(string $rawBody, array $headers): WebhookReceipt
    {
        $payload = json_decode($rawBody, true) ?? [];
        $headers = array_change_key_case($headers, CASE_LOWER);
        $header = static fn (string $name): ?string => isset($headers[strtolower($name)]) ? (string) (is_array($headers[strtolower($name)]) ? ($headers[strtolower($name)][0] ?? '') : $headers[strtolower($name)]) : null;
        $requestId = $header('Request-Id') ?? '';
        $digest = base64_encode(hash('sha256', $rawBody, true));
        $invoice = data_get($payload, 'order.invoice_number');

        try {
            $log = DB::transaction(fn () => PaymentWebhookLog::create([
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
            return new WebhookReceipt($log, 200, 'OK');
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

        $log->update(['signature_valid' => true]);
        try {
            if ($invoice === null) {
                throw new \UnexpectedValueException('missing_invoice_number');
            }
            $this->doku->handleWebhook($payload);
            $log->update(['status' => 'processed']);
            return new WebhookReceipt($log, 200, 'OK');
        } catch (\Throwable $exception) {
            $log->update(['status' => 'retryable', 'error' => $exception->getMessage()]);
            return new WebhookReceipt($log, 500, 'Internal error');
        }
    }
}
