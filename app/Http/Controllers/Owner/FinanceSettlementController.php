<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\PaymentAccount;
use App\Models\Settlement;
use App\Models\SettlementAuditLog;
use App\Models\SettlementPayment;
use App\Services\SettlementPaymentService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FinanceSettlementController extends Controller
{
    /**
     * Dashboard Tagihan — all outlets with sales + settlement aggregation.
     */
    public function dashboard(): Response
    {
        // Don't cache Eloquent models — they have serialization issues
        $outlets = Outlet::where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name']);

        // Aggregate completed orders per outlet (exclude delivery_fee from sales)
        $orderAgg = Order::where('status', 'completed')
            ->selectRaw('outlet_id, COUNT(*) as total_orders, SUM(total - delivery_fee) as total_sales, MAX(created_at) as last_order_date')
            ->groupBy('outlet_id')
            ->get()
            ->keyBy('outlet_id');

        // Get ALL weekly settlements for aggregation
        $allSettlements = Settlement::where('period_type', 'weekly')->with('outlet:id,name')->get();

        // Group settlements by outlet
        $settlementMap = [];
        foreach ($allSettlements as $s) {
            $oid = $s->outlet_id;
            if (! isset($settlementMap[$oid])) {
                $settlementMap[$oid] = [
                    'total_due' => 0,
                    'total_paid' => 0,
                    'total_outstanding' => 0,
                    'nearest_due_date' => null,
                    'has_overdue' => false,
                    'settlement_count' => 0,
                ];
            }
            $settlementMap[$oid]['total_due'] += (float) $s->amount_due;
            $settlementMap[$oid]['total_paid'] += (float) $s->paid_amount;
            $settlementMap[$oid]['total_outstanding'] += (float) $s->outstanding_amount;
            $settlementMap[$oid]['settlement_count']++;

            $dueDate = $s->due_date->toDateString();
            if (! $settlementMap[$oid]['nearest_due_date'] || $dueDate < $settlementMap[$oid]['nearest_due_date']) {
                $settlementMap[$oid]['nearest_due_date'] = $dueDate;
            }
            if ($s->due_date->isPast() && (float) $s->outstanding_amount > 0) {
                $settlementMap[$oid]['has_overdue'] = true;
            }
        }

        // Build outlet list — ALL active outlets
        $outletList = [];
        foreach ($outlets as $outlet) {
            $data = $settlementMap[$outlet->id] ?? null;
            $orders = $orderAgg->get($outlet->id);
            $totalSales = $orders ? (float) $orders->total_sales : 0;
            $totalOrders = $orders ? (int) $orders->total_orders : 0;
            $lastOrderDate = $orders?->last_order_date;

            if (! $data || $data['settlement_count'] === 0) {
                // No settlements — check if there are sales
                if ($totalOrders === 0) {
                    $displayStatus = 'no_activity';
                    $sortOrder = 5;
                } else {
                    $displayStatus = 'unsettled';
                    $sortOrder = 3;
                }
                $outletList[] = [
                    'outlet_id' => $outlet->id,
                    'outlet_name' => $outlet->name,
                    'total_sales' => $totalSales,
                    'total_orders' => $totalOrders,
                    'last_order_date' => $lastOrderDate ? Carbon::parse($lastOrderDate)->toDateString() : null,
                    'total_due' => 0,
                    'total_paid' => 0,
                    'total_outstanding' => 0,
                    'nearest_due_date' => null,
                    'display_status' => $displayStatus,
                    'sort_order' => $sortOrder,
                ];
            } else {
                $outstanding = $data['total_outstanding'];
                $paid = $data['total_paid'];

                if ($outstanding <= 0 && $paid > 0) {
                    $displayStatus = 'paid';
                    $sortOrder = 4;
                } elseif ($outstanding > 0 && $paid > 0) {
                    $displayStatus = $data['has_overdue'] ? 'overdue' : 'partial';
                    $sortOrder = $data['has_overdue'] ? 0 : 2;
                } elseif ($outstanding > 0) {
                    $displayStatus = $data['has_overdue'] ? 'overdue' : 'unpaid';
                    $sortOrder = $data['has_overdue'] ? 0 : 1;
                } else {
                    $displayStatus = 'paid';
                    $sortOrder = 4;
                }

                $outletList[] = [
                    'outlet_id' => $outlet->id,
                    'outlet_name' => $outlet->name,
                    'total_sales' => $totalSales,
                    'total_orders' => $totalOrders,
                    'last_order_date' => $lastOrderDate ? Carbon::parse($lastOrderDate)->toDateString() : null,
                    'total_due' => (float) $data['total_due'],
                    'total_paid' => (float) $data['total_paid'],
                    'total_outstanding' => (float) $outstanding,
                    'nearest_due_date' => $data['nearest_due_date'],
                    'display_status' => $displayStatus,
                    'sort_order' => $sortOrder,
                ];
            }
        }

        // Sort: overdue first, then by sort_order, then by outstanding desc
        usort($outletList, function ($a, $b) {
            if ($a['sort_order'] !== $b['sort_order']) {
                return $a['sort_order'] <=> $b['sort_order'];
            }

            return $b['total_outstanding'] <=> $a['total_outstanding'];
        });

        // KPIs
        $totalUnpaid = 0;
        $outletsUnpaid = 0;
        $dueThisWeek = 0;
        $weekFromNow = now()->addDays(7)->toDateString();

        foreach ($outletList as $o) {
            if ($o['total_outstanding'] > 0) {
                $totalUnpaid += $o['total_outstanding'];
                $outletsUnpaid++;
            }
        }

        foreach ($allSettlements as $s) {
            if ((float) $s->outstanding_amount > 0 && $s->due_date->toDateString() <= $weekFromNow) {
                $dueThisWeek += (float) $s->outstanding_amount;
            }
        }

        // Pembayaran tab data
        $status = request()->string('status', 'all')->toString();
        $paymentQuery = SettlementPayment::query()->with(['outlet', 'verifier', 'settlement']);
        if ($status !== 'all') {
            $paymentQuery->where('status', $status);
        }
        $payments = $paymentQuery->latest('payment_date')->paginate(20);

        $pendingCount = SettlementPayment::where('status', SettlementPayment::STATUS_PENDING)->count();
        $verifiedToday = SettlementPayment::where('status', SettlementPayment::STATUS_VERIFIED)
            ->whereDate('verified_at', now())
            ->sum('amount');
        $verifiedMonth = SettlementPayment::where('status', SettlementPayment::STATUS_VERIFIED)
            ->whereMonth('verified_at', now()->month)
            ->whereYear('verified_at', now()->year)
            ->sum('amount');

        // Rekening tab data
        $accounts = PaymentAccount::orderBy('bank_name')->get();

        return Inertia::render('owner/finance/index', [
            // Tagihan
            'kpis' => [
                'total_unpaid' => (float) $totalUnpaid,
                'outlets_unpaid' => (int) $outletsUnpaid,
                'due_this_week' => (float) $dueThisWeek,
            ],
            'outlets' => $outletList,
            // Pembayaran
            'payments' => $payments,
            'statusFilter' => $status,
            'paymentKpis' => [
                'pending_count' => $pendingCount,
                'verified_today' => (float) $verifiedToday,
                'verified_month' => (float) $verifiedMonth,
            ],
            // Rekening
            'accounts' => $accounts,
        ]);
    }

    /**
     * Per-outlet account statement.
     */
    public function outletDetail(Outlet $outlet): Response
    {
        $settlements = Settlement::where('outlet_id', $outlet->id)
            ->where('period_type', 'weekly')
            ->with('outlet:id,name')
            ->orderBy('period_start', 'asc')
            ->get();

        $unpaidSettlements = $settlements->filter(fn (Settlement $s) => $s->status !== Settlement::STATUS_PAID);
        $outstanding = $unpaidSettlements->sum(fn (Settlement $s) => (float) $s->outstanding_amount);

        $paidTotal = $settlements->where('status', Settlement::STATUS_PAID)->sum('paid_amount');

        $oldestUnpaid = $unpaidSettlements->sortBy('due_date')->first();
        $daysOverdue = $oldestUnpaid && $oldestUnpaid->due_date->isPast()
            ? (int) $oldestUnpaid->due_date->diffInDays(now(), false)
            : 0;

        // Determine display status
        $displayStatus = 'paid';
        if ($outstanding > 0 && $paidTotal > 0) {
            $displayStatus = 'partial';
        } elseif ($outstanding > 0) {
            $displayStatus = 'unpaid';
        }

        // Unpaid breakdown for invoice modal
        $unpaidBreakdown = $unpaidSettlements->map(fn (Settlement $s) => [
            'id' => $s->id,
            'period_label' => $s->period_label,
            'period_start' => $s->period_start->toDateString(),
            'period_end' => $s->period_end->toDateString(),
            'outstanding' => (float) $s->outstanding_amount,
            'due_date' => $s->due_date->toDateString(),
        ])->values();

        return Inertia::render('owner/finance/outlet-detail', [
            'outlet' => $outlet->only(['id', 'name']),
            'settlements' => $settlements->map(fn (Settlement $s) => [
                'id' => $s->id,
                'period_label' => $s->period_label,
                'period_start' => $s->period_start->toDateString(),
                'period_end' => $s->period_end->toDateString(),
                'sales_amount' => (float) $s->sales_amount,
                'delivery_fee_amount' => (float) $s->delivery_fee_amount,
                'amount_due' => (float) $s->amount_due,
                'paid_amount' => (float) $s->paid_amount,
                'outstanding' => (float) $s->outstanding_amount,
                'overpaid_amount' => (float) $s->overpaid_amount,
                'due_date' => $s->due_date->toDateString(),
                'status' => $s->status,
            ]),
            'summary' => [
                'total_sales' => (float) $settlements->sum('sales_amount'),
                'total_delivery_fee' => (float) $settlements->sum('delivery_fee_amount'),
                'total_due' => (float) $settlements->sum('amount_due'),
                'paid_total' => (float) $paidTotal,
                'outstanding' => (float) $outstanding,
                'overpaid' => (float) $settlements->sum('overpaid_amount'),
                'oldest_due_date' => $oldestUnpaid?->due_date?->toDateString(),
                'days_overdue' => $daysOverdue,
                'display_status' => $displayStatus,
            ],
            'unpaidBreakdown' => $unpaidBreakdown,
        ]);
    }

    /**
     * Record a payment with FIFO allocation.
     * Owner-recorded payments are immediately verified (owner = authoritative source).
     */
    public function recordPayment(
        Request $request,
        Outlet $outlet,
        SettlementPaymentService $paymentService,
    ): RedirectResponse {
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:1'],
            'payment_method' => ['required', 'string'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:500'],
            'proof_image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        $proofPath = null;
        if ($request->hasFile('proof_image')) {
            $proofPath = $request->file('proof_image')->store('payment-proofs', 'public');
        }

        // Create a single payment record, immediately verified
        $payment = DB::transaction(function () use ($validated, $outlet, $request, $proofPath) {
            $payment = SettlementPayment::create([
                'outlet_id' => $outlet->id,
                'reference_number' => $validated['reference_number'] ?? 'PAY-'.strtoupper(\Illuminate\Support\Str::random(8)),
                'payment_date' => now()->toDateString(),
                'amount' => $validated['amount'],
                'payment_method' => $validated['payment_method'],
                'proof_image' => $proofPath,
                'notes' => $validated['notes'] ?? null,
                'status' => SettlementPayment::STATUS_VERIFIED,
                'verified_by' => $request->user()->id,
                'verified_at' => now(),
            ]);

            // FIFO allocate to unpaid settlements
            $this->paymentService->fifoAllocate($outlet->id, (float) $validated['amount']);

            return $payment;
        });

        return back()->with('success', 'Pembayaran berhasil dicatat dan diverifikasi.');
    }

    /**
     * Send invoice for all unpaid settlements of an outlet.
     */
    public function sendInvoice(Outlet $outlet): RedirectResponse
    {
        $unpaidSettlements = Settlement::where('outlet_id', $outlet->id)
            ->where('status', '!=', Settlement::STATUS_PAID)
            ->get();

        foreach ($unpaidSettlements as $settlement) {
            $settlement->update(['last_invoice_sent_at' => now()]);

            SettlementAuditLog::create([
                'settlement_id' => $settlement->id,
                'user_id' => request()->user()->id,
                'action' => 'invoice_sent',
                'notes' => 'Tagihan dikirim ke outlet',
            ]);
        }

        return back()->with('success', 'Tagihan berhasil dikirim.');
    }

    /**
     * Export settlement data as CSV.
     */
    public function export(Request $request): StreamedResponse
    {
        $settlements = Settlement::where('period_type', 'weekly')
            ->with('outlet:id,name')
            ->orderBy('period_start', 'desc')
            ->get();

        $filename = 'settlements-'.now()->format('Y-m-d').'.csv';

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($settlements) {
            $file = fopen('php://output', 'w');
            fputcsv($file, ['Outlet', 'Periode', 'Jatuh Tempo', 'Omset Produk', 'Ongkos Kirim', 'Kewajiban', 'Sudah Dibayar', 'Sisa', 'Status']);

            foreach ($settlements as $s) {
                fputcsv($file, [
                    $s->outlet->name,
                    $s->period_label,
                    $s->due_date->format('d/m/Y'),
                    $s->sales_amount,
                    $s->delivery_fee_amount,
                    $s->amount_due,
                    $s->paid_amount,
                    $s->outstanding_amount,
                    $s->status,
                ]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}
