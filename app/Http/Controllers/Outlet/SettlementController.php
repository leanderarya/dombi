<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\OutletPayable;
use App\Models\SettlementPayment;
use App\Services\SettlementReconciliationService;
use App\Services\SettlementService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SettlementController extends Controller
{
    public function __construct(
        private readonly SettlementService $settlementService,
        private readonly SettlementReconciliationService $reconciliationService,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $outlet = $user->outlet;

        abort_unless($outlet, 403);

        $period = $request->string('period', 'month')->toString();
        [$from, $to] = $this->resolvePeriod($period, $request);

        $summary = $this->settlementService->getOutletSummary($outlet->id, $from, $to);
        $reconciliation = $this->reconciliationService->getOutletReconciliation($outlet->id, $from, $to);

        // Recent payments (last 10, all statuses)
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

        // Timeline: recent payables (sales, settlements, adjustments)
        $timeline = OutletPayable::query()
            ->where('outlet_id', $outlet->id)
            ->whereBetween('created_at', [$from, $to])
            ->latest()
            ->limit(20)
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'type' => $p->type,
                'amount' => (float) $p->amount,
                'center_share' => (float) $p->center_share,
                'outlet_margin' => (float) $p->outlet_margin,
                'notes' => $p->notes,
                'created_at' => $p->created_at->toISOString(),
            ]);

        // Reconciliation is the single source of truth for outstanding
        // (already includes adjustments from SettlementReconciliationService)

        return Inertia::render('outlet/settlement', [
            'summary' => $summary,
            'reconciliation' => $reconciliation,
            'payments' => $payments,
            'timeline' => $timeline,
            'period' => $period,
            'periodRange' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
            ],
        ]);
    }

    private function resolvePeriod(string $period, Request $request): array
    {
        [$from, $to] = match ($period) {
            'today' => [now()->startOfDay(), now()->endOfDay()],
            'week' => [now()->startOfWeek(), now()->endOfWeek()],
            'month' => [now()->startOfMonth(), now()->endOfMonth()],
            'custom' => [
                Carbon::parse($request->string('from', now()->startOfMonth()->toDateString())),
                Carbon::parse($request->string('to', now()->toDateString()))->endOfDay(),
            ],
            default => [now()->startOfMonth(), now()->endOfMonth()],
        };

        return [Carbon::instance($from), Carbon::instance($to)];
    }
}
