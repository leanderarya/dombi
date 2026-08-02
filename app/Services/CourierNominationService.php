<?php

namespace App\Services;

use App\Models\CourierInvitation;
use App\Models\CourierNominationReview;
use App\Models\CourierProfile;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class CourierNominationService
{
    public function __construct(
        private readonly CourierInvitationService $invitationService,
        private readonly CourierNominationImageService $imageService,
    ) {}

    public function approve(CourierProfile $profile, User $owner): CourierProfile
    {
        return DB::transaction(function () use ($profile, $owner) {
            $lockedProfile = CourierProfile::query()
                ->whereKey($profile->id)
                ->lockForUpdate()
                ->firstOrFail();

            $this->assertApprovable($lockedProfile);

            $user = User::create([
                'name' => $lockedProfile->nominee_name,
                'email' => 'courier.profile.'.$lockedProfile->id.'@dombi.local',
                'phone' => $lockedProfile->nominee_phone,
                'role' => 'courier',
                'is_active' => true,
                'is_online' => false,
                'must_change_password' => true,
                'vehicle_plate' => $lockedProfile->nominee_vehicle_plate,
                'photo' => $lockedProfile->nominee_face_photo,
                'password' => bcrypt((string) random_int(10000000, 99999999)),
            ]);

            $invitation = $this->invitationService->create($user, $owner, $lockedProfile->nominee_phone);

            $lockedProfile->update([
                'user_id' => $user->id,
                'invitation_status' => CourierProfile::STATUS_AWAITING_ACTIVATION,
                'approved_by' => $owner->id,
                'approved_at' => now(),
                'invited_at' => now(),
                'accepted_at' => null,
            ]);

            CourierNominationReview::create([
                'courier_profile_id' => $lockedProfile->id,
                'reviewer_id' => $owner->id,
                'decision' => 'approved',
                'decided_at' => now(),
            ]);

            return $lockedProfile;
        });
    }

    public function reject(CourierProfile $profile, User $owner, string $reason): CourierProfile
    {
        return DB::transaction(function () use ($profile, $owner, $reason) {
            $lockedProfile = CourierProfile::query()
                ->whereKey($profile->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! $lockedProfile->isSubmitted()) {
                abort(409, 'Kandidat sudah diproses.');
            }

            $lockedProfile->update([
                'invitation_status' => CourierProfile::STATUS_REJECTED,
                'approved_by' => $owner->id,
                'approved_at' => now(),
                'rejection_reason' => $reason,
            ]);

            CourierNominationReview::create([
                'courier_profile_id' => $lockedProfile->id,
                'reviewer_id' => $owner->id,
                'decision' => 'rejected',
                'reason' => $reason,
                'decided_at' => now(),
            ]);

            return $lockedProfile;
        });
    }

    public function regenerateInvitation(CourierProfile $profile, User $outletUser): array
    {
        return DB::transaction(function () use ($profile, $outletUser) {
            $lockedProfile = CourierProfile::query()
                ->whereKey($profile->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! $lockedProfile->isAwaitingActivation()) {
                abort(409, 'Kandidat tidak menunggu aktivasi.');
            }

            if ($lockedProfile->outlet_id !== $outletUser->outlet_id) {
                abort(403, 'Kandidat bukan milik outlet Anda.');
            }

            $invitation = CourierInvitation::query()
                ->where('courier_user_id', $lockedProfile->user_id)
                ->where('status', 'pending')
                ->latest('id')
                ->lockForUpdate()
                ->first();

            $reused = false;

            if ($invitation && ! $invitation->isExpired()) {
                $reused = true;
            } else {
                if ($invitation) {
                    $invitation->update(['status' => 'expired']);
                }

                $invitation = $this->invitationService->regenerate(
                    CourierInvitation::query()
                        ->where('courier_user_id', $lockedProfile->user_id)
                        ->latest('id')
                        ->firstOrFail(),
                );

                $lockedProfile->update(['invited_at' => now()]);
            }

            return [
                'profile' => $lockedProfile,
                'invitation' => $invitation,
                'reused' => $reused,
            ];
        });
    }

    private function assertApprovable(CourierProfile $profile): void
    {
        if (
            ! $profile->isSubmitted()
            || $profile->courier_source !== 'outlet'
            || $profile->outlet_id === null
            || $profile->approved_at !== null
            || $profile->user_id !== null
        ) {
            abort(409, 'Kandidat sudah diproses.');
        }

        if (
            ! $profile->nominee_name
            || ! $profile->nominee_phone
            || ! $profile->nominee_vehicle_plate
            || ! $profile->nominee_face_photo
            || ! $profile->nominee_vehicle_photo
        ) {
            abort(409, 'Identitas kandidat belum lengkap.');
        }

        if (User::query()->where('phone', $profile->nominee_phone)->exists()) {
            abort(409, 'Nomor telepon kandidat sudah digunakan.');
        }
    }
}
