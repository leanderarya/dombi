<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\StoreCourierRequest;
use App\Models\CourierProfile;
use App\Models\Delivery;
use App\Models\User;
use App\Services\CourierService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CourierController extends Controller
{
    public function __construct(
        private readonly CourierService $courierService,
    ) {}

    public function index(): Response
    {
        $stats = $this->courierService->getStats();
        $todayDeliveries = $this->courierService->getTodayDeliveryCount();

        $couriers = User::query()
            ->where('role', 'courier')
            ->with('courierProfile')
            ->withCount([
                'courierDeliveries as active_deliveries_count' => fn ($query) => $query->whereIn('status', ['waiting_pickup', 'picked_up', 'delivering']),
                'courierDeliveries as today_deliveries_count' => fn ($query) => $query->whereDate('created_at', today()),
            ])
            ->latest()
            ->paginate(15);

        return Inertia::render('owner/couriers/index', [
            'couriers' => $couriers,
            'stats' => $stats,
            'todayDeliveries' => $todayDeliveries,
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('owner/couriers/create');
    }

    public function store(StoreCourierRequest $request): RedirectResponse
    {
        $result = $this->courierService->createCourier(
            $request->validated(),
            $request->user(),
        );

        return redirect()
            ->route('owner.couriers.index')
            ->with('inviteUrl', $result['inviteUrl'])
            ->with('success', 'Kurir berhasil ditambahkan. Bagikan tautan undangan ke kurir.');
    }

    public function show(User $courier): Response
    {
        $courier->load('courierProfile');
        $courier->loadCount([
            'courierDeliveries as total_deliveries_count',
            'courierDeliveries as today_deliveries_count' => fn ($query) => $query->whereDate('created_at', today()),
            'courierDeliveries as active_deliveries_count' => fn ($query) => $query->whereIn('status', ['waiting_pickup', 'picked_up', 'delivering']),
        ]);

        $recentDeliveries = Delivery::where('courier_id', $courier->id)
            ->with('order:id,order_code,total')
            ->latest()
            ->limit(10)
            ->get();

        $invitation = \App\Models\CourierInvitation::where('courier_user_id', $courier->id)
            ->where('status', 'pending')
            ->latest()
            ->first();

        $inviteUrl = $invitation && $invitation->expires_at->isFuture()
            ? app(\App\Services\CourierInvitationService::class)->invitationUrl($invitation)
            : null;

        return Inertia::render('owner/couriers/show', [
            'courier' => $courier,
            'recentDeliveries' => $recentDeliveries,
            'inviteUrl' => $inviteUrl,
        ]);
    }

    public function update(Request $request, User $courier): RedirectResponse
    {
        $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['sometimes', 'string', 'max:20', 'unique:users,phone,' . $courier->id],
            'vehicle_type' => ['nullable', 'in:motorcycle,bicycle,car'],
            'vehicle_plate' => ['nullable', 'string', 'max:20'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $courier->update($request->only(['name', 'phone', 'vehicle_type', 'vehicle_plate', 'is_active']));

        return redirect()
            ->route('owner.couriers.show', $courier)
            ->with('success', 'Data kurir berhasil diperbarui.');
    }

    public function destroy(User $courier): RedirectResponse
    {
        $activeDeliveries = Delivery::where('courier_id', $courier->id)
            ->whereIn('status', ['waiting_assignment', 'waiting_pickup', 'picked_up', 'delivering'])
            ->count();

        if ($activeDeliveries > 0) {
            return back()->with('error', 'Kurir masih memiliki ' . $activeDeliveries . ' pengiriman aktif. Selesaikan dulu sebelum menghapus.');
        }

        $courier->delete();

        return redirect()
            ->route('owner.couriers.index')
            ->with('success', 'Kurir berhasil dihapus.');
    }
}
