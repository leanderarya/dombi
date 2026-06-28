<?php

namespace App\Console\Commands;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Console\Command;

class BackfillCustomers extends Command
{
    protected $signature = 'customers:backfill';

    protected $description = 'Create Customer records for users with role=customer that do not have one';

    public function handle(): int
    {
        $usersWithoutCustomer = User::where('role', 'customer')
            ->whereNotIn('id', Customer::whereNotNull('user_id')->pluck('user_id'))
            ->get();

        if ($usersWithoutCustomer->isEmpty()) {
            $this->info('All customer users already have Customer records.');

            return self::SUCCESS;
        }

        $this->info("Found {$usersWithoutCustomer->count()} users without Customer records.");

        $bar = $this->output->createProgressBar($usersWithoutCustomer->count());
        $bar->start();

        foreach ($usersWithoutCustomer as $user) {
            Customer::firstOrCreate(
                ['user_id' => $user->id],
                [
                    'name' => $user->name,
                    'email' => $user->email,
                    'is_registered' => true,
                ],
            );
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info('Backfill complete.');

        return self::SUCCESS;
    }
}
