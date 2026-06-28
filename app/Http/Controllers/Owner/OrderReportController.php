<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\OrderReport;
use App\Models\User;
use App\Notifications\OrderReportResolvedNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class OrderReportController extends Controller
{
    public function index(Request $request): Response
    {
        $query = OrderReport::with(['order.outlet', 'customer', 'resolver'])
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        $reports = $query->paginate(20)->withQueryString();

        return Inertia::render('owner/order-reports/index', [
            'reports' => $reports,
            'filters' => $request->only(['status', 'type']),
        ]);
    }

    public function show(OrderReport $report): Response
    {
        $report->load(['order.outlet', 'order.items', 'customer', 'resolver']);

        return Inertia::render('owner/order-reports/show', [
            'report' => $report,
        ]);
    }

    public function update(Request $request, OrderReport $report): RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in([OrderReport::STATUS_INVESTIGATING, OrderReport::STATUS_RESOLVED, OrderReport::STATUS_REJECTED])],
            'resolution_notes' => [
                in_array($request->input('status'), [OrderReport::STATUS_RESOLVED, OrderReport::STATUS_REJECTED]) ? 'required' : 'nullable',
                'string',
                'max:2000',
            ],
        ]);

        $user = $request->user();

        // Validate status transition
        $allowedTransitions = [
            OrderReport::STATUS_PENDING => [OrderReport::STATUS_INVESTIGATING, OrderReport::STATUS_RESOLVED, OrderReport::STATUS_REJECTED],
            OrderReport::STATUS_INVESTIGATING => [OrderReport::STATUS_RESOLVED, OrderReport::STATUS_REJECTED],
        ];

        $allowed = $allowedTransitions[$report->status] ?? [];

        if (! in_array($validated['status'], $allowed, true)) {
            return back()->withErrors(['status' => 'Transisi status tidak valid.']);
        }

        $updateData = [
            'status' => $validated['status'],
            'resolution_notes' => $validated['resolution_notes'] ?? null,
        ];

        // Set resolved info when finalizing
        if (in_array($validated['status'], [OrderReport::STATUS_RESOLVED, OrderReport::STATUS_REJECTED], true)) {
            $updateData['resolved_by'] = $user->id;
            $updateData['resolved_at'] = now();
        }

        $report->update($updateData);

        // Notify customer
        if ($report->customer?->user) {
            $report->customer->user->notify(new OrderReportResolvedNotification($report));
        }

        // Notify outlet
        if ($report->order->outlet_id) {
            $outletUsers = User::where('role', 'outlet')
                ->where('outlet_id', $report->order->outlet_id)
                ->get();

            foreach ($outletUsers as $outletUser) {
                $outletUser->notify(new OrderReportResolvedNotification($report));
            }
        }

        return back()->with('success', 'Laporan berhasil diperbarui.');
    }
}
