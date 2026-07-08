<?php

namespace App\Services;

use App\Models\CourierInvitation;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class CourierInvitationService
{
    public function __construct(
        private readonly GowaService $gowa,
    ) {}

    public function create(User $courier, User $owner, string $phone): CourierInvitation
    {
        $invitation = CourierInvitation::create([
            'invited_by' => $owner->id,
            'courier_user_id' => $courier->id,
            'phone' => $phone,
            'name' => $courier->name,
            'token' => CourierInvitation::generateToken(),
            'status' => 'pending',
            'sent_at' => now(),
            'expires_at' => now()->addDays(7),
        ]);

        $this->sendWhatsApp($invitation);

        return $invitation;
    }

    public function sendWhatsApp(CourierInvitation $invitation): bool
    {
        $message = $this->buildMessage($invitation);

        try {
            $sent = $this->gowa->sendText($invitation->phone, $message);

            if ($sent) {
                Log::info('Courier invitation sent', [
                    'invitation_id' => $invitation->id,
                    'phone' => $invitation->phone,
                ]);
            }

            return $sent;
        } catch (\Throwable $e) {
            Log::error('Failed to send courier invitation', [
                'invitation_id' => $invitation->id,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    private function buildMessage(CourierInvitation $invitation): string
    {
        $loginUrl = url("/courier/invite/{$invitation->token}");

        return <<<MESSAGE
        Halo {$invitation->name}! 👋

        Anda telah diundang sebagai kurir di Dombi.

        Download aplikasi dan login dengan link berikut:
        {$loginUrl}

        Link ini berlaku sampai {$invitation->expires_at->format('d M Y H:i')}.

        Terima kasih!
        MESSAGE;
    }
}
