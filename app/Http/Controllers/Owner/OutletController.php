<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\StoreOutletRequest;
use App\Http\Requests\Owner\UpdateOutletRequest;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\RestockRequest;
use App\Models\Settlement;
use App\Policies\OutletPolicy;
use App\Services\OutletAuditService;
use App\Services\OutletProvisioningService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class OutletController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('owner/outlets/index', [
            'outlets' => Outlet::query()
                ->withCount([
                    'orders as active_orders_count' => fn ($query) => $query->whereIn('status', Order::ACTIVE_STATUSES),
                    'inventories as inventory_items_count',
                    'inventories as low_stock_count' => fn ($query) => $query->whereLowStock(),
                    'restockRequests as pending_restocks_count' => fn ($query) => $query->whereIn('status', ['requested', 'preparing', 'shipped']),
                ])
                ->latest()
                ->paginate(15),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('owner/outlets/create', [
            'existingOutlets' => Outlet::where('status', 'active')
                ->whereNotNull('latitude')
                ->whereNotNull('longitude')
                ->get(['id', 'name', 'latitude', 'longitude', 'address']),
        ]);
    }

    public function store(StoreOutletRequest $request, OutletProvisioningService $provisioning): RedirectResponse
    {
        $result = $provisioning->createOutletWithAccount($request->validated());

        return redirect()
            ->route('owner.outlets.index')
            ->with('success', 'Outlet berhasil dibuat dan akun operasional sudah diprovisioning.')
            ->with('outlet_provisioning', $result['credentials']);
    }

    public function show(Outlet $outlet, OutletPolicy $policy): Response
    {
        $outlet->load(['user:id,email,is_active,must_change_password,outlet_id']);
        $outlet->loadCount([
            'orders as active_orders_count' => fn ($query) => $query->whereIn('status', Order::ACTIVE_STATUSES),
            'orders as today_orders_count' => fn ($query) => $query->whereOnDay('created_at', today()),
            'inventories as inventory_items_count',
            'inventories as low_stock_count' => fn ($query) => $query->whereLowStock(),
            'restockRequests as pending_restocks_count' => fn ($query) => $query->whereIn('status', ['requested', 'preparing', 'shipped']),
        ]);

        return Inertia::render('owner/outlets/show', [
            'outlet' => $outlet,
            // Drives whether the permanent-delete action is offered, and what the
            // refusal says when it is not.
            'canForceDelete' => Gate::allows('forceDelete', $outlet),
            'historyCounts' => $policy->historyCounts($outlet),
            'inventoryHealth' => $outlet->inventories()
                ->whereNotNull('product_id')
                ->with('product:id,name,size')
                ->latest()
                ->limit(6)
                ->get(['id', 'outlet_id', 'product_id', 'current_stock', 'reserved_stock', 'minimum_stock', 'updated_at']),
            'activeDeliveriesCount' => Delivery::whereHas('order', fn ($query) => $query
                ->where('outlet_id', $outlet->id)
                ->whereIn('status', ['ready_for_pickup', 'picked_up', 'delivering']))
                ->count(),
            'recentRestocks' => RestockRequest::query()
                ->where('outlet_id', $outlet->id)
                ->latest()
                ->limit(5)
                ->get(['id', 'outlet_id', 'status', 'notes', 'created_at']),
            'holidays' => $outlet->holidays()->orderBy('start_date', 'desc')->get(),
            'operatingHours' => $outlet->operatingHours()->orderBy('day_of_week')->get(),
            'auditLogs' => $outlet->auditLogs()
                ->with('changedBy:id,name')
                ->latest()
                ->limit(20)
                ->get(),
            'settlementSummary' => [
                'outstanding' => (float) Settlement::where('outlet_id', $outlet->id)
                    ->where('status', '!=', Settlement::STATUS_PAID)
                    ->selectRaw('SUM(amount_due - paid_amount) as total')
                    ->value('total') ?? 0,
                'overdue_count' => (int) Settlement::where('outlet_id', $outlet->id)
                    ->where('status', Settlement::STATUS_OVERDUE)
                    ->count(),
                'paid_this_month' => (float) Settlement::where('outlet_id', $outlet->id)
                    ->where('status', Settlement::STATUS_PAID)
                    ->whereInMonth('paid_at', now())
                    ->sum('paid_amount'),
                'recent_settlements' => Settlement::where('outlet_id', $outlet->id)
                    ->latest('period_date')
                    ->limit(5)
                    ->get(['id', 'period_date', 'amount_due', 'paid_amount', 'status', 'due_date']),
            ],
        ]);
    }

    public function edit(Outlet $outlet): RedirectResponse
    {
        return redirect()->route('owner.outlets.show', $outlet);
    }

    public function update(UpdateOutletRequest $request, Outlet $outlet, OutletAuditService $auditService): RedirectResponse
    {
        $oldData = $outlet->toArray();
        $outlet->update($request->validated());
        $auditService->logChanges($outlet, $oldData, $request->validated(), $request->user());

        return redirect()->route('owner.outlets.index')->with('success', 'Outlet berhasil diperbarui.');
    }

    /**
     * The resource route's delete. Archiving is what the UI means by deleting, so it
     * delegates to archive() rather than pretending to remove anything.
     */
    public function destroy(Outlet $outlet): RedirectResponse
    {
        $outlet->update(['status' => 'archived']);

        return redirect()->route('owner.outlets.index')->with('success', 'Outlet berhasil diarsipkan.');
    }

    /**
     * Remove an outlet for good. Only reachable when it has no history at all -
     * see OutletPolicy::forceDelete.
     */
    public function forceDestroy(Request $request, Outlet $outlet, OutletPolicy $policy): RedirectResponse
    {
        if (Gate::denies('forceDelete', $outlet)) {
            return back()->withErrors([
                'outlet' => 'Outlet ini punya '.$this->describeHistory($policy->historyCounts($outlet)).
                    ', jadi tidak bisa dihapus permanen. Arsipkan saja supaya riwayatnya tetap tersimpan.',
            ]);
        }

        DB::transaction(function () use ($outlet): void {
            // The operational account is detached rather than deleted: it may carry
            // its own audit trail, and users.outlet_id already nulls on delete.
            $outlet->user?->update(['is_active' => false]);
            $outlet->user?->forceFill(['outlet_id' => null])->save();

            $outlet->forceDelete();
        });

        return redirect()->route('owner.outlets.index')->with('success', 'Outlet berhasil dihapus permanen.');
    }

    /**
     * @param  array<string, int>  $counts
     */
    private function describeHistory(array $counts): string
    {
        $parts = collect($counts)
            ->map(fn (int $count, string $label) => $count.' '.$label)
            ->values()
            ->all();

        if (count($parts) <= 1) {
            return implode('', $parts);
        }

        $last = array_pop($parts);

        return implode(', ', $parts).' dan '.$last;
    }

    public function archive(Request $request, Outlet $outlet, OutletAuditService $auditService): RedirectResponse
    {
        $oldStatus = $outlet->status;
        $outlet->update(['status' => 'archived']);
        $auditService->log($outlet, 'status', $oldStatus, 'archived', $request->user());

        return redirect()->route('owner.outlets.index')->with('success', 'Outlet berhasil diarsipkan.');
    }

    public function resetPassword(Request $request, Outlet $outlet, OutletProvisioningService $provisioning, OutletAuditService $auditService): RedirectResponse
    {
        if ($outlet->status === 'archived') {
            return back()->withErrors(['outlet' => 'Outlet sudah diarsipkan, tidak bisa reset password.']);
        }

        try {
            $result = $provisioning->resetOutletPassword($outlet);
        } catch (ModelNotFoundException $e) {
            return back()->withErrors(['user' => 'Akun outlet tidak ditemukan. Outlet ini belum memiliki akun operasional.']);
        }

        $auditService->log($outlet, 'password', '***', 'reset_by_owner:'.$request->user()->id, $request->user());

        return back()
            ->with('success', "Password outlet {$outlet->name} berhasil direset.")
            ->with('outlet_provisioning', $result['credentials']);
    }
}
