<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Http\Requests\Outlet\StoreCourierNominationRequest;
use App\Models\CourierProfile;
use App\Models\User;
use App\Services\CourierInvitationService;
use App\Services\CourierNominationImageService;
use App\Services\CourierNominationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class MyCourierController extends Controller
{
    public function index(Request $request): Response
    {
        $outlet = $request->user()->outlet;

        $active = CourierProfile::with('user')
            ->availableForOutlet($outlet->id)
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'name' => $p->user?->name,
                'source' => $p->courier_source,
                'total_deliveries' => $p->total_deliveries,
            ]);

        $submitted = $this->outletProfiles($request, CourierProfile::STATUS_SUBMITTED);
        $awaiting = $this->outletProfiles($request, CourierProfile::STATUS_AWAITING_ACTIVATION);
        $rejected = $this->outletProfiles($request, CourierProfile::STATUS_REJECTED);

        $awaiting = $awaiting->map(function (array $row) {
            $profile = CourierProfile::find($row['id']);

            $invitation = $profile?->user?->receivedCourierInvitations()
                ?->where('status', 'pending')
                ?->latest('id')
                ?->first();

            $inviteUrl = $invitation && ! $invitation->isExpired()
                ? app(CourierInvitationService::class)->invitationUrl($invitation)
                : null;

            return [...$row, 'invite_url' => $inviteUrl];
        });

        return Inertia::render('outlet/my-couriers/index', [
            'active' => $active,
            'submitted' => $submitted,
            'awaiting' => $awaiting,
            'rejected' => $rejected,
        ]);
    }

    public function nominate(StoreCourierNominationRequest $request): RedirectResponse
    {
        $outlet = $request->user()->outlet;

        $normalized = [
            'name' => trim((string) $request->input('name')),
            'phone' => $this->normalizePhone((string) $request->input('phone')),
            'vehicle_plate' => $this->normalizePlate((string) $request->input('vehicle_plate')),
        ];

        $validated = validator($normalized, [
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'min:10', 'max:20'],
            'vehicle_plate' => ['required', 'string', 'max:20'],
        ])->validate();

        $this->assertPhoneAvailable($outlet->id, $validated['phone']);

        $face = app(CourierNominationImageService::class)->store($request->file('face_photo'), 'face');
        $vehicle = app(CourierNominationImageService::class)->store($request->file('vehicle_photo'), 'vehicle');

        if (! $face || ! $vehicle) {
            return back()->withErrors(['face_photo' => 'Gagal menyimpan foto. Coba lagi.'])->withInput();
        }

        CourierProfile::create([
            'courier_source' => 'outlet',
            'outlet_id' => $outlet->id,
            'nominated_by' => $request->user()->id,
            'nominee_name' => $validated['name'],
            'nominee_phone' => $validated['phone'],
            'nominee_vehicle_plate' => $validated['vehicle_plate'],
            'nominee_face_photo' => $face,
            'nominee_vehicle_photo' => $vehicle,
            'invitation_status' => CourierProfile::STATUS_SUBMITTED,
        ]);

        return back()->with('success', 'Kandidat kurir diajukan. Menunggu persetujuan Owner.');
    }

    public function regenerateInvitation(Request $request, CourierProfile $profile): RedirectResponse
    {
        $outlet = $request->user()->outlet;

        $result = app(CourierNominationService::class)->regenerateInvitation($profile, $request->user());

        $url = app(CourierInvitationService::class)->invitationUrl($result['invitation']);

        return back()->with('success', 'Link aktivasi baru dibuat.')
            ->with('inviteUrl', $url)
            ->with('waUrl', $this->waUrl($result['invitation']->phone, $url));
    }

    public function resubmit(StoreCourierNominationRequest $request, CourierProfile $profile): RedirectResponse
    {
        $outlet = $request->user()->outlet;

        if ($profile->outlet_id !== $outlet->id || ! $profile->isRejected()) {
            return back()->with('error', 'Kandidat tidak dapat diajukan ulang.');
        }

        $normalized = [
            'name' => trim((string) $request->input('name')),
            'phone' => $this->normalizePhone((string) $request->input('phone')),
            'vehicle_plate' => $this->normalizePlate((string) $request->input('vehicle_plate')),
        ];

        $this->assertPhoneAvailable($outlet->id, $normalized['phone'], $profile->id);

        $face = $profile->nominee_face_photo;
        $vehicle = $profile->nominee_vehicle_photo;
        $imageService = app(CourierNominationImageService::class);

        if ($request->hasFile('face_photo')) {
            $face = $imageService->store($request->file('face_photo'), 'face') ?? $face;
        }

        if ($request->hasFile('vehicle_photo')) {
            $vehicle = $imageService->store($request->file('vehicle_photo'), 'vehicle') ?? $vehicle;
        }

        $profile->update([
            'nominee_name' => $normalized['name'],
            'nominee_phone' => $normalized['phone'],
            'nominee_vehicle_plate' => $normalized['vehicle_plate'],
            'nominee_face_photo' => $face,
            'nominee_vehicle_photo' => $vehicle,
            'invitation_status' => CourierProfile::STATUS_SUBMITTED,
            'approved_at' => null,
            'approved_by' => null,
            'rejection_reason' => null,
            'resubmitted_at' => now(),
        ]);

        return back()->with('success', 'Kandidat diajukan ulang. Menunggu persetujuan Owner.');
    }

    private function outletProfiles(Request $request, string $status): Collection
    {
        $outlet = $request->user()->outlet;

        return CourierProfile::with('nominatedBy')
            ->where('outlet_id', $outlet->id)
            ->where('courier_source', 'outlet')
            ->where('invitation_status', $status)
            ->latest('id')
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'nominee_name' => $p->nominee_name,
                'nominee_phone' => $p->nominee_phone,
                'nominee_vehicle_plate' => $p->nominee_vehicle_plate,
                'nominee_face_photo' => $p->nominee_face_photo,
                'nominee_vehicle_photo' => $p->nominee_vehicle_photo,
                'rejection_reason' => $p->rejection_reason,
                'created_at' => $p->created_at?->toISOString(),
                'approved_at' => $p->approved_at?->toISOString(),
            ]);
    }

    private function assertPhoneAvailable(int $outletId, string $phone, ?int $excludeProfileId = null): void
    {
        $conflict = CourierProfile::query()
            ->where('nominee_phone', $phone)
            ->when($excludeProfileId, fn ($q) => $q->where('id', '!=', $excludeProfileId))
            ->whereIn('invitation_status', [
                CourierProfile::STATUS_SUBMITTED,
                CourierProfile::STATUS_AWAITING_ACTIVATION,
                CourierProfile::STATUS_ACTIVE,
            ])
            ->exists();

        if ($conflict) {
            abort(409, 'Nomor HP sudah digunakan untuk kandidat lain.');
        }

        if (User::query()->where('phone', $phone)->exists()) {
            abort(409, 'Nomor HP sudah terdaftar sebagai pengguna.');
        }
    }

    private function normalizePhone(string $phone): string
    {
        return preg_replace('/\D+/', '', $phone) ?? '';
    }

    private function normalizePlate(string $plate): string
    {
        return strtoupper((string) preg_replace('/\s+/', '', trim($plate)));
    }

    private function waUrl(string $phone, string $url): string
    {
        $message = urlencode("Kandidat kurir Anda telah disetujui Owner. Silakan aktivasi akun melalui link: {$url}");

        return 'https://wa.me/'.preg_replace('/\D+/', '', $phone).'?text='.$message;
    }
}
