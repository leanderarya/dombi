<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PaymentAccount;
use App\Models\Settlement;
use App\Models\SettlementPayment;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class SettlementController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $outlet = $user->outlet;

        abort_unless($outlet, 403);

        $period = $request->string('period', 'all')->toString();
        [$from, $to] = $this->resolvePeriod($period, $request);

        // Weekly settlements for this outlet
        $settlements = Settlement::where('outlet_id', $outlet->id)
            ->where('period_type', 'weekly')
            ->when($from, fn ($q) => $q->where('period_end', '>=', $from->toDateString()))
            ->when($to, fn ($q) => $q->where('period_start', '<=', $to->toDateString()))
            ->orderByDesc('period_start')
            ->get();

        // Aggregate totals across selected period
        $totalDue = (float) $settlements->sum('amount_due');
        $totalPaid = (float) $settlements->sum('paid_amount');
        $totalAdjustment = (float) $settlements->sum('adjustment_amount');
        $totalOutstanding = (float) $settlements->sum(fn ($s) => $s->outstanding_amount);
        $totalSales = (float) $settlements->sum('sales_amount');
        $totalDeliveryFee = (float) $settlements->sum('delivery_fee_amount');

        // Margin: sum outlet_margin_snapshot * quantity from completed orders in the period
        $orderIds = $settlements->flatMap(function ($s) use ($outlet) {
            return Order::where('outlet_id', $outlet->id)
                ->where('status', 'completed')
                ->whereDate('completed_at', '>=', $s->period_start->toDateString())
                ->whereDate('completed_at', '<=', $s->period_end->toDateString())
                ->pluck('id');
        })->unique();
        $outletMargin = OrderItem::whereIn('order_id', $orderIds)->sum(DB::raw('outlet_margin_snapshot * quantity'));

        // Verified payments (all-time for this outlet — payment can be for any period)
        $verifiedPayments = SettlementPayment::where('outlet_id', $outlet->id)
            ->where('status', SettlementPayment::STATUS_VERIFIED)
            ->sum('amount');

        $pendingPayments = SettlementPayment::where('outlet_id', $outlet->id)
            ->where('status', SettlementPayment::STATUS_PENDING)
            ->sum('amount');

        $rejectedPayments = SettlementPayment::where('outlet_id', $outlet->id)
            ->where('status', SettlementPayment::STATUS_REJECTED)
            ->sum('amount');

        // Recent payments (last 10)
        $payments = SettlementPayment::query()
            ->where('outlet_id', $outlet->id)
            ->with('verifier')
            ->latest('payment_date')
            ->limit(10)
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'amount' => (float) $p->amount,
                'reference_number' => $p->reference_number,
                'payment_date' => $p->payment_date->toDateString(),
                'status' => $p->status,
                'notes' => $p->notes,
                'rejection_reason' => $p->rejection_reason,
                'verifier' => $p->verifier?->name,
                'verified_at' => $p->verified_at?->toISOString(),
            ]);

        $hasPendingPayment = SettlementPayment::where('outlet_id', $outlet->id)
            ->where('status', SettlementPayment::STATUS_PENDING)
            ->exists();

        $lastPayment = SettlementPayment::where('outlet_id', $outlet->id)
            ->where('status', SettlementPayment::STATUS_VERIFIED)
            ->latest('payment_date')
            ->first();

        // Summary
        $summary = [
            'gross_revenue' => $totalSales + $totalDeliveryFee,
            'sales_amount' => $totalSales,
            'delivery_fee_amount' => $totalDeliveryFee,
            'center_share' => $totalDue,
            'outlet_margin' => (float) $outletMargin,
            'settled_amount' => $totalPaid,
            'outstanding_amount' => $totalOutstanding,
            'units_sold' => 0,
            'orders_count' => $orderIds->count(),
            'top_products' => [],
        ];

        $reconciliation = [
            'center_share' => $totalDue,
            'verified_payments' => (float) $verifiedPayments,
            'pending_payments' => (float) $pendingPayments,
            'rejected_payments' => (float) $rejectedPayments,
            'outstanding' => $totalOutstanding,
            'adjustments' => $totalAdjustment,
            'last_payment' => $lastPayment ? [
                'date' => $lastPayment->payment_date->toDateString(),
                'amount' => (float) $lastPayment->amount,
                'reference' => $lastPayment->reference_number,
            ] : null,
        ];

        // Weekly settlement timeline
        $timeline = $settlements->map(fn ($s) => [
            'id' => $s->id,
            'type' => 'settlement',
            'amount' => (float) $s->amount_due,
            'center_share' => (float) $s->amount_due,
            'outlet_margin' => 0,
            'period_label' => $s->period_label,
            'period_start' => $s->period_start->toDateString(),
            'period_end' => $s->period_end->toDateString(),
            'due_date' => $s->due_date->toDateString(),
            'status' => $s->status,
            'outstanding' => (float) $s->outstanding_amount,
            'notes' => "Settlement {$s->period_label}",
            'created_at' => $s->created_at->toISOString(),
        ]);

        return Inertia::render('outlet/settlement', [
            'summary' => $summary,
            'reconciliation' => $reconciliation,
            'payments' => $payments,
            'timeline' => $timeline,
            'paymentAccounts' => PaymentAccount::active()->orderBy('bank_name')->get(),
            'hasPendingPayment' => $hasPendingPayment,
            'period' => $period,
            'periodRange' => $from && $to ? [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
            ] : null,
        ]);
    }

    private function resolvePeriod(string $period, Request $request): array
    {
        return match ($period) {
            'all' => [null, null],
            'month' => [now()->startOfMonth(), now()->endOfMonth()],
            'custom' => [
                Carbon::parse($request->string('from', now()->startOfMonth()->toDateString())),
                Carbon::parse($request->string('to', now()->toDateString()))->endOfDay(),
            ],
            default => [null, null],
        };
    }
}
