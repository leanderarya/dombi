<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\PaymentWebhookLog;
use App\Services\DokuService;
use App\Services\DokuWebhookIngressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class DokuPaymentController extends Controller
{
    public function notify(Request $request, DokuWebhookIngressService $ingress): JsonResponse
    {
        if ($request->isMethod('GET')) {
            return response()->json(['message' => 'OK']);
        }

        $receipt = $ingress->receive($request->getContent(), $request->headers->all());

        return response()->json(['message' => $receipt->message], $receipt->statusCode);

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

                    return redirect()->route('customer.orders.confirm', [
                        'orderCode' => $order->order_code,
                    ])->with('error', 'Status pembayaran belum dapat diverifikasi.');
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
