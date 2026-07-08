<?php

namespace Database\Seeders;

use App\Models\Outlet;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class OutletSeeder extends Seeder
{
    public function run(): void
    {
        $password = Hash::make('password');

        // ── Owner ──────────────────────────────────────────────────
        User::updateOrCreate(['email' => 'owner@example.com'], [
            'name' => 'Owner Dombi',
            'password' => $password,
            'role' => 'owner',
            'phone' => '081111111111',
            'is_active' => true,
            'must_change_password' => false,
        ]);

        // ── Outlet Tembalang ───────────────────────────────────────
        $tembalangUser = User::updateOrCreate(['email' => 'outlet.tembalang@example.com'], [
            'name' => 'Outlet Tembalang',
            'password' => $password,
            'role' => 'outlet',
            'phone' => '082100000001',
            'is_active' => true,
            'must_change_password' => false,
        ]);

        $tembalang = Outlet::updateOrCreate(['name' => 'Outlet Tembalang'], [
            'user_id' => $tembalangUser->id,
            'kelurahan' => 'Tembalang',
            'kecamatan' => 'Tembalang',
            'city' => 'Semarang',
            'province' => 'Jawa Tengah',
            'postal_code' => '50275',
            'address' => 'Jl. Tembalang Raya No. 12, Semarang',
            'latitude' => -7.0568000,
            'longitude' => 110.4381000,
            'phone' => '085555555555',
            'status' => 'active',
        ]);

        $tembalangUser->update(['outlet_id' => $tembalang->id]);

        // ── Outlet Banyumanik ──────────────────────────────────────
        $banyumanikUser = User::updateOrCreate(['email' => 'outlet.banyumanik@example.com'], [
            'name' => 'Outlet Banyumanik',
            'password' => $password,
            'role' => 'outlet',
            'phone' => '082100000002',
            'is_active' => true,
            'must_change_password' => false,
        ]);

        $banyumanik = Outlet::updateOrCreate(['name' => 'Outlet Banyumanik'], [
            'user_id' => $banyumanikUser->id,
            'kelurahan' => 'Banyumanik',
            'kecamatan' => 'Banyumanik',
            'city' => 'Semarang',
            'province' => 'Jawa Tengah',
            'postal_code' => '50263',
            'address' => 'Jl. Banyumanik No. 8, Semarang',
            'latitude' => -7.0731000,
            'longitude' => 110.4216000,
            'phone' => '086666666666',
            'status' => 'active',
        ]);

        $banyumanikUser->update(['outlet_id' => $banyumanik->id]);

        // ── Courier ────────────────────────────────────────────────
        User::updateOrCreate(['email' => 'courier@example.com'], [
            'name' => 'Kurir Dombi',
            'password' => $password,
            'role' => 'courier',
            'phone' => '083100000001',
            'is_active' => true,
            'must_change_password' => false,
        ]);

        // ── Test Customer ─────────────────────────────────────────
        User::updateOrCreate(['email' => 'customer@example.com'], [
            'name' => 'Customer Dombi',
            'password' => $password,
            'role' => 'customer',
            'phone' => '089000000001',
            'is_active' => true,
            'must_change_password' => false,
        ]);
    }
}
