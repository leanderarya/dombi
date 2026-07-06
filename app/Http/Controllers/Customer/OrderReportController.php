<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderReport;
use App\Models\User;
use App\Notifications\NewOrderReportNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class OrderReportController extends Controller
{
    public function store(Request $request, Order $order): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['error' => 'Unauthorized.'], 401);
        }

        $customer = $user->getCustomerOrCreate();

        // Guard: ownership
        if ($order->customer_id !== $customer->id) {
            return response()->json(['error' => 'Anda tidak memiliki akses ke pesanan ini.'], 403);
        }

        // Guard: must be completed
        if ($order->status !== Order::STATUS_COMPLETED) {
            return response()->json(['error' => 'Hanya pesanan selesai yang bisa dilaporkan.'], 422);
        }

        // Guard: time window (7 days)
        if ($order->completed_at && $order->completed_at->lt(now()->subDays(7))) {
            return response()->json(['error' => 'Batas waktu pelaporan sudah habis (7 hari).'], 422);
        }

        // Guard: no active report
        $hasActiveReport = OrderReport::where('order_id', $order->id)
            ->active()
            ->exists();

        if ($hasActiveReport) {
            return response()->json(['error' => 'Anda sudah memiliki laporan aktif untuk pesanan ini.'], 422);
        }

        $validated = $request->validate([
            'type' => ['required', Rule::in(OrderReport::TYPES)],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $report = DB::transaction(function () use ($order, $customer, $validated) {
            return OrderReport::create([
                'order_id' => $order->id,
                'customer_id' => $customer->id,
                'type' => $validated['type'],
                'notes' => $validated['notes'] ?? null,
                'status' => OrderReport::STATUS_PENDING,
            ]);
        });

        // Notify owner
        $owner = User::where('role', 'owner')->first();
        if ($owner) {
            $owner->notify(new NewOrderReportNotification($report));
        }

        // Notify outlet
        if ($order->outlet_id) {
            $outletUsers = User::where('role', 'outlet')
                ->where('outlet_id', $order->outlet_id)
                ->get();

            foreach ($outletUsers as $outletUser) {
                $outletUser->notify(new NewOrderReportNotification($report));
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Laporan berhasil dikirim.',
            'report' => [
                'id' => $report->id,
                'type' => $report->type,
                'status' => $report->status,
                'type_label' => $report->typeLabel(),
                'status_label' => $report->statusLabel(),
            ],
        ]);
    }
}
