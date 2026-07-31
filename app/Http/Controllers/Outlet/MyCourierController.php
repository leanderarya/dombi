<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\CourierProfile;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MyCourierController extends Controller
{
    public function index(): Response
    {
        $outlet = request()->user()->outlet;

        $couriers = CourierProfile::with('user')
            ->availableForOutlet($outlet->id)
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'name' => $p->user?->name,
                'source' => $p->courier_source,
                'total_deliveries' => $p->total_deliveries,
            ]);

        $pending = CourierProfile::where('outlet_id', $outlet->id)
            ->where('courier_source', 'outlet')
            ->where('invitation_status', 'pending')
            ->count();

        return Inertia::render('outlet/my-couriers/index', [
            'couriers' => $couriers,
            'pending_count' => $pending,
        ]);
    }

    public function nominate(Request $request): RedirectResponse
    {
        $normalized = [
            'name' => trim((string) $request->input('name')),
            'phone' => preg_replace('/\D+/', '', (string) $request->input('phone')) ?? '',
        ];

        $validated = validator($normalized, [
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'min:10', 'max:20'],
        ])->validate();

        $outlet = $request->user()->outlet;

        CourierProfile::create([
            'courier_source' => 'outlet',
            'outlet_id' => $outlet->id,
            'nominated_by' => $request->user()->id,
            'nominee_name' => $validated['name'],
            'nominee_phone' => $validated['phone'],
            'invitation_status' => 'pending',
        ]);

        return back()->with('success', 'Kandidat kurir diajukan. Menunggu persetujuan Owner.');
    }
}
