<?php

namespace App\Services;

use App\Models\CourierInvitation;
use App\Models\User;

class CourierInvitationService
{

    public function create(User $courier, User $owner, string $phone): CourierInvitation
    {
        return CourierInvitation::create([
            'invited_by' => $owner->id,
            'courier_user_id' => $courier->id,
            'phone' => $phone,
            'name' => $courier->name,
            'token' => CourierInvitation::generateToken(),
            'status' => 'pending',
            'expires_at' => now()->addDays(7),
        ]);
    }

    public function invitationUrl(CourierInvitation $invitation): string
    {
        return url("/courier/invite/{$invitation->token}");
    }
}
