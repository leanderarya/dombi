<?php

namespace App\Services;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Exceptions\DokuPaymentException;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\PaymentTransaction;
use App\Models\PaymentWebhookLog;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DokuService
{
    private string $baseUrl;

    private string $clientId;

    private string $secretKey;

    private RefundService $refundService;

    public function __construct()
    {
        $this->baseUrl = config('doku.base_url') ?? 'https://api-sandbox.doku.com';
        $this->clientId = config('doku.client_id') ?? '';
        $this->secretKey = config('doku.api_key') ?? '';
        $this->refundService = app(RefundService::class);
    }

    /**
     * Create a DOKU Checkout payment for an order.
     * Returns the DOKU hosted payment page URL.
     */
    public function createPayment(PaymentAttempt $attempt): string
    {
        $attempt = PaymentAttempt::query()->whereKey($attempt->id)->with('order')->firstOrFail();
        $url = data_get($attempt->metadata ?? [], 'payment_url');
        if ($url && in_array($attempt->creation_state?->value, ['created', 'pending'], true)) {
            return $url;
        }
        if ($attempt->creation_state?->value === 'failed') {
            throw new DokuPaymentException('Failed payment attempt requires reconciliation before retry.');
        }
        if (in_array($attempt->creation_state?->value, ['pending', 'unknown'], true)) {
            throw new DokuPaymentException('Payment attempt requires reconciliation before retry.');
        }
        $lease = data_get($attempt->metadata ?? [], 'creation_lease');
        if ($lease && data_get($lease, 'expires_at') <= now()->toIso8601String()) {
            $expired = DB::transaction(function () use ($attempt, $lease): bool {
                $locked = PaymentAttempt::query()->whereKey($attempt->id)->lockForUpdate()->firstOrFail();
                if (data_get($locked->metadata ?? [], 'creation_lease.token') !== data_get($lease, 'token')) {
                    return false;
                }
                $locked->update(['creation_state' => 'unknown', 'metadata' => array_merge($locked->metadata ?? [], ['creation_lease' => null])]);

                return true;
            });
            if (! $expired) {
                throw new DokuPaymentException('Payment attempt creation lease changed; reconciliation required.');
            }
            $attempt = $this->reconcilePaymentAttempt($attempt);
            if (in_array($attempt->creation_state?->value, ['initiated', 'unknown'], true)) {
                throw new DokuPaymentException('Payment attempt requires reconciliation before retry.');
            }
            throw new DokuPaymentException('Payment attempt lease expired; prepare a fresh attempt.');
        }
        $claimToken = bin2hex(random_bytes(16));
        $claimed = DB::transaction(function () use ($attempt, $claimToken): bool {
            $locked = PaymentAttempt::query()->whereKey($attempt->id)->lockForUpdate()->firstOrFail();
            if ($locked->creation_state?->value !== 'initiated') {
                return false;
            }
            $lease = data_get($locked->metadata ?? [], 'creation_lease');
            if ($lease && data_get($lease, 'expires_at') > now()->toIso8601String()) {
                return false;
            }
            $locked->update(['metadata' => array_merge($locked->metadata ?? [], ['creation_lease' => ['token' => $claimToken, 'expires_at' => now()->addMinutes(2)->toIso8601String()]])]);

            return true;
        });
        if (! $claimed) {
            throw new DokuPaymentException('Payment attempt creation is already in progress.');
        }

        $order = $attempt->order;
        $body = ['order' => ['invoice_number' => $attempt->invoice_number, 'amount' => (int) $attempt->amount_snapshot, 'currency' => $attempt->currency_snapshot, 'callback_url' => route('doku.redirect', ['invoice_number' => $attempt->invoice_number]), 'callback_url_result' => config('doku.callback_url') ?: route('doku.notify'), 'auto_redirect' => true, 'payment_due_date' => config('doku.payment_timeout', 30), 'line_items' => data_get($attempt->metadata ?? [], 'line_items', $this->buildLineItems($order))], 'payment' => array_merge(['payment_method_types' => [$this->mapPaymentMethod($attempt->payment_method)]], $this->channelInfo($attempt->payment_method) ?? []), 'customer' => data_get($attempt->metadata ?? [], 'customer_snapshot', $this->buildCustomerInfo($order))];
        $bodyJson = json_encode($body);
        $endpoint = '/checkout/v1/payment';
        $timestamp = now('UTC')->format('Y-m-d\TH:i:s\Z');
        $headers = $this->generateHeaders($attempt->merchant_request_id, $timestamp, $endpoint, $bodyJson);

        try {
            $response = Http::withHeaders($headers)->timeout(30)->withBody($bodyJson, 'application/json')->post($this->baseUrl.$endpoint);
        } catch (ConnectionException $exception) {
            $this->persistCreationOutcome($attempt, $claimToken, 'unknown', null, ['creation_error' => $exception->getMessage()]);
            throw $exception;
        }
        if (! $response->successful()) {
            $ambiguous = $response->status() === 408 || $response->status() >= 500;
            $this->persistCreationOutcome($attempt, $claimToken, $ambiguous ? 'unknown' : 'failed', $response->json(), []);
            throw new DokuPaymentException('DOKU payment creation failed', $response->status(), $response->json('error_messages', []), $response);
        }
        $data = $response->json();
        $paymentUrl = $data['response']['payment']['url'] ?? $data['payment']['url'] ?? null;
        if (! $paymentUrl) {
            $this->persistCreationOutcome($attempt, $claimToken, 'unknown', $data, []);
            throw new DokuPaymentException('Invalid DOKU response structure');
        }
        $sessionId = $data['response']['order']['session_id'] ?? null;
        $tokenId = $data['response']['payment']['token_id'] ?? null;
        $persisted = DB::transaction(function () use ($attempt, $claimToken, $paymentUrl, $order, $data, $sessionId, $tokenId): bool {
            $locked = PaymentAttempt::query()->whereKey($attempt->id)->lockForUpdate()->firstOrFail();
            if (data_get($locked->metadata ?? [], 'creation_lease.token') !== $claimToken) {
                $locked->update(['creation_state' => 'unknown', 'raw_response' => $data]);

                return false;
            }
            $locked->update(['creation_state' => 'created', 'session_id' => $sessionId, 'token_id' => $tokenId, 'raw_response' => $data, 'metadata' => array_merge($locked->metadata ?? [], ['payment_url' => $paymentUrl])]);
            PaymentTransaction::firstOrCreate(['doku_order_id' => $locked->invoice_number], ['order_id' => $order->id, 'doku_order_id' => $locked->invoice_number, 'payment_method' => $locked->payment_method ?? $order->payment_method ?? 'qris', 'amount' => (int) $locked->amount_snapshot, 'status' => 'pending', 'session_id' => $sessionId, 'token_id' => $tokenId, 'raw_response' => $data]);
            $order->update(['doku_order_id' => $locked->invoice_number, 'payment_status' => 'pending']);

            return true;
        });
        if (! $persisted) {
            throw new DokuPaymentException('Payment creation response became stale; reconciliation required.');
        }

        return $paymentUrl;
    }

    private function persistCreationOutcome(PaymentAttempt $attempt, string $claimToken, string $state, ?array $rawResponse, array $metadata): bool
    {
        return DB::transaction(function () use ($attempt, $claimToken, $state, $rawResponse, $metadata): bool {
            $locked = PaymentAttempt::query()->whereKey($attempt->id)->lockForUpdate()->firstOrFail();
            if (data_get($locked->metadata ?? [], 'creation_lease.token') !== $claimToken) {
                return false;
            }
            $locked->update(['creation_state' => $state, 'raw_response' => $rawResponse, 'metadata' => array_merge($locked->metadata ?? [], $metadata, ['creation_lease' => null])]);

            return true;
        });
    }

    public function reconcilePaymentAttempt(PaymentAttempt $attempt): PaymentAttempt
    {
        $attempt = PaymentAttempt::query()->whereKey($attempt->id)->with('order')->firstOrFail();
        $claimToken = bin2hex(random_bytes(16));
        $claimed = DB::transaction(function () use ($attempt, $claimToken): bool {
            $locked = PaymentAttempt::query()->whereKey($attempt->id)->lockForUpdate()->firstOrFail();
            $metadata = $locked->metadata ?? [];
            $count = (int) ($metadata['reconciliation_attempts'] ?? 0);
            $next = data_get($metadata, 'next_reconciliation_at');
            $lease = data_get($metadata, 'reconciliation_lease');
            if ($count >= 5 || ($next && now()->lt($next)) || ($lease && data_get($lease, 'expires_at') > now()->toIso8601String())) {
                return false;
            }
            $locked->update(['metadata' => array_merge($metadata, ['reconciliation_attempts' => $count + 1, 'reconciliation_lease' => ['token' => $claimToken, 'expires_at' => now()->addMinutes(2)->toIso8601String()]]), 'creation_state' => 'unknown']);

            return true;
        });
        if (! $claimed) {
            return $attempt->fresh();
        }
        $requestId = 'REC-'.$attempt->id.'-'.bin2hex(random_bytes(4));
        $endpoint = '/checkout/v1/payment/'.$attempt->invoice_number;
        $timestamp = now('UTC')->format('Y-m-d\\TH:i:s\\Z');
        try {
            $response = Http::withHeaders($this->generateHeaders($requestId, $timestamp, $endpoint, ''))->timeout(10)->get($this->baseUrl.$endpoint);
        } catch (ConnectionException $exception) {
            return $this->recordReconciliationFailure($attempt, $claimToken, null, $exception->getMessage());
        }
        if (! $response->successful()) {
            return $this->recordReconciliationFailure($attempt, $claimToken, $response->status(), $response->body());
        }
        $data = $response->json();
        $status = strtoupper(data_get($data, 'transaction.status', ''));
        if ($status === 'SUCCESS') {
            $persisted = DB::transaction(function () use ($attempt, $claimToken, $data, $status): bool {
                $order = Order::query()->whereKey($attempt->order_id)->lockForUpdate()->firstOrFail();
                $locked = PaymentAttempt::query()->whereKey($attempt->id)->lockForUpdate()->firstOrFail();
                if (data_get($locked->metadata ?? [], 'reconciliation_lease.token') !== $claimToken) {
                    return false;
                }
                app(CanonicalPaymentTransitionService::class)->apply($locked, new NormalizedPaymentEvent(
                    source: 'doku-reconciliation',
                    gatewayStatus: 'SUCCESS',
                    amount: data_get($data, 'transaction.amount'),
                    currency: data_get($data, 'order.currency', 'IDR'),
                    gatewayReference: data_get($data, 'transaction.original_request_id') ?? data_get($data, 'transaction.id') ?? $locked->invoice_number,
                    receivedAt: now(),
                    rawEvidence: $data,
                ));
                $locked->update(['creation_state' => 'created', 'gateway_status' => $status, 'raw_response' => $data, 'reconciled_at' => now(), 'metadata' => array_merge($locked->metadata ?? [], ['reconciliation_lease' => null])]);
                if ($order->fresh()->payment_status === 'paid' && $order->paid_at === null) {
                    $order->update(['paid_at' => now()]);
                }

                return true;
            });
            if (! $persisted) {
                return $attempt->fresh();
            }
        } elseif (in_array($status, ['FAILED', 'REJECTED', 'DENIED', 'CANCELLED', 'EXPIRED'], true)) {
            $this->persistReconciliationResult($attempt, $claimToken, 'failed', $status, $data);
        } elseif ($status === 'PENDING') {
            $this->persistReconciliationResult($attempt, $claimToken, 'pending', $status, $data);
        } else {
            $this->recordReconciliationFailure($attempt, $claimToken, $status, 'unrecognized_provider_status', $data);
        }

        return $attempt->fresh();
    }

    private function persistReconciliationResult(PaymentAttempt $attempt, string $claimToken, string $creationState, string $status, array $data): bool
    {
        return DB::transaction(function () use ($attempt, $claimToken, $creationState, $status, $data): bool {
            $locked = PaymentAttempt::query()->whereKey($attempt->id)->lockForUpdate()->firstOrFail();
            if (data_get($locked->metadata ?? [], 'reconciliation_lease.token') !== $claimToken) {
                return false;
            }
            $locked->update(['creation_state' => $creationState, 'settlement_status' => $creationState === 'pending' ? 'pending' : $locked->settlement_status, 'gateway_status' => $status, 'raw_response' => $data, 'reconciled_at' => now(), 'metadata' => array_merge($locked->metadata ?? [], ['reconciliation_lease' => null])]);
            app(OrderPaymentProjectionService::class)->recompute($locked->order);

            return true;
        });
    }

    private function recordReconciliationFailure(PaymentAttempt $attempt, string $claimToken, int|string|null $status, string $error, ?array $rawResponse = null): PaymentAttempt
    {
        return DB::transaction(function () use ($attempt, $claimToken, $status, $error, $rawResponse): PaymentAttempt {
            $locked = PaymentAttempt::query()->whereKey($attempt->id)->lockForUpdate()->firstOrFail();
            $metadata = $locked->metadata ?? [];
            if (data_get($metadata, 'reconciliation_lease.token') !== $claimToken) {
                return $locked->fresh();
            }
            $count = min((int) ($metadata['reconciliation_attempts'] ?? 0), 5);
            $delay = min(2 ** ($count - 1), 16);
            $locked->update([
                'creation_state' => 'unknown',
                'raw_response' => $rawResponse,
                'metadata' => array_merge($metadata, [
                    'reconciliation_attempts' => $count,
                    'last_reconciliation_status' => $status,
                    'last_reconciliation_error' => $error,
                    'next_reconciliation_at' => now()->addMinutes($delay)->toIso8601String(),
                    'reconciliation_lease' => null,
                ]),
            ]);

            return $locked->fresh();
        });
    }

    public function preparePaymentAttempt(Order $order): PaymentAttempt
    {
        return DB::transaction(function () use ($order): PaymentAttempt {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $active = PaymentAttempt::query()->where('order_id', $order->id)->where(function ($query): void {
                $query->whereIn('creation_state', ['initiated', 'pending', 'created', 'unknown'])
                    ->orWhereIn('settlement_status', ['pending', 'unknown']);
            })->latest('id')->first();
            if ($active) {
                return $active;
            }
            if (PaymentAttempt::query()->where('order_id', $order->id)->count() >= config('order.max_payment_attempts', 3)) {
                return PaymentAttempt::query()->where('order_id', $order->id)->latest('id')->firstOrFail();
            }
            $identity = strtoupper('DMB-'.$order->id.'-'.bin2hex(random_bytes(6)));

            return PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => $identity, 'invoice_number' => $identity, 'merchant_request_id' => $identity.'-REQ', 'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR', 'payment_method' => $order->payment_method ?? 'qris', 'creation_state' => 'initiated', 'metadata' => ['line_items' => $this->buildLineItems($order), 'customer_snapshot' => $this->buildCustomerInfo($order)]]);
        });
    }

    /**
     * Handle DOKU webhook notification.
     * DOKU sends this to callback_url_result when payment status changes.
     */
    public function handleWebhook(array $payload): void
    {
        $invoiceNumber = $payload['order']['invoice_number'] ?? null;
        $paymentStatus = $payload['transaction']['status'] ?? null;

        if (! $invoiceNumber) {
            PaymentWebhookLog::create([
                'source' => 'doku', 'status' => $paymentStatus,
                'payload' => $payload, 'error' => 'missing_invoice_number',
            ]);
            Log::warning('DOKU webhook: missing invoice_number');

            return;
        }

        $status = $this->mapStatus($paymentStatus);

        DB::transaction(function () use ($invoiceNumber, $status, $paymentStatus, $payload): void {
            $transaction = PaymentTransaction::where('doku_order_id', $invoiceNumber)->first();
            $order = $transaction?->order
                ?? Order::where('order_code', $invoiceNumber)->first()
                ?? Order::where('doku_order_id', $invoiceNumber)->first();
            $attempt = PaymentAttempt::where('invoice_number', $invoiceNumber)->first();
            $resolvedOrderId = $order?->id;
            if ($attempt && $resolvedOrderId !== null && $attempt->order_id !== $resolvedOrderId) {
                PaymentWebhookLog::create([
                    'source' => 'doku', 'invoice_number' => $invoiceNumber,
                    'status' => $paymentStatus, 'mapped_status' => $status,
                    'payload' => $payload, 'error' => 'invoice_order_attempt_mismatch',
                ]);

                return;
            }
            $order = $attempt
                ? Order::query()->whereKey($attempt->order_id)->lockForUpdate()->first()
                : null;
            $attempt = $attempt
                ? PaymentAttempt::query()->whereKey($attempt->id)->lockForUpdate()->first()
                : null;

            if ($order === null || $attempt === null) {
                PaymentWebhookLog::create([
                    'source' => 'doku', 'invoice_number' => $invoiceNumber,
                    'status' => $paymentStatus, 'mapped_status' => $status,
                    'payload' => $payload, 'error' => 'canonical_attempt_missing',
                ]);

                return;
            }

            // Preserve transaction evidence until canonical transition validates the event.
            if (! $transaction) {
                Log::warning('DOKU webhook: no PaymentTransaction record, processing order directly', [
                    'order_id' => $order->id,
                    'invoice_number' => $invoiceNumber,
                ]);
            }

            $this->processPaymentStatusChange($order, $status, $payload);
            if ($status === 'paid' && $order->fresh()->payment_status === 'paid' && $order->paid_at === null) {
                $order->update(['paid_at' => now()]);
            }
            if ($transaction && ! ($transaction->status === 'paid' && $status !== 'paid')) {
                $transaction->update(['status' => $status, 'raw_response' => $payload]);
            }

            Log::info('DOKU webhook processed', [
                'order_id' => $order->id,
                'invoice_number' => $invoiceNumber,
                'doku_status' => $paymentStatus,
                'mapped_status' => $status,
            ]);
        });
    }

    /**
     * Verify DOKU webhook signature.
     * DOKU Non-SNAP signature: HMAC-SHA256 of assembled header/body fields.
     */
    public function verifySignature(array $payload, string $requestId, string $rawBody, ?string $timestampHeader = null, ?string $signatureHeader = null, ?string $clientIdHeader = null): bool
    {
        $clientId = $clientIdHeader ?? $payload['client_id'] ?? $this->clientId;
        if (! hash_equals($clientId, $this->clientId)) {
            Log::warning('DOKU webhook: client id mismatch', ['provided' => $clientId]);

            return false;
        }

        $timestamp = $timestampHeader ?? $payload['timestamp'] ?? '';
        if (! $this->isTimestampFresh($timestamp)) {
            Log::warning('DOKU webhook: stale timestamp', ['timestamp' => $timestamp]);

            return false;
        }

        $requestTarget = '/payment/doku/notify';
        $digest = base64_encode(hash('sha256', $rawBody, true));
        $assembled = 'Client-Id:'.$this->clientId."\n"
            .'Request-Id:'.$requestId."\n"
            .'Request-Timestamp:'.$timestamp."\n"
            .'Request-Target:'.$requestTarget."\n"
            .'Digest:'.$digest;

        $expected = 'HMACSHA256='.base64_encode(hash_hmac('sha256', $assembled, $this->secretKey, true));
        $provided = $signatureHeader ?? $payload['signature'] ?? '';

        if (! hash_equals($expected, $provided)) {
            Log::warning('DOKU webhook: signature mismatch', [
                'request_id' => $requestId,
                'expected' => substr($expected, 0, 30).'...',
                'provided' => substr($provided, 0, 30).'...',
            ]);
        }

        return hash_equals($expected, $provided);
    }

    private function isTimestampFresh(string $timestamp): bool
    {
        if (! $timestamp) {
            return false;
        }
        $parsed = \DateTime::createFromFormat('Y-m-d\TH:i:s\Z', $timestamp);
        if (! $parsed) {
            return false;
        }
        $diff = abs(now('UTC')->getTimestamp() - $parsed->getTimestamp());

        return $diff <= (int) config('doku.webhook_max_age_seconds', 300);
    }

    // --- test helpers ---
    public function refreshKeysForTest(string $clientId, string $secretKey): void
    {
        $this->clientId = $clientId;
        $this->secretKey = $secretKey;
    }

    public function signForTest(string $requestId, string $timestamp, string $endpoint, string $body): string
    {
        $digest = base64_encode(hash('sha256', $body, true));
        $assembled = 'Client-Id:'.$this->clientId."\n"
            .'Request-Id:'.$requestId."\n"
            .'Request-Timestamp:'.$timestamp."\n"
            .'Request-Target:'.$endpoint."\n"
            .'Digest:'.$digest;

        return 'HMACSHA256='.base64_encode(hash_hmac('sha256', $assembled, $this->secretKey, true));
    }

    /**
     * Check transaction status from DOKU API.
     * Returns the DOKU response array or null if unavailable.
     */
    public function checkStatus(Order $order): ?array
    {
        if (empty($order->doku_order_id)) {
            Log::info('DOKU checkStatus: no doku_order_id', ['order_id' => $order->id]);

            return null;
        }

        $requestId = 'CHK-'.$order->id.'-'.time();
        $timestamp = now('UTC')->format('Y-m-d\TH:i:s\Z');
        $endpoint = '/checkout/v1/payment/'.$order->doku_order_id;

        return $this->withRetry(function () use ($requestId, $timestamp, $endpoint, $order) {
            $response = Http::withHeaders($this->generateHeaders($requestId, $timestamp, $endpoint, ''))
                ->timeout(10)
                ->get($this->baseUrl.$endpoint);

            if ($response->successful()) {
                return $response->json();
            }

            // 404 = DOKU session not found — could be API issue, not necessarily expired.
            // Don't assume expired. Return null so syncStatusFromDoku preserves existing payment_status.
            if ($response->status() === 404) {
                Log::warning('DOKU status check: session not found (404)', [
                    'order_id' => $order->id,
                    'doku_order_id' => $order->doku_order_id,
                ]);

                return null; // 404 = not expired; do not retry
            }

            Log::warning('DOKU status check failed (will retry)', [
                'order_id' => $order->id,
                'status_code' => $response->status(),
                'body' => $response->body(),
            ]);

            return null; // triggers retry in withRetry
        });
    }

    /**
     * Retry a callable up to $maxAttempts times with small backoff.
     * Retries on null return OR thrown exception. Returns null after exhaustion.
     */
    private function withRetry(callable $call, int $maxAttempts = 3): mixed
    {
        $attempt = 0;
        $lastErr = null;
        while ($attempt < $maxAttempts) {
            $attempt++;
            try {
                $res = $call();
                if ($res !== null) {
                    return $res;
                }
            } catch (\Exception $e) {
                $lastErr = $e;
            }
            if ($attempt < $maxAttempts) {
                usleep(500_000 * $attempt); // 0.5s, 1s backoff
            }
        }
        if ($lastErr) {
            Log::warning('DOKU call exhausted retries', ['error' => $lastErr->getMessage()]);
        }

        return null;
    }

    /**
     * Sync order payment status from DOKU.
     */
    public function syncStatusFromDoku(Order|PaymentAttempt $subject): string
    {
        $attempt = $subject instanceof PaymentAttempt ? $subject->fresh() : PaymentAttempt::where('order_id', $subject->id)->whereIn('creation_state', ['initiated', 'pending', 'created', 'unknown'])->latest('id')->first();
        if (! $attempt) {
            throw new \LogicException('Canonical payment attempt required before status sync.');
        }
        $order = $attempt->order;
        $order->doku_order_id = $attempt->invoice_number;
        $dokuStatus = $this->checkStatus($order);

        if (! $dokuStatus) {
            return $order->payment_status;
        }

        $status = $this->mapStatus($dokuStatus['transaction']['status'] ?? 'PENDING');

        return DB::transaction(function () use ($order, $status, $dokuStatus): string {
            $transaction = PaymentTransaction::where('doku_order_id', $order->doku_order_id)->first();
            if ($transaction && $transaction->status !== $status
                && ! (in_array($transaction->status, ['paid', 'settled'], true) && in_array($status, ['failed', 'expired', 'pending'], true))) {
                $transaction->update([
                    'status' => $status,
                    'raw_response' => $dokuStatus,
                ]);
            }

            $this->processPaymentStatusChange($order, $status, $dokuStatus);

            return $status;
        });
    }

    /**
     * Map DOKU payment status to Dombi status.
     */
    public function mapStatus(?string $dokuStatus): string
    {
        $upper = strtoupper($dokuStatus ?? '');

        return match ($upper) {
            'SUCCESS' => 'paid',
            'PENDING' => 'pending',
            'FAILED', 'REJECTED', 'DENIED', 'CANCELLED' => 'failed',
            'EXPIRED' => 'expired',
            default => tap('pending', function () use ($upper) {
                Log::warning('DOKU: unmapped status', ['status' => $upper]);
            }),
        };
    }

    public function mapPaymentMethodPublic(?string $method): string
    {
        return $this->mapPaymentMethod($method);
    }

    /**
     * Map Dombi payment method to DOKU payment_method_types value via enum.
     */
    private function mapPaymentMethod(?string $method): string
    {
        $enum = PaymentMethod::tryFrom($method ?? '') ?? PaymentMethod::Qris;

        return $enum->dokuType();
    }

    private function channelInfo(?string $method): ?array
    {
        $enum = PaymentMethod::tryFrom($method ?? '') ?? PaymentMethod::Qris;
        $channel = config("doku.methods.{$enum->value}.channel");

        return $channel ? ['channel' => $channel] : null;
    }

    /**
     * Mark order as paid and trigger side effects.
     * Uses atomic update to prevent race condition from concurrent webhook + redirect.
     * Handles late payments (after cancellation/expiry) by auto-refunding.
     */
    public function markOrderPaid(Order $order, int|float|string|null $authoritativeAmount = null): void
    {
        $attempt = $order->paymentAttempts()->where('invoice_number', $order->doku_order_id ?: $order->order_code)->first();
        if (! $attempt) {
            throw new \LogicException('Canonical payment attempt required before marking order paid.');
        }

        app(CanonicalPaymentTransitionService::class)->apply($attempt, new NormalizedPaymentEvent(
            source: 'legacy-entry-point',
            gatewayStatus: 'SUCCESS',
            amount: $authoritativeAmount,
            currency: $attempt->currency_snapshot,
            gatewayReference: $attempt->invoice_number,
            receivedAt: now(),
            rawEvidence: ['legacy_entry_point' => true],
        ));

        if (in_array($order->status, [Order::STATUS_CANCELLED_BY_CUSTOMER, Order::STATUS_CANCELLED_BY_OUTLET, Order::STATUS_REJECTED_BY_OUTLET, Order::STATUS_EXPIRED], true)) {
            $order->refresh()->update(['payment_status' => 'refund_pending', 'refund_amount' => $attempt->amount_snapshot]);
        }
    }

    private function legacyMarkOrderPaid(Order $order): void
    {
        $terminalStatuses = [
            Order::STATUS_CANCELLED_BY_CUSTOMER,
            Order::STATUS_CANCELLED_BY_OUTLET,
            Order::STATUS_REJECTED_BY_OUTLET,
            Order::STATUS_EXPIRED,
        ];

        if (in_array($order->status, $terminalStatuses, true)) {
            DB::transaction(function () use ($order) {
                $locked = Order::lockForUpdate()
                    ->with('paymentTransactions')
                    ->findOrFail($order->id);

                if (! app(PaymentStatusService::class)->transition($locked, PaymentStatus::Paid, ['paid_at' => now()])) {
                    return;
                }

                $this->refundService->request($locked, 'system', null, 'late_payment');
            });

            return;
        }

        if (! app(PaymentStatusService::class)->transition($order, PaymentStatus::Paid, ['paid_at' => now()])) {
            return;
        }

        if ($order->status === Order::STATUS_PENDING_CONFIRMATION) {
            app(NotificationService::class)->notifyOrderCreated($order);
        }
    }

    public function markOrderPaidPublic(Order $order, int|float|string|null $authoritativeAmount = null): void
    {
        $this->markOrderPaid($order, $authoritativeAmount);
    }

    /**
     * Process payment status change — shared by webhook and status sync.
     * Handles: paid, failed, expired transitions.
     */
    public function handleNormalizedWebhook(NormalizedPaymentEvent $event): void
    {
        $invoiceNumber = data_get($event->rawEvidence, 'order.invoice_number');
        $attempt = PaymentAttempt::where('invoice_number', $invoiceNumber)->first();
        if (! $attempt) {
            throw new \RuntimeException('canonical_attempt_missing');
        }

        app(CanonicalPaymentTransitionService::class)->apply($attempt, $event);
    }

    public function processPaymentStatusChange(Order $order, string $status, array $evidence = []): void
    {
        $invoiceNumber = $evidence['order']['invoice_number'] ?? $order->doku_order_id ?: $order->order_code;
        $attempt = $order->paymentAttempts()->where('invoice_number', $invoiceNumber)->first();
        if ($attempt) {
            app(CanonicalPaymentTransitionService::class)->apply($attempt, new NormalizedPaymentEvent(
                source: 'doku',
                gatewayStatus: $evidence['transaction']['status'] ?? $status,
                amount: $evidence['transaction']['amount'] ?? null,
                currency: $evidence['order']['currency'] ?? 'IDR',
                gatewayReference: $evidence['transaction']['original_request_id'] ?? $evidence['transaction']['id'] ?? $invoiceNumber,
                receivedAt: now(),
                rawEvidence: $evidence,
            ));
            if ($status === 'paid' && $order->fresh()->payment_status === 'paid' && $order->paid_at === null) {
                $order->update(['paid_at' => now()]);
            }

            if (in_array($order->status, [Order::STATUS_CANCELLED_BY_CUSTOMER, Order::STATUS_CANCELLED_BY_OUTLET, Order::STATUS_REJECTED_BY_OUTLET, Order::STATUS_EXPIRED], true)) {
                $order->refresh()->update(['payment_status' => 'refund_pending', 'refund_amount' => $attempt->amount_snapshot]);
            }

            return;
        }

        Log::warning('DOKU event ignored without canonical payment attempt', ['order_id' => $order->id, 'status' => $status]);

    }

    /**
     * Build line items from order items plus fees so sum matches order total.
     */
    private function buildLineItems(Order $order): array
    {
        $items = $order->items->map(fn ($item) => [
            'id' => (string) ($item->product_id ?: $item->id),
            'name' => $item->product_name,
            'quantity' => $item->quantity,
            'price' => (int) $item->price,
        ])->toArray();

        // Add delivery fee as a line item so DOKU total matches order total
        if ((int) $order->delivery_fee > 0) {
            $items[] = [
                'id' => 'delivery_fee',
                'name' => 'Ongkos Kirim',
                'quantity' => 1,
                'price' => (int) $order->delivery_fee,
            ];
        }

        // Add payment fee as a line item (PPN/biaya layanan)
        if ((int) $order->payment_fee > 0) {
            $items[] = [
                'id' => 'payment_fee',
                'name' => 'Biaya Layanan',
                'quantity' => 1,
                'price' => (int) $order->payment_fee,
            ];
        }

        return $items;
    }

    /**
     * Build customer info from order.
     */
    private function buildCustomerInfo(Order $order): array
    {
        $customer = $order->customer;

        return [
            'name' => $customer?->name ?? $order->customer_name,
            'email' => $customer?->email ?? null,
            'phone' => $customer?->phone ?? $order->customer_phone,
        ];
    }

    /**
     * Generate DOKU Non-SNAP API headers with HMAC-SHA256 signature.
     */
    private function generateHeaders(string $requestId, string $timestamp, string $endpoint, string $body): array
    {
        $digest = base64_encode(hash('sha256', $body, true));

        // DOKU signature uses actual newline characters (\n in double quotes)
        $assembled = 'Client-Id:'.$this->clientId."\n"
            .'Request-Id:'.$requestId."\n"
            .'Request-Timestamp:'.$timestamp."\n"
            .'Request-Target:'.$endpoint."\n"
            .'Digest:'.$digest;

        $signature = 'HMACSHA256='.base64_encode(hash_hmac('sha256', $assembled, $this->secretKey, true));

        return [
            'Client-Id' => $this->clientId,
            'Request-Id' => $requestId,
            'Request-Timestamp' => $timestamp,
            'Signature' => $signature,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ];
    }
}
