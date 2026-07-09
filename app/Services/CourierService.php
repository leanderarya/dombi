<?php

namespace App\Services;

use App\Models\CourierProfile;
use App\Models\Delivery;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CourierService
{
    public function __construct(
        private readonly CourierInvitationService $invitationService,
    ) {}

    public function createCourier(array $data, User $owner): array
    {
        return DB::transaction(function () use ($data, $owner) {
            $password = Str::random(16);

            $courier = User::create([
                'name' => $data['name'],
                'email' => $this->generateEmail($data['phone']),
                'password' => $password,
                'phone' => $data['phone'],
                'role' => 'courier',
                'is_active' => true,
                'is_online' => false,
                'vehicle_type' => $data['vehicle_type'] ?? null,
                'vehicle_plate' => $data['vehicle_plate'] ?? null,
                'photo' => $data['photo'] ?? null,
                'must_change_password' => true,
            ]);

            CourierProfile::create([
                'user_id' => $courier->id,
                'invitation_status' => 'pending',
                'invited_at' => now(),
            ]);

            $invitation = $this->invitationService->create($courier, $owner, $data['phone']);

            return [
                'courier' => $courier,
                'inviteUrl' => $this->invitationService->invitationUrl($invitation),
            ];
        });
    }

    public function getStats(): array
    {
        $total = User::where('role', 'courier')->count();
        $online = User::where('role', 'courier')->where('is_online', true)->count();
        $activeLocation = User::where('role', 'courier')
            ->whereNotNull('location_updated_at')
            ->where('location_updated_at', '>=', now()->subMinutes(5))
            ->count();

        return [
            'total' => $total,
            'online' => $online,
            'active_location' => $activeLocation,
        ];
    }

    public function getTodayDeliveryCount(): int
    {
        return Delivery::whereDate('created_at', today())->count();
    }

    private function generateEmail(string $phone): string
    {
        $base = 'courier.' . $phone . '@dombi.local';
        $email = $base;
        $counter = 1;

        while (User::where('email', $email)->exists()) {
            $email = 'courier.' . $phone . '.' . $counter . '@dombi.local';
            $counter++;
        }

        return $email;
    }
}
