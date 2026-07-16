<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\PaymentWebhookLog;
use App\Services\DokuService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class DokuPaymentController extends Controller
{
    public function notify(Request $request, DokuService $doku): JsonResponse
    {
        $rawBody = $request->getContent();
        $payload = json_decode($rawBody, true) ?? [];
        $requestId = $request->header('Request-Id', '');
        $invoiceNumber = $payload['order']['invoice_number'] ?? $request->query('invoice_number') ?? null;

        // DOKU sends GET requests for endpoint verification — return OK without processing
        if ($request->isMethod('GET')) {
            Log::debug('DOKU webhook: GET verification request, returning OK');
            return response()->json(['message' => 'OK']);
        }

        $log = PaymentWebhookLog::create([
            'request_id' => $requestId,
            'source' => 'notify',
            'invoice_number' => $invoiceNumber,
            'status' => 'received',
            'signature_valid' => false,
            'payload' => $payload,
        ]);

        Log::debug('DOKU webhook received', [
            'method' => $request->method(),
            'request_id' => $requestId,
        ]);

        // Verify webhook signature
        $clientIdHeader = $request->header('Client-Id');
        if (! $doku->verifySignature(
            $payload,
            $requestId,
            $rawBody,
            $request->header('Request-Timestamp'),
            $request->header('Signature'),
            $clientIdHeader
        )) {
            Log::warning('DOKU webhook: invalid signature', ['request_id' => $requestId]);
            $log->update(['status' => 'signature_invalid']);

            return response()->json(['message' => 'Invalid signature'], 401);
        }

        // Idempotency: use Request-Id as dedup key (DOKU retries with same ID)
        $idempotencyKey = 'doku_webhook:'.$requestId;
        if (Cache::has($idempotencyKey)) {
            Log::info('DOKU webhook: duplicate, already processed', ['request_id' => $requestId]);
            $log->update(['status' => 'processed', 'signature_valid' => true]);

            return response()->json(['message' => 'OK']);
        }

        try {
            $doku->handleWebhook($payload);

            // Mark as processed after successful handling
            Cache::put($idempotencyKey, true, 86400); // 24h TTL
            $log->update(['status' => 'processed', 'signature_valid' => true]);
        } catch (\Exception $e) {
            Log::error('DOKU webhook error', [
                'error' => $e->getMessage(),
                'payload' => $payload,
            ]);
            $log->update(['status' => 'error', 'error' => $e->getMessage()]);

            return response()->json(['message' => 'Internal error'], 500);
        }

        return response()->json(['message' => 'OK']);
    }

    public function redirect(Request $request, DokuService $doku): RedirectResponse
    {
        $invoiceNumber = $request->query('invoice_number') ?? $request->query('order_id');
        $dokuStatus = $request->query('status');

        PaymentWebhookLog::create([
            'source' => 'redirect',
            'invoice_number' => $invoiceNumber,
            'status' => 'received',
            'signature_valid' => false,
            'payload' => $request->query(),
        ]);

        Log::info('Doku redirect hit', [
            'invoice_number' => $invoiceNumber,
            'doku_status' => $dokuStatus,
        ]);

        if ($invoiceNumber) {
            $order = Order::where('order_code', $invoiceNumber)->first()
                ?? Order::where('doku_order_id', $invoiceNumber)->first();

            if ($order) {
                // Doku may not have finished processing yet — retry status check with delay
                $synced = false;
                for ($attempt = 1; $attempt <= 3; $attempt++) {
                    try {
                        $doku->syncStatusFromDoku($order);
                        $order->refresh();
                        if ($order->payment_status !== 'pending') {
                            $synced = true;
                            break;
                        }
                    } catch (\Exception $e) {
                        Log::warning("Doku redirect: sync attempt {$attempt} failed", [
                            'order_id' => $order->id,
                            'error' => $e->getMessage(),
                        ]);
                    }
                    if ($attempt < 3) {
                        usleep(1_500_000); // 1.5s delay between retries
                    }
                }

                if (! $synced) {
                    Log::warning('Doku redirect: all sync attempts failed', [
                        'order_id' => $order->id,
                        'doku_status_param' => $dokuStatus,
                    ]);

                    // Fallback: use redirect status query param if available
                    if ($dokuStatus && $order->payment_status !== 'paid') {
                        $mappedStatus = $doku->mapStatus($dokuStatus);
                        Log::info('Doku redirect: using fallback status from query param', [
                            'order_id' => $order->id,
                            'doku_status' => $dokuStatus,
                            'mapped_status' => $mappedStatus,
                        ]);
                        $doku->processPaymentStatusChange($order, $mappedStatus);
                        $order->refresh();
                    }
                }

                return redirect()->route('customer.orders.confirm', [
                    'orderCode' => $order->order_code,
                ]);
            }

            Log::warning('Doku redirect: order not found', ['invoice_number' => $invoiceNumber]);
        }

        return redirect()->route('customer.home');
    }
}
