<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * The data a fresh installation needs: the product catalog and the owner account.
 *
 * Kept separate from DatabaseSeeder on purpose. DatabaseSeeder also creates demo
 * outlets, couriers, customers and orders, and DemoOrderSeeder deletes every
 * order whose code starts with DEMO- when it runs. Point a real installation at
 * this seeder, never at DatabaseSeeder:
 *
 *     php artisan db:seed --class=InitialSeeder
 *
 * Re-running is safe. Products are upserted by category and name, and an owner
 * that already exists keeps its current password so this can never lock anyone
 * out of a live account.
 */
class InitialSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(ProductCatalogSeeder::class);

        $this->seedOwner();
    }

    private function seedOwner(): void
    {
        $email = env('INITIAL_OWNER_EMAIL', 'dombicenter@gmail.com');
        $name = env('INITIAL_OWNER_NAME', 'Owner Dombi');

        $owner = User::firstOrNew(['email' => $email]);

        if ($owner->exists && $owner->role !== 'owner') {
            $this->command?->error(
                "{$email} already exists with the role '{$owner->role}'. ".
                'Refusing to promote it to owner - change the email or resolve the account by hand.',
            );

            return;
        }

        $owner->fill([
            'name' => $name,
            'role' => 'owner',
            'is_active' => true,
        ]);

        if ($owner->exists) {
            $owner->save();

            $this->command?->info("Owner already exists: {$email} - password left untouched.");

            return;
        }

        $fromEnv = env('INITIAL_OWNER_PASSWORD');

        // Letters and numbers only: these end up in a .env file, where a symbol
        // like # would silently truncate the value.
        $password = $fromEnv ?: Str::password(32, symbols: false, spaces: false);

        $owner->password = $password;
        // must_change_password is intentionally not set: it is not fillable, and
        // the column already defaults to false.
        $owner->save();

        $this->command?->newLine();
        $this->command?->info("Owner created: {$email}");

        if ($fromEnv) {
            $this->command?->line('  Password taken from INITIAL_OWNER_PASSWORD.');
        } else {
            $this->command?->warn("  Password: {$password}");
            $this->command?->line('  Shown once and stored nowhere - save it now.');
            $this->command?->line('  Set INITIAL_OWNER_PASSWORD first to choose your own.');
        }

        $this->command?->newLine();
    }
}
