<?php

namespace Database\Seeders;

use App\Models\PaymentAccount;
use Illuminate\Database\Seeder;

class PaymentAccountSeeder extends Seeder
{
    public function run(): void
    {
        PaymentAccount::updateOrCreate(
            ['account_number' => '1234567890'],
            [
                'bank_name' => 'BCA',
                'account_holder' => 'PT Dombi Indonesia',
                'is_active' => true,
            ]
        );

        PaymentAccount::updateOrCreate(
            ['account_number' => '0987654321'],
            [
                'bank_name' => 'Mandiri',
                'account_holder' => 'PT Dombi Indonesia',
                'is_active' => true,
            ]
        );
    }
}
