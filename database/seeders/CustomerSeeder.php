<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\User;
use Illuminate\Database\Seeder;

class CustomerSeeder extends Seeder
{
    public function run(): void
    {
        // ── Registered customer, linked to the existing customer@example.com user ──
        $user = User::where(['email' => 'customer@example.com', 'role' => 'customer'])->first();

        $customer = Customer::updateOrCreate(
            ['user_id' => $user?->id],
            [
                'name' => 'Customer Dombi',
                'phone' => '089000000001',
                'email' => 'customer@example.com',
                'is_registered' => true,
                'last_order_at' => now()->subDays(2),
            ],
        );

        $this->seedAddress($customer, [
            'label' => 'Rumah',
            'recipient_name' => 'Customer Dombi',
            'phone' => '089000000001',
            'address_line' => 'Jl. Gajah Mada No. 45',
            'address' => 'Jl. Gajah Mada No. 45, Krobokan, Semarang Barat, Semarang, Jawa Tengah 50147',
            'village' => 'Krobokan',
            'district' => 'Semarang Barat',
            'city' => 'Semarang',
            'province' => 'Jawa Tengah',
            'postal_code' => '50147',
            'latitude' => -6.9872000,
            'longitude' => 110.4040000,
            'is_default' => true,
        ]);

        $this->seedAddress($customer, [
            'label' => 'Kantor',
            'recipient_name' => 'Customer Dombi',
            'phone' => '089000000001',
            'address_line' => 'Jl. Pandanaran No. 88',
            'address' => 'Jl. Pandanaran No. 88, Pekunden, Semarang Tengah, Semarang, Jawa Tengah 50134',
            'village' => 'Pekunden',
            'district' => 'Semarang Tengah',
            'city' => 'Semarang',
            'province' => 'Jawa Tengah',
            'postal_code' => '50134',
            'latitude' => -6.9875000,
            'longitude' => 110.4120000,
            'is_default' => false,
        ]);

        // ── Guest customers (unregistered, phone-only) ──
        $guests = [
            ['name' => 'Budi Santoso', 'phone' => '081200000001', 'daysAgo' => 1],
            ['name' => 'Siti Rahayu', 'phone' => '081200000002', 'daysAgo' => 3],
            ['name' => 'Agus Wijaya', 'phone' => '081200000003', 'daysAgo' => 5],
            ['name' => 'Dewi Lestari', 'phone' => '081200000004', 'daysAgo' => 7],
            ['name' => 'Rizky Pratama', 'phone' => '081200000005', 'daysAgo' => 10],
        ];

        foreach ($guests as $g) {
            $guest = Customer::updateOrCreate(
                ['phone' => $g['phone']],
                [
                    'name' => $g['name'],
                    'email' => null,
                    'is_registered' => false,
                    'user_id' => null,
                    'last_order_at' => now()->subDays($g['daysAgo']),
                ],
            );

            $this->seedAddress($guest, [
                'label' => 'Rumah',
                'recipient_name' => $g['name'],
                'phone' => $g['phone'],
                'address_line' => 'Jl. Contoh '.$g['name'].' No. '.rand(1, 99),
                'address' => 'Jl. Contoh, Meteseh, Tembalang, Semarang, Jawa Tengah 50275',
                'village' => 'Meteseh',
                'district' => 'Tembalang',
                'city' => 'Semarang',
                'province' => 'Jawa Tengah',
                'postal_code' => '50275',
                'latitude' => -7.0500000,
                'longitude' => 110.4400000,
                'is_default' => true,
            ]);
        }

        $this->command?->info('CustomerSeeder: 1 registered + 5 guest customers seeded.');
    }

    private function seedAddress(Customer $customer, array $data): void
    {
        CustomerAddress::updateOrCreate(
            ['customer_id' => $customer->id, 'label' => $data['label']],
            $data,
        );
    }
}
