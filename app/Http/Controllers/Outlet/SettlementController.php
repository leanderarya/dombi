<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\OfflineSale;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PaymentAccount;
use App\Models\Settlement;
use App\Models\SettlementPayment;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
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
                'proof_image' => $p->proof_image,
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

        // Units sold from completed orders in period
        $unitsSold = 0;
        if ($orderIds->isNotEmpty()) {
            $unitsSold = (int) OrderItem::whereIn('order_id', $orderIds)->sum('quantity');
        }

        // Summary (no dead fields)
        $netTotal = (float) $settlements->sum('net_amount');
        $summary = [
            'gross_revenue' => $totalSales + $totalDeliveryFee,
            'sales_amount' => $totalSales,
            'delivery_fee_amount' => $totalDeliveryFee,
            'center_share' => $totalDue,
            'outlet_margin' => (float) $outletMargin,
            'settled_amount' => $totalPaid,
            'outstanding_amount' => $totalOutstanding,
            'units_sold' => $unitsSold,
            'orders_count' => $orderIds->count(),
            'net_amount' => $netTotal,
            'direction' => $netTotal >= 0 ? 'owner_pays_outlet' : 'outlet_pays_owner',
            'breakdown' => [
                'online_outlet_share' => (float) $settlements->sum('total_online_share'),
                'delivery_cost' => (float) $settlements->sum('total_delivery_cost'),
                'refund' => (float) $settlements->sum('total_refund'),
                'offline_sales' => (float) $settlements->sum('total_offline_sales'),
            ],
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

        // Weekly settlement timeline with per-period margin
        $timeline = $settlements->map(function ($s) use ($outlet) {
            // Margin for this specific week
            $weekOrderIds = Order::where('outlet_id', $outlet->id)
                ->where('status', 'completed')
                ->whereDate('completed_at', '>=', $s->period_start->toDateString())
                ->whereDate('completed_at', '<=', $s->period_end->toDateString())
                ->pluck('id');

            $weekMargin = $weekOrderIds->isNotEmpty()
                ? (float) OrderItem::whereIn('order_id', $weekOrderIds)->sum(DB::raw('outlet_margin_snapshot * quantity'))
                : 0;

            return [
                'id' => $s->id,
                'type' => 'settlement',
                'amount' => (float) $s->amount_due,
                'center_share' => (float) $s->amount_due,
                'outlet_margin' => $weekMargin,
                'period_label' => $s->period_label,
                'period_start' => $s->period_start->toDateString(),
                'period_end' => $s->period_end->toDateString(),
                'due_date' => $s->due_date->toDateString(),
                'status' => $s->status,
                'outstanding' => (float) $s->outstanding_amount,
                'net_amount' => (float) $s->net_amount,
                'direction' => $s->direction,
                'breakdown' => [
                    'online_outlet_share' => (float) $s->total_online_share,
                    'delivery_cost' => (float) $s->total_delivery_cost,
                    'refund' => (float) $s->total_refund,
                    'offline_sales' => (float) $s->total_offline_sales,
                ],
                'notes' => "Settlement {$s->period_label}",
                'created_at' => $s->created_at->toISOString(),
            ];
        });

        return Inertia::render('outlet/settlement', [
            'summary' => $summary,
            'reconciliation' => $reconciliation,
            'payments' => $payments,
            'timeline' => $timeline,
            'paymentAccounts' => PaymentAccount::active()->orderBy('bank_name')->get(),
            'outletBank' => [
                'bank_name' => $outlet->bank_name,
                'bank_account_number' => $outlet->bank_account_number,
                'bank_account_holder' => $outlet->bank_account_holder,
            ],
            'hasPendingPayment' => $hasPendingPayment,
            'period' => $period,
            'periodRange' => $from && $to ? [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
            ] : null,
        ]);
    }

    public function show(Request $request, Settlement $settlement): Response
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet && $settlement->outlet_id === $outlet->id, 403);

        $weekStart = $settlement->period_start->toDateString();
        $weekEnd = $settlement->period_end->toDateString();

        $offlineSales = OfflineSale::where('outlet_id', $outlet->id)
            ->whereDate('created_at', '>=', $weekStart)
            ->whereDate('created_at', '<=', $weekEnd)
            ->with(['product.category'])
            ->get()
            ->map(fn ($s) => [
                'id' => $s->id,
                'product_name' => $s->product?->category?->name
                    ? "{$s->product->category->name} - {$s->product->name}"
                    : ($s->product?->name ?? '-'),
                'quantity' => $s->quantity,
                'total_amount' => (float) $s->total_amount,
                'payment_method' => $s->payment_method,
                'created_at' => $s->created_at->toDateTimeString(),
            ]);

        $payments = SettlementPayment::where('outlet_id', $outlet->id)
            ->where('status', SettlementPayment::STATUS_VERIFIED)
            ->latest('payment_date')
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'amount' => (float) $p->amount,
                'reference' => $p->reference_number,
                'date' => $p->payment_date->toDateString(),
                'direction' => $p->direction,
            ]);

        return Inertia::render('outlet/settlement-show', [
            'settlement' => [
                'period_label' => $settlement->period_label,
                'period_start' => $weekStart,
                'period_end' => $weekEnd,
                'due_date' => $settlement->due_date->toDateString(),
                'status' => $settlement->status,
                'gross_revenue' => (float) $settlement->sales_amount + (float) $settlement->delivery_fee_amount,
                'sales_amount' => (float) $settlement->sales_amount,
                'delivery_fee_amount' => (float) $settlement->delivery_fee_amount,
                'online_share' => (float) $settlement->total_online_share,
                'delivery_cost' => (float) $settlement->total_delivery_cost,
                'refund' => (float) $settlement->total_refund,
                'offline_sales' => (float) $settlement->total_offline_sales,
                'adjustments' => (float) $settlement->adjustment_amount,
                'net_amount' => (float) $settlement->net_amount,
                'direction' => $settlement->direction,
                'amount_due' => (float) $settlement->amount_due,
                'paid_amount' => (float) $settlement->paid_amount,
                'outstanding' => (float) $settlement->outstanding_amount,
            ],
            'offlineSales' => $offlineSales,
            'payments' => $payments,
            'outlet' => [
                'name' => $outlet->name,
                'bank_name' => $outlet->bank_name,
                'bank_account_number' => $outlet->bank_account_number,
                'bank_account_holder' => $outlet->bank_account_holder,
            ],
        ]);
    }

    public function updateBank(Request $request): RedirectResponse
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet, 403);

        $validated = $request->validate([
            'bank_name' => ['nullable', 'string', 'max:100'],
            'bank_account_number' => ['nullable', 'string', 'max:50'],
            'bank_account_holder' => ['nullable', 'string', 'max:100'],
        ]);

        $outlet->update($validated);

        return back()->with('success', 'Rekening pembayaran diperbarui.');
    }

    private function resolvePeriod(string $period, Request $request): array
    {
        return match ($period) {
            'all' => [null, null],
            'month' => [now()->startOfMonth(), now()->endOfMonth()],
            'week' => [now()->startOfWeek(), now()->endOfWeek()],
            'custom' => [
                Carbon::parse($request->string('from', now()->startOfMonth()->toDateString())),
                Carbon::parse($request->string('to', now()->toDateString()))->endOfDay(),
            ],
            default => [null, null],
        };
    }
}
