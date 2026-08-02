<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\RejectCourierNominationRequest;
use App\Models\CourierProfile;
use App\Models\Outlet;
use App\Services\CourierNominationService;
use App\Services\CourierRevenueService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CourierManagementController extends Controller
{
    public function index(Request $request, CourierRevenueService $revenueService): Response
    {
        $period = $request->validate([
            'period' => ['sometimes', 'string', 'in:harian,mingguan,bulanan'],
        ])['period'] ?? 'harian';

        $revenue = $revenueService->revenue($period);

        $couriers = CourierProfile::with(['user', 'assignedOutlets'])
            ->where(function ($q) {
                $q->where('courier_source', 'pusat')
                    ->orWhere(function ($q) {
                        $q->where('courier_source', 'outlet')
                            ->whereIn('invitation_status', [
                                CourierProfile::STATUS_AWAITING_ACTIVATION,
                                CourierProfile::STATUS_ACTIVE,
                            ]);
                    });
            })
            ->latest('id')
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'name' => $p->user?->name ?? $p->nominee_name,
                'phone' => $p->user?->phone ?? $p->nominee_phone,
                'source' => $p->courier_source,
                'status' => $p->courier_source === 'pusat' ? 'active' : $p->invitation_status,
                'assigned_outlets' => $p->assignedOutlets->pluck('id'),
                'assigned_outlet_names' => $p->assignedOutlets->pluck('name'),
                'total_deliveries' => $p->total_deliveries,
            ]);

        $candidates = CourierProfile::with(['nominatedBy', 'outlet'])
            ->outlet()
            ->submitted()
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'nominee_name' => $p->nominee_name,
                'nominee_phone' => $p->nominee_phone,
                'nominee_vehicle_plate' => $p->nominee_vehicle_plate,
                'nominee_face_photo' => $p->nominee_face_photo,
                'nominee_vehicle_photo' => $p->nominee_vehicle_photo,
                'outlet_name' => $p->outlet?->name,
                'nominated_by_name' => $p->nominatedBy?->name,
                'created_at' => $p->created_at->toISOString(),
            ]);

        $rejected = CourierProfile::with(['outlet'])
            ->outlet()
            ->rejected()
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'nominee_name' => $p->nominee_name,
                'outlet_name' => $p->outlet?->name,
                'rejection_reason' => $p->rejection_reason,
                'rejected_at' => $p->approved_at?->toISOString(),
            ]);

        return Inertia::render('owner/courier-management/index', [
            'couriers' => $couriers,
            'candidates' => $candidates,
            'rejected' => $rejected,
            'outlets' => Outlet::where('status', 'active')->get(['id', 'name']),
            'revenueSummary' => [
                'deliveries' => $revenue['summary']['total_deliveries'],
                'delivery_fee' => $revenue['summary']['delivery_fee'],
                'external_cost' => $revenue['summary']['external_cost'],
                'net' => $revenue['summary']['net'],
            ],
            'revenueOutlets' => $revenue['outlets'],
        ]);
    }

    public function approve(CourierProfile $profile): RedirectResponse
    {
        app(CourierNominationService::class)->approve($profile, request()->user());

        return back()->with('success', 'Kurir disetujui. Link aktivasi dikirim via WhatsApp oleh Outlet.');
    }

    public function reject(RejectCourierNominationRequest $request, CourierProfile $profile): RedirectResponse
    {
        app(CourierNominationService::class)->reject($profile, request()->user(), $request->input('reason'));

        return back()->with('success', 'Kandidat ditolak.');
    }

    public function classifyLegacyProfile(Request $request, CourierProfile $profile): RedirectResponse
    {
        if ($profile->courier_source !== null) {
            return back()->with('error', 'Kurir ini sudah memiliki sumber yang valid.');
        }

        $validated = $request->validate([
            'courier_source' => ['required', Rule::in(['pusat', 'outlet'])],
            'outlet_id' => [
                Rule::requiredIf($request->input('courier_source') === 'outlet'),
                'nullable',
                'integer',
                Rule::exists('outlets', 'id')->where('status', 'active'),
            ],
        ]);

        $updated = DB::transaction(function () use ($profile, $validated): int {
            $lockedProfile = CourierProfile::query()
                ->whereKey($profile->id)
                ->lockForUpdate()
                ->first();

            if (
                ! $lockedProfile
                || $lockedProfile->courier_source !== null
                || ! $lockedProfile->user_id
            ) {
                return 0;
            }

            $lockedProfile->update([
                'courier_source' => $validated['courier_source'],
                'outlet_id' => $validated['courier_source'] === 'outlet' ? $validated['outlet_id'] : null,
            ]);

            if ($validated['courier_source'] === 'outlet') {
                $lockedProfile->assignedOutlets()->detach();
            }

            return 1;
        });

        if ($updated === 0) {
            return back()->with('error', 'Kurir ini sudah memiliki sumber yang valid.');
        }

        return back()->with('success', 'Sumber kurir berhasil diklasifikasikan.');
    }

    public function updateAssignments(Request $request, CourierProfile $profile): RedirectResponse
    {
        if ($profile->courier_source !== 'pusat') {
            return back()->with('error', 'Hanya kurir pusat yang dapat diplot ke outlet.');
        }

        $validated = $request->validate([
            'outlet_ids' => ['required', 'array'],
            'outlet_ids.*' => [
                'integer',
                Rule::exists('outlets', 'id')->where('status', 'active'),
            ],
        ]);

        $profile->assignedOutlets()->sync($validated['outlet_ids']);

        return back()->with('success', 'Plotting outlet berhasil diperbarui.');
    }
}
