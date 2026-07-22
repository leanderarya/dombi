<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\CourierProfile;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CourierManagementController extends Controller
{
    public function index(): Response
    {
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
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
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
            'outlets' => \App\Models\Outlet::where('status', 'active')->get(['id', 'name']),
        ]);
    }

    public function approve(CourierProfile $profile): RedirectResponse
    {
        if (! $profile->isPending()) {
            return back()->with('error', 'Kandidat sudah diproses.');
        }

        $user = User::create([
            'name' => 'Kurir ' . $profile->outlet?->name,
            'phone' => '08' . random_int(1000000000, 9999999999),
            'role' => 'courier',
            'is_active' => true,
            'password' => bcrypt('password'),
        ]);

        $profile->update([
            'user_id' => $user->id,
            'invitation_status' => 'accepted',
            'approved_by' => request()->user()->id,
            'approved_at' => now(),
        ]);

        return back()->with('success', 'Kurir berhasil disetujui.');
    }

    public function reject(CourierProfile $profile): RedirectResponse
    {
        if (! $profile->isPending()) {
            return back()->with('error', 'Kandidat sudah diproses.');
        }

        $profile->update([
            'invitation_status' => 'rejected',
            'approved_by' => request()->user()->id,
            'approved_at' => now(),
        ]);

        return back()->with('success', 'Kandidat ditolak.');
    }

    public function updateAssignments(Request $request, CourierProfile $profile): RedirectResponse
    {
        $validated = $request->validate([
            'outlet_ids' => ['required', 'array'],
            'outlet_ids.*' => ['integer', 'exists:outlets,id'],
        ]);

        $profile->assignedOutlets()->sync($validated['outlet_ids']);

        return back()->with('success', 'Plotting outlet berhasil diperbarui.');
    }
}