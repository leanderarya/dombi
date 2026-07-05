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
    private string $apiKey;

    public function __construct()
    {
        $this->baseUrl = config('doku.base_url') ?? 'https://api-sandbox.doku.com';
        $this->clientId = config('doku.client_id') ?? '';
        $this->apiKey = config('doku.api_key') ?? '';
    }

    /**
     * Create a DOKU payment for an order.
     * Returns the DOKU hosted payment page URL.
     */
    public function createPayment(Order $order): string
    {
        $requestId = 'DMB-'.$order->id.'-'.time();
        $invoiceNumber = $order->order_code;
        $amount = (int) $order->total;

        $body = [
            'order' => [
                'invoice_number' => $invoiceNumber,
                'amount' => $amount,
            ],
            'payment' => [
                'payment_due_date' => now()->addMinutes(30)->format('Y-m-d H:i:s'),
                'payment_method' => 'QRIS',
            ],
            'customer' => [
                'name' => $order->customer_name,
                'email' => $order->customer_email ?? '',
                'phone' => $order->customer_phone ?? '',
            ],
        ];

        $response = Http::withHeaders($this->generateHeaders($requestId, json_encode($body)))
            ->timeout(30)
            ->post($this->baseUrl.'/v1/payment-url', $body);

        if (! $response->successful()) {
            Log::error('DOKU createPayment failed', [
                'order_id' => $order->id,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new \Exception('DOKU payment creation failed: '.$response->body());
        }

        $data = $response->json();
        $paymentUrl = $data['payment']['url'] ?? null;
        $dokuOrderId = $data['order']['invoice_number'] ?? $invoiceNumber;

        if (! $paymentUrl) {
            throw new \Exception('DOKU response missing payment URL');
        }

        // Log transaction
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => $dokuOrderId,
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'pending',
            'raw_response' => $data,
        ]);

        // Update order
        $order->update([
            'doku_order_id' => $dokuOrderId,
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
     * SHA256(clientId + requestId + requestBody + apiKey)
     */
    public function verifySignature(array $payload, string $requestId, string $rawBody): bool
    {
        $signatureInput = $this->clientId.$requestId.$rawBody.$this->apiKey;
        $expected = hash('sha256', $signatureInput);
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

        try {
            $response = Http::withHeaders($this->generateHeaders($requestId, ''))
                ->timeout(10)
                ->get($this->baseUrl.'/v1/orders/'.$order->doku_order_id);

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
     * Generate DOKU API headers with signature.
     */
    private function generateHeaders(string $requestId, string $body): array
    {
        $signature = hash('sha256', $this->clientId.$requestId.$body.$this->apiKey);

        return [
            'Client-Id' => $this->clientId,
            'Request-Id' => $requestId,
            'Signature' => $signature,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ];
    }
}
