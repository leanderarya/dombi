<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
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
        $period = $request->string('period', 'month')->toString();
        [$from, $to] = $this->resolvePeriod($period, $request);

        $dashboard = $this->settlementService->getOwnerDashboard($from, $to);
        $reconciliation = $this->reconciliationService->getOwnerReconciliation($from, $to);
        $overdue = $this->reconciliationService->getOverdueOutlets();

        return Inertia::render('owner/settlement', [
            'dashboard' => $dashboard,
            'reconciliation' => $reconciliation,
            'overdue' => $overdue,
            'period' => $period,
            'periodRange' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
            ],
        ]);
    }

    public function outlet(Request $request, int $outletId): Response
    {
        $period = $request->string('period', 'month')->toString();
        [$from, $to] = $this->resolvePeriod($period, $request);

        $summary = $this->settlementService->getOutletSummary($outletId, $from, $to);
        $reconciliation = $this->reconciliationService->getOutletReconciliation($outletId, $from, $to);

        return Inertia::render('owner/settlement-outlet', [
            'summary' => $summary,
            'reconciliation' => $reconciliation,
            'outletId' => $outletId,
            'period' => $period,
            'periodRange' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
            ],
        ]);
    }

    private function resolvePeriod(string $period, Request $request): array
    {
        return match ($period) {
            'today' => [now()->startOfDay(), now()->endOfDay()],
            'week' => [now()->startOfWeek(), now()->endOfWeek()],
            'month' => [now()->startOfMonth(), now()->endOfMonth()],
            'custom' => [
                Carbon::parse($request->string('from', now()->startOfMonth()->toDateString())),
                Carbon::parse($request->string('to', now()->toDateString()))->endOfDay(),
            ],
            default => [now()->startOfMonth(), now()->endOfMonth()],
        };
    }
}
