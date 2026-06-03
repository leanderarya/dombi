<?php

namespace App\Services;

use App\Models\Outlet;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OutletProvisioningService
{
    public function createOutletWithAccount(array $payload): array
    {
        return DB::transaction(function () use ($payload): array {
            $outlet = Outlet::create($payload);
            $password = $this->generateTemporaryPassword();
            $email = $this->generateOutletEmail($outlet->name);

            $user = User::create([
                'name' => $this->generateAccountName($outlet->name),
                'email' => $email,
                'password' => $password,
                'role' => 'outlet',
                'phone' => $outlet->phone,
                'is_active' => true,
                'outlet_id' => $outlet->id,
                'must_change_password' => true,
            ]);

            $outlet->update(['user_id' => $user->id]);

            return [
                'outlet' => $outlet->fresh(),
                'user' => $user->fresh(),
                'temporary_password' => $password,
                'credentials' => [
                    'outlet_name' => $outlet->name,
                    'email' => $user->email,
                    'temporary_password' => $password,
                    'status' => $outlet->status,
                    'location' => trim(collect([$outlet->kelurahan, $outlet->kecamatan, $outlet->city])->filter()->implode(', ')),
                    'must_change_password' => true,
                ],
            ];
        });
    }

    public function generateOutletEmail(string $outletName): string
    {
        $base = Str::slug($outletName);
        $base = Str::startsWith($base, 'outlet-') ? $base : "outlet-{$base}";
        $candidate = "{$base}@dombi.local";
        $counter = 2;

        while (User::where('email', $candidate)->exists()) {
            $candidate = "{$base}-{$counter}@dombi.local";
            $counter++;
        }

        return $candidate;
    }

    public function generateAccountName(string $outletName): string
    {
        return "{$outletName} Operations";
    }

    public function generateTemporaryPassword(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $token = collect(range(1, 8))
            ->map(fn () => $alphabet[random_int(0, strlen($alphabet) - 1)])
            ->implode('');

        return "DMB-{$token}";
    }
}
