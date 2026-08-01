<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\CourierInvitation;
use App\Models\CourierProfile;
use App\Models\Outlet;
use App\Models\User;
use App\Services\CourierInvitationService;
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
        $pusat = CourierProfile::with(['user', 'assignedOutlets'])
            ->pusat()
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'name' => $p->user?->name,
                'phone' => $p->user?->phone,
                'assigned_outlets' => $p->assignedOutlets->pluck('id'),
                'assigned_outlet_names' => $p->assignedOutlets->pluck('name'),
                'total_deliveries' => $p->total_deliveries,
            ]);

        $candidates = CourierProfile::with(['nominatedBy', 'outlet'])
            ->outlet()
            ->pending()
            ->whereNull('approved_at')
            ->whereNull('user_id')
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'nominee_name' => $p->nominee_name,
                'nominee_phone' => $p->nominee_phone,
                'outlet_name' => $p->outlet?->name,
                'nominated_by_name' => $p->nominatedBy?->name,
                'created_at' => $p->created_at->toISOString(),
            ]);

        $rejected = CourierProfile::with(['outlet'])
            ->outlet()
            ->where('invitation_status', 'rejected')
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'outlet_name' => $p->outlet?->name,
                'rejected_at' => $p->approved_at?->toISOString(),
            ]);

        return Inertia::render('owner/courier-management/index', [
            'pusat' => $pusat,
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
        if (
            ! $profile->isPending()
            || $profile->courier_source !== 'outlet'
            || $profile->outlet_id === null
            || $profile->approved_at !== null
            || $profile->user_id !== null
        ) {
            return back()->with('error', 'Kandidat sudah diproses.');
        }

        if (! $profile->nominee_name || ! $profile->nominee_phone) {
            return back()->with('error', 'Identitas kandidat belum lengkap.');
        }

        DB::transaction(function () use ($profile): void {
            $lockedProfile = CourierProfile::query()
                ->whereKey($profile->id)
                ->lockForUpdate()
                ->first();

            if (
                ! $lockedProfile
                || ! $lockedProfile->isPending()
                || $lockedProfile->courier_source !== 'outlet'
                || $lockedProfile->outlet_id === null
                || ! $lockedProfile->nominee_name
                || ! $lockedProfile->nominee_phone
                || $lockedProfile->user_id !== null
                || $lockedProfile->approved_at !== null
            ) {
                abort(409, 'Kandidat kurir tidak valid.');
            }

            if (User::query()->where('phone', $lockedProfile->nominee_phone)->exists()) {
                abort(409, 'Nomor telepon kandidat sudah digunakan.');
            }

            $user = User::create([
                'name' => $lockedProfile->nominee_name,
                'email' => 'courier.profile.'.$lockedProfile->id.'@dombi.local',
                'phone' => $lockedProfile->nominee_phone,
                'role' => 'courier',
                'is_active' => true,
                'is_online' => false,
                'must_change_password' => true,
                'password' => bcrypt((string) random_int(10000000, 99999999)),
            ]);

            $existingInvitation = CourierInvitation::query()
                ->where('courier_user_id', $user->id)
                ->exists();

            if ($existingInvitation) {
                abort(409, 'Kandidat kurir tidak valid.');
            }

            app(CourierInvitationService::class)->create($user, request()->user(), $lockedProfile->nominee_phone);

            $lockedProfile->update([
                'user_id' => $user->id,
                'invitation_status' => 'pending',
                'approved_by' => request()->user()->id,
                'approved_at' => now(),
                'invited_at' => now(),
                'accepted_at' => null,
            ]);
        });

        return back()->with('success', 'Kurir berhasil disetujui.');
    }

    public function reject(CourierProfile $profile): RedirectResponse
    {
        if (
            ! $profile->isPending()
            || $profile->courier_source !== 'outlet'
            || $profile->approved_at !== null
            || $profile->user_id !== null
        ) {
            return back()->with('error', 'Kandidat sudah diproses.');
        }

        $updated = CourierProfile::query()
            ->whereKey($profile->id)
            ->where('courier_source', 'outlet')
            ->whereNull('approved_at')
            ->whereNull('user_id')
            ->where('invitation_status', 'pending')
            ->update([
                'invitation_status' => 'rejected',
                'approved_by' => request()->user()->id,
                'approved_at' => now(),
            ]);

        if ($updated === 0) {
            return back()->with('error', 'Kandidat sudah diproses.');
        }

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
                ->whereNull('courier_source')
                ->lockForUpdate()
                ->first();

            if (! $lockedProfile) {
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
