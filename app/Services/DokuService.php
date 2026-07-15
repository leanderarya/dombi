<?php

namespace App\Services;

use App\Enums\PaymentStatus;
use App\Exceptions\DokuPaymentException;
use App\Models\Order;
use App\Models\PaymentTransaction;
use App\Services\NotificationService;
use App\Services\OrderStatusService;
use App\Services\PaymentStatusService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DokuService
{
    private string $baseUrl;

    private string $clientId;

    private string $secretKey;

    public function __construct()
    {
        $this->baseUrl = config('doku.base_url') ?? 'https://api-sandbox.doku.com';
        $this->clientId = config('doku.client_id') ?? '';
        $this->secretKey = config('doku.api_key') ?? '';
    }

    /**
     * Create a DOKU Checkout payment for an order.
     * Returns the DOKU hosted payment page URL.
     */
    public function createPayment(Order $order): string
    {
        $requestId = 'DMB-'.$order->id.'-'.time();
        $invoiceNumber = $order->order_code;
        $amount = (int) $order->total;
        $timestamp = now('UTC')->format('Y-m-d\TH:i:s\Z');

        $body = [
            'order' => [
                'invoice_number' => $invoiceNumber,
                'amount' => $amount,
                'currency' => 'IDR',
                'callback_url' => route('doku.redirect', ['invoice_number' => $order->order_code]),
                'callback_url_result' => config('doku.callback_url') ?: route('doku.notify'),
                'auto_redirect' => true,
                'payment_due_date' => config('doku.payment_timeout', 30),
                'line_items' => $this->buildLineItems($order),
            ],
            'payment' => [
                'payment_method_types' => [$this->mapPaymentMethod($order->payment_method)],
            ],
            'customer' => $this->buildCustomerInfo($order),
        ];

        $bodyJson = json_encode($body);
        $endpoint = '/checkout/v1/payment';

        Log::debug('DOKU request body', ['body' => $bodyJson]);

        $headers = $this->generateHeaders($requestId, $timestamp, $endpoint, $bodyJson);

        Log::debug('DOKU request headers', ['headers' => $headers]);

        $response = Http::withHeaders($headers)
            ->timeout(30)
            ->withBody($bodyJson, 'application/json')
            ->post($this->baseUrl.$endpoint);

        if (! $response->successful()) {
            Log::error('DOKU createPayment failed', [
                'order_id' => $order->id,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new DokuPaymentException(
                message: 'DOKU payment creation failed',
                responseCode: $response->status(),
                errors: $response->json('error_messages', []),
                original: $response
            );
        }

        $data = $response->json();
        $paymentUrl = $data['response']['payment']['url'] ?? $data['payment']['url'] ?? null;
        $sessionId = $data['response']['order']['session_id'] ?? null;
        $tokenId = $data['response']['payment']['token_id'] ?? null;

        if (! $paymentUrl) {
            Log::error('DOKU response missing payment URL', ['response' => $data]);
            throw new DokuPaymentException('Invalid DOKU response structure');
        }

        // Log transaction
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => $invoiceNumber,
            'payment_method' => $order->payment_method ?? 'qris',
            'amount' => (int) $order->total,
            'status' => 'pending',
            'session_id' => $sessionId,
            'token_id' => $tokenId,
            'raw_response' => $data,
        ]);

        // Update order
        $order->update([
            'doku_order_id' => $invoiceNumber,
            'payment_status' => 'pending',
        ]);

        return $paymentUrl;
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
            Log::warning('DOKU webhook: missing invoice_number');

            return;
        }

        $status = $this->mapStatus($paymentStatus);

        // Find order via transaction OR directly by invoice number
        $transaction = PaymentTransaction::where('doku_order_id', $invoiceNumber)->first();
        $order = $transaction?->order
            ?? Order::where('order_code', $invoiceNumber)->first()
            ?? Order::where('doku_order_id', $invoiceNumber)->first();

        if (! $order) {
            Log::warning('DOKU webhook: order not found', [
                'invoice_number' => $invoiceNumber,
                'mapped_status' => $status,
            ]);

            return;
        }

        // Idempotency: skip if already in terminal state
        if ($order->payment_status_enum->isTerminal()) {
            Log::info('DOKU webhook: order already in terminal state, skipping', [
                'order_id' => $order->id,
            ]);

            return;
        }

        // Update transaction if found
        if ($transaction) {
            $transaction->update([
                'status' => $status,
                'raw_response' => $payload,
            ]);
        } else {
            Log::warning('DOKU webhook: no PaymentTransaction record, processing order directly', [
                'order_id' => $order->id,
                'invoice_number' => $invoiceNumber,
            ]);
        }

        $this->processPaymentStatusChange($order, $status);

        Log::info('DOKU webhook processed', [
            'order_id' => $order->id,
            'invoice_number' => $invoiceNumber,
            'doku_status' => $paymentStatus,
            'mapped_status' => $status,
        ]);
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
    public function syncStatusFromDoku(Order $order): string
    {
        $dokuStatus = $this->checkStatus($order);

        if (! $dokuStatus) {
            return $order->payment_status;
        }

        $status = $this->mapStatus($dokuStatus['transaction']['status'] ?? 'PENDING');

        $transaction = PaymentTransaction::where('doku_order_id', $order->doku_order_id)->first();
        if ($transaction && $transaction->status !== $status) {
            $transaction->update([
                'status' => $status,
                'raw_response' => $dokuStatus,
            ]);
        }

        $this->processPaymentStatusChange($order, $status);

        return $status;
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

    /**
     * Map Dombi payment method to DOKU payment_method_types value.
     */
    private function mapPaymentMethod(?string $method): string
    {
        return match ($method) {
            'credit_card' => 'CREDIT_CARD',
            'qris' => 'QRIS',
            default => 'QRIS',
        };
    }

    /**
     * Mark order as paid and trigger side effects.
     * Uses atomic update to prevent race condition from concurrent webhook + redirect.
     * Handles late payments (after cancellation/expiry) by auto-refunding.
     */
    public function markOrderPaid(Order $order): void
    {
        if (! app(PaymentStatusService::class)->transition($order, PaymentStatus::Paid, ['paid_at' => now()])) {
            return; // already paid/terminal — no double marking
        }

        $terminalStatuses = [
            Order::STATUS_CANCELLED_BY_CUSTOMER,
            Order::STATUS_CANCELLED_BY_OUTLET,
            Order::STATUS_REJECTED_BY_OUTLET,
            Order::STATUS_EXPIRED,
        ];

        if (in_array($order->status, $terminalStatuses, true)) {
            // Late payment after cancellation/expiry → flag manual refund, no Doku call.
            app(PaymentStatusService::class)->transition($order, PaymentStatus::RefundPending, [
                'refund_requested_at' => now(),
            ]);
            app(NotificationService::class)->notifyRefundRequested($order);
            return;
        }

        if ($order->status === Order::STATUS_PENDING_CONFIRMATION) {
            try {
                app(OrderStatusService::class)->updateStatus($order, Order::STATUS_CONFIRMED);
            } catch (\Exception $e) {
                Log::info('Order status transition skipped', [
                    'order_id' => $order->id,
                    'current_status' => $order->fresh()->status,
                ]);
            }
        }

        app(NotificationService::class)->notifyOrderCreated($order);
    }

    public function markOrderPaidPublic(Order $order): void
    {
        $this->markOrderPaid($order);
    }

    /**
     * Process payment status change — shared by webhook and status sync.
     * Handles: paid, failed, expired transitions.
     * Public so DokuPaymentController can use it as fallback when syncStatusFromDoku fails.
     */
    public function processPaymentStatusChange(Order $order, string $status): void
    {
        $to = PaymentStatus::from($status);
        if ($to === PaymentStatus::Paid) {
            $this->markOrderPaid($order);
            return;
        }
        if (in_array($status, ['failed', 'expired'], true)
            && $order->payment_status === 'pending') {
            $retryWindowMinutes = config('order.payment_retry_window_minutes', 15);
            app(PaymentStatusService::class)->transition($order, $to, [
                'confirmation_expires_at' => now()->addMinutes($retryWindowMinutes),
            ]);
        }
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
