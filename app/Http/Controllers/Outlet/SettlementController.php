<?php

namespace App\Http\Controllers\Outlet;

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
        $user = $request->user();
        $outlet = $user->outlet;

        abort_unless($outlet, 403);

        $period = $request->string('period', 'month')->toString();
        [$from, $to] = $this->resolvePeriod($period, $request);

        $summary = $this->settlementService->getOutletSummary($outlet->id, $from, $to);
        $reconciliation = $this->reconciliationService->getOutletReconciliation($outlet->id, $from, $to);

        return Inertia::render('outlet/settlement', [
            'summary' => $summary,
            'reconciliation' => $reconciliation,
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
