<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Services\DokuService;
use Illuminate\Http\JsonResponse;
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

        // Verify webhook signature
        if (! $doku->verifySignature($payload, $requestId, $rawBody)) {
            Log::warning('DOKU webhook: invalid signature', ['request_id' => $requestId]);
            return response()->json(['message' => 'Invalid signature'], 401);
        }

        // Idempotency: use Request-Id as dedup key (DOKU retries with same ID)
        $idempotencyKey = 'doku_webhook:'.$requestId;
        if (Cache::has($idempotencyKey)) {
            Log::info('DOKU webhook: duplicate, already processed', ['request_id' => $requestId]);
            return response()->json(['message' => 'OK']);
        }

        try {
            $doku->handleWebhook($payload);

            // Mark as processed after successful handling
            Cache::put($idempotencyKey, true, 86400); // 24h TTL
        } catch (\Exception $e) {
            Log::error('DOKU webhook error', [
                'error' => $e->getMessage(),
                'payload' => $payload,
            ]);
            return response()->json(['message' => 'Internal error'], 500);
        }

        return response()->json(['message' => 'OK']);
    }

    public function redirect(Request $request): \Illuminate\Http\RedirectResponse
    {
        $invoiceNumber = $request->query('invoice_number') ?? $request->query('order_id');
        $status = $request->query('status');

        if ($invoiceNumber) {
            $order = Order::where('order_code', $invoiceNumber)->first()
                ?? Order::where('doku_order_id', $invoiceNumber)->first();

            if ($order) {
                return redirect()->route('customer.orders.confirm', [
                    'orderCode' => $order->order_code,
                ]);
            }
        }

        return redirect()->route('customer.home');
    }
}
