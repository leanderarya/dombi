<?php

namespace App\Services;

use App\Models\Outlet;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
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

            $user = new User([
                'name' => $this->generateAccountName($outlet->name),
                'email' => $email,
                'password' => $password,
                'phone' => $outlet->phone,
            ]);
            $user->role = 'outlet';
            $user->is_active = true;
            $user->outlet_id = $outlet->id;
            $user->must_change_password = true;
            $user->save();

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

    public function resetOutletPassword(Outlet $outlet): array
    {
        $user = $outlet->user;
        if (! $user) {
            $user = User::where('outlet_id', $outlet->id)->first();
        }
        if (! $user) {
            throw new ModelNotFoundException("Akun outlet tidak ditemukan untuk outlet ID {$outlet->id}");
        }

        return DB::transaction(function () use ($outlet, $user): array {
            $newPassword = $this->generateTemporaryPassword();
            $user->forceFill([
                'password' => $newPassword, // cast 'hashed'
                'must_change_password' => true,
                'remember_token' => Str::random(60), // driver agnostic, invalidates remember-me
            ])->save();

            // Do NOT touch is_active

            $credentials = [
                'outlet_name' => $outlet->name,
                'email' => $user->email,
                'temporary_password' => $newPassword,
                'must_change_password' => true,
            ];

            return [
                'user' => $user->fresh(),
                'outlet' => $outlet->fresh(),
                'temporary_password' => $newPassword,
                'credentials' => $credentials,
            ];
        });
    }
}
