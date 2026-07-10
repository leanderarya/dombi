<?php

namespace App\Services;

use App\Exceptions\DokuPaymentException;
use App\Models\Order;
use App\Models\PaymentTransaction;
use Illuminate\Support\Facades\Cache;
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
        if (in_array($order->payment_status, ['paid', 'refunded'], true)) {
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
    public function verifySignature(array $payload, string $requestId, string $rawBody, ?string $timestampHeader = null, ?string $signatureHeader = null): bool
    {
        $timestamp = $timestampHeader ?? $payload['timestamp'] ?? '';
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

        try {
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

                return null;
            }

            Log::warning('DOKU status check failed', [
                'order_id' => $order->id,
                'status_code' => $response->status(),
                'body' => $response->body(),
            ]);

            return null;
        } catch (\Exception $e) {
            Log::error('DOKU status check error', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
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
     * Process refund via DOKU API.
     * Returns ['status' => 'success'|'failed'|'already_refunded'|'skipped', ...]
     */
    public function refund(Order $order, string $reason = 'Order cancelled'): array
    {
        if ($order->payment_status === 'refunded') {
            return ['status' => 'already_refunded'];
        }

        if ($order->payment_status !== 'paid') {
            return ['status' => 'skipped', 'reason' => 'Order not paid'];
        }

        if ($order->payment_method === 'cash') {
            return ['status' => 'skipped', 'reason' => 'Cash payment'];
        }

        $refundNo = 'REF-' . $order->order_code . '-' . time();
        $amount = (int) $order->total;

        if ($order->payment_method === 'credit_card') {
            return $this->refundCreditCard($order, $refundNo, $amount, $reason);
        }

        return $this->refundDirectDebit($order, $refundNo, $amount, $reason);
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
     */
    private function markOrderPaid(Order $order): void
    {
        // Atomic update — only one concurrent request can succeed
        $updated = Order::where('id', $order->id)
            ->where('payment_status', '!=', 'paid')
            ->update([
                'paid_at' => now(),
                'payment_status' => 'paid',
            ]);

        if ($updated === 0) {
            return; // Already paid by concurrent request
        }

        // Reload to get fresh state
        $order->refresh();

        // Transition order status via state machine (creates history, handles side effects)
        if ($order->status === Order::STATUS_PENDING_CONFIRMATION) {
            try {
                app(OrderStatusService::class)->updateStatus($order, Order::STATUS_CONFIRMED);
            } catch (\Illuminate\Validation\ValidationException $e) {
                // Already transitioned by concurrent request — safe to ignore
                Log::info('Order status transition skipped (already transitioned)', [
                    'order_id' => $order->id,
                    'current_status' => $order->fresh()->status,
                ]);
            }
        }

        // Notify outlet about new paid order
        app(NotificationService::class)->notifyOrderCreated($order);

        Cache::forget("outlet:{$order->outlet_id}:pending_orders");
        Cache::forget('owner:pending_counts');
        Cache::forget('owner:order_stats');
    }

    /**
     * Process payment status change — shared by webhook and status sync.
     * Handles: paid, failed, expired transitions.
     * Public so DokuPaymentController can use it as fallback when syncStatusFromDoku fails.
     */
    public function processPaymentStatusChange(Order $order, string $status): void
    {
        if ($status === 'paid' && $order->payment_status !== 'paid') {
            $this->markOrderPaid($order);
        } elseif (in_array($status, ['failed', 'expired'], true) && $order->payment_status === 'pending') {
            // Mark payment as failed/expired — but keep order as pending_confirmation
            // so customer can retry payment via the confirm page.
            // Reset confirmation_expires_at so customer gets a fresh retry window
            // instead of being left with the remnant of the original 15-min outlet timeout.
            $retryWindowMinutes = config('order.payment_retry_window_minutes', 15);
            $order->update([
                'payment_status' => $status,
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

    private function refundCreditCard(Order $order, string $refundNo, int $amount, string $reason): array
    {
        $requestId = $refundNo;
        $timestamp = now('UTC')->format('Y-m-d\TH:i:s\Z');
        $endpoint = '/v1/refund';

        $body = [
            'order' => [
                'invoice_number' => $order->order_code,
            ],
            'payment' => [
                'original_request_id' => $order->doku_order_id,
            ],
            'refund' => [
                'amount' => $amount,
                'type' => 'FULL_REFUND',
            ],
        ];

        $headers = $this->generateHeaders($requestId, $timestamp, $endpoint, json_encode($body));

        try {
            $response = Http::withHeaders($headers)
                ->withBody(json_encode($body), 'application/json')
                ->post($this->baseUrl . $endpoint);

            return $this->handleRefundResponse($order, $response->json(), $refundNo);
        } catch (\Exception $e) {
            Log::error('DOKU credit card refund failed', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
            ]);

            $order->update([
                'payment_status' => 'refund_failed',
                'refund_reason' => $e->getMessage(),
            ]);

            return ['status' => 'failed', 'error' => $e->getMessage()];
        }
    }

    private function refundDirectDebit(Order $order, string $refundNo, int $amount, string $reason): array
    {
        $requestId = $refundNo;
        $timestamp = now('UTC')->format('Y-m-d\TH:i:s\Z');
        $endpoint = '/direct-debit/core/v1/debit/refund';

        $body = [
            'originalPartnerReferenceNo' => $order->order_code,
            'partnerRefundNo' => $refundNo,
            'refundAmount' => [
                'value' => number_format($amount, 2, '.', ''),
                'currency' => 'IDR',
            ],
            'reason' => $reason,
            'additionalInfo' => [
                'originalExternalId' => $order->doku_order_id,
            ],
        ];

        $headers = $this->generateHeaders($requestId, $timestamp, $endpoint, json_encode($body));

        try {
            $response = Http::withHeaders($headers)
                ->withBody(json_encode($body), 'application/json')
                ->post($this->baseUrl . $endpoint);

            return $this->handleRefundResponse($order, $response->json(), $refundNo);
        } catch (\Exception $e) {
            Log::error('DOKU direct debit refund failed', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
            ]);

            $order->update([
                'payment_status' => 'refund_failed',
                'refund_reason' => $e->getMessage(),
            ]);

            return ['status' => 'failed', 'error' => $e->getMessage()];
        }
    }

    private function handleRefundResponse(Order $order, array $response, string $refundNo): array
    {
        $isSuccess = ($response['refund']['status'] ?? '') === 'SUCCESS'
            || ($response['transactionStatus'] ?? '') === 'SUCCESS';

        if ($isSuccess) {
            $order->update([
                'payment_status' => 'refunded',
                'refunded_at' => now(),
                'refund_amount' => $order->total,
                'refund_reason' => $order->refund_reason ?? 'Order cancelled',
                'doku_refund_id' => $refundNo,
            ]);

            return ['status' => 'success', 'refund_id' => $refundNo];
        }

        $errorMessage = $response['error']['message'] ?? $response['refund']['reason'] ?? 'Unknown error';

        $order->update([
            'payment_status' => 'refund_failed',
            'refund_reason' => $errorMessage,
        ]);

        Log::error('DOKU refund failed', [
            'order_id' => $order->id,
            'order_code' => $order->order_code,
            'error' => $errorMessage,
            'response' => $response,
        ]);

        return ['status' => 'failed', 'error' => $errorMessage];
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
