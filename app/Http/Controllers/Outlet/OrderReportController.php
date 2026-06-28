<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\OrderReport;
use App\Models\User;
use App\Notifications\OrderReportUpdatedNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OrderReportController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $outletId = $user->outlet_id;

        $query = OrderReport::with(['order', 'customer', 'resolver'])
            ->whereHas('order', fn ($q) => $q->where('outlet_id', $outletId))
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $reports = $query->paginate(20)->withQueryString();

        return Inertia::render('outlet/order-reports/index', [
            'reports' => $reports,
            'filters' => $request->only(['status']),
        ]);
    }

    public function show(OrderReport $report): Response
    {
        // Scope: only reports for this outlet's orders
        $user = request()->user();
        if ($report->order->outlet_id !== $user->outlet_id) {
            abort(403);
        }

        $report->load(['order.items', 'customer', 'resolver']);

        return Inertia::render('outlet/order-reports/show', [
            'report' => $report,
        ]);
    }

    public function update(Request $request, OrderReport $report): RedirectResponse
    {
        // Scope check
        $user = $request->user();
        if ($report->order->outlet_id !== $user->outlet_id) {
            abort(403);
        }

        // Only allow pending → investigating
        if ($report->status !== OrderReport::STATUS_PENDING) {
            return back()->withErrors(['status' => 'Hanya laporan menunggu yang bisa ditanggapi.']);
        }

        $validated = $request->validate([
            'resolution_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $report->update([
            'status' => OrderReport::STATUS_INVESTIGATING,
            'resolution_notes' => $validated['resolution_notes'] ?? null,
        ]);

        // Notify customer
        if ($report->customer?->user) {
            $report->customer->user->notify(new OrderReportUpdatedNotification($report->fresh()));
        }

        // Notify owner
        $owner = User::where('role', 'owner')->first();
        if ($owner) {
            $owner->notify(new OrderReportUpdatedNotification($report->fresh()));
        }

        return back()->with('success', 'Laporan ditandai sedang ditinjau.');
    }
}
