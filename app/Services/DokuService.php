<?php

namespace App\Services;

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
            ],
        ];

        $bodyJson = json_encode($body);
        $endpoint = '/checkout/v1/payment';

        $headers = $this->generateHeaders($requestId, $timestamp, $endpoint, $bodyJson);

        $response = Http::withHeaders($headers)
            ->timeout(30)
            ->post($this->baseUrl.$endpoint, $body);

        if (! $response->successful()) {
            Log::error('DOKU createPayment failed', [
                'order_id' => $order->id,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new \Exception('DOKU payment creation failed: '.$response->body());
        }

        $data = $response->json();
        $paymentUrl = $data['response']['payment']['url'] ?? $data['payment']['url'] ?? null;
        $sessionId = $data['response']['order']['session_id'] ?? null;

        if (! $paymentUrl) {
            throw new \Exception('DOKU response missing payment URL: '.json_encode($data));
        }

        // Log transaction
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => $invoiceNumber,
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'pending',
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
     */
    public function handleWebhook(array $payload): void
    {
        $invoiceNumber = $payload['order']['invoice_number'] ?? null;
        $paymentStatus = $payload['transaction']['status'] ?? null;

        if (! $invoiceNumber) {
            Log::warning('DOKU webhook: missing invoice_number');
            return;
        }

        $transaction = PaymentTransaction::where('doku_order_id', $invoiceNumber)->first();
        if (! $transaction) {
            Log::warning('DOKU webhook: transaction not found', ['invoice_number' => $invoiceNumber]);
            return;
        }

        $order = $transaction->order;
        if (! $order) {
            return;
        }

        // Idempotency: skip if already in terminal state
        if (in_array($order->payment_status, ['paid', 'refunded'], true)) {
            Log::info('DOKU webhook: order already in terminal state, skipping', [
                'order_id' => $order->id,
            ]);
            return;
        }

        $status = $this->mapStatus($paymentStatus);

        $transaction->update([
            'status' => $status,
            'raw_response' => $payload,
        ]);

        if ($status === 'paid') {
            $this->markOrderPaid($order);
        } elseif (in_array($status, ['failed', 'expired']) && $order->payment_status === 'pending') {
            $order->update(['payment_status' => $status]);
        }

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
    public function verifySignature(array $payload, string $requestId, string $rawBody): bool
    {
        $timestamp = $payload['timestamp'] ?? '';
        $requestTarget = '/payment/doku/notify';

        $digest = base64_encode(hash('sha256', $rawBody, true));

        $assembled = "Client-Id:{$this->clientId}\n"
            ."Request-Id:{$requestId}\n"
            ."Request-Timestamp:{$timestamp}\n"
            ."Request-Target:{$requestTarget}\n"
            ."Digest:{$digest}";

        $expected = 'HMACSHA256='.base64_encode(hash_hmac('sha256', $assembled, $this->secretKey, true));
        $provided = $payload['signature'] ?? '';

        return hash_equals($expected, $provided);
    }

    /**
     * Check transaction status from DOKU API.
     */
    public function checkStatus(Order $order): ?array
    {
        if (empty($order->doku_order_id)) {
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

            Log::warning('DOKU status check failed', [
                'order_id' => $order->id,
                'status_code' => $response->status(),
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

        if ($status === 'paid' && $order->payment_status !== 'paid') {
            $this->markOrderPaid($order);
        } elseif (in_array($status, ['failed', 'expired']) && $order->payment_status === 'pending') {
            $order->update(['payment_status' => $status]);
        }

        return $status;
    }

    /**
     * Map DOKU payment status to Dombi status.
     */
    public function mapStatus(?string $dokuStatus): string
    {
        return match (strtoupper($dokuStatus ?? '')) {
            'SUCCESS' => 'paid',
            'PENDING' => 'pending',
            'FAILED' => 'failed',
            'EXPIRED' => 'expired',
            default => 'pending',
        };
    }

    /**
     * Mark order as paid and trigger side effects.
     */
    private function markOrderPaid(Order $order): void
    {
        if ($order->payment_status === 'paid') {
            return;
        }

        $order->update(['paid_at' => now(), 'payment_status' => 'paid']);

        if ($order->status === Order::STATUS_PENDING_CONFIRMATION) {
            $order->update(['status' => Order::STATUS_CONFIRMED, 'confirmed_at' => now()]);
            app(NotificationService::class)->notifyOrderConfirmed($order);
        }

        Cache::forget("outlet:{$order->outlet_id}:pending_orders");
        Cache::forget('owner:pending_counts');
        Cache::forget('owner:order_stats');
    }

    /**
     * Generate DOKU Non-SNAP API headers with HMAC-SHA256 signature.
     */
    private function generateHeaders(string $requestId, string $timestamp, string $endpoint, string $body): array
    {
        $digest = base64_encode(hash('sha256', $body, true));

        $assembled = "Client-Id:{$this->clientId}\n"
            ."Request-Id:{$requestId}\n"
            ."Request-Timestamp:{$timestamp}\n"
            ."Request-Target:{$endpoint}\n"
            ."Digest:{$digest}";

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
