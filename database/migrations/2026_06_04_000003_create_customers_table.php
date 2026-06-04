<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Drop FK constraint on order_status_histories.changed_by (can now reference users OR customers)
        Schema::table('order_status_histories', function (Blueprint $table): void {
            $table->dropForeign(['changed_by']);
        });

        // 2. Create customers table
        Schema::create('customers', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('phone')->index();
            $table->string('email')->nullable();
            $table->timestamp('last_order_at')->nullable();
            $table->timestamps();

            $table->unique('phone');
        });

        // 2. Migrate existing User(role=customer) data into customers table
        $guestUsers = DB::table('users')->where('role', 'customer')->get();
        $phoneMap = []; // phone => customer_id

        foreach ($guestUsers as $user) {
            $customerId = DB::table('customers')->insertGetId([
                'name' => $user->name,
                'phone' => $user->phone,
                'email' => $user->email && str_contains($user->email, '@dombi.local') ? null : $user->email,
                'last_order_at' => DB::table('orders')
                    ->where('customer_id', $user->id)
                    ->max('ordered_at'),
                'created_at' => $user->created_at,
                'updated_at' => $user->updated_at,
            ]);
            $phoneMap[$user->id] = $customerId;
        }

        // 3. Add customer_id_new column to orders (temporary)
        Schema::table('orders', function (Blueprint $table): void {
            $table->foreignId('customer_id_new')->nullable()->after('customer_id');
        });

        // 4. Populate customer_id_new from the mapping
        foreach ($phoneMap as $userId => $customerId) {
            DB::table('orders')->where('customer_id', $userId)->update(['customer_id_new' => $customerId]);
        }

        // 5. Handle any orders with customer_id that wasn't in users (edge case)
        // These shouldn't exist but handle gracefully
        $orphanOrders = DB::table('orders')
            ->whereNull('customer_id_new')
            ->whereNotNull('customer_id')
            ->get();

        foreach ($orphanOrders as $order) {
            $user = DB::table('users')->where('id', $order->customer_id)->first();
            if ($user) {
                $existingCustomer = DB::table('customers')->where('phone', $user->phone)->first();
                if ($existingCustomer) {
                    DB::table('orders')->where('id', $order->id)->update(['customer_id_new' => $existingCustomer->id]);
                } else {
                    $customerId = DB::table('customers')->insertGetId([
                        'name' => $user->name,
                        'phone' => $user->phone ?? '0000000000',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    DB::table('orders')->where('id', $order->id)->update(['customer_id_new' => $customerId]);
                }
            }
        }

        // 6. Also handle orders with NULL customer_id (guest orders without user)
        // These should already be NULL and will remain NULL (anonymous orders)

        // 7. Add customer_id_new to customer_addresses
        Schema::table('customer_addresses', function (Blueprint $table): void {
            $table->foreignId('customer_id_new')->nullable()->after('user_id');
        });

        // 8. Populate customer_addresses.customer_id_new
        foreach ($phoneMap as $userId => $customerId) {
            DB::table('customer_addresses')->where('user_id', $userId)->update(['customer_id_new' => $customerId]);
        }

        // 9. Drop old foreign key constraints and columns, rename new columns
        // Orders: drop customer_id FK to users, rename customer_id_new to customer_id
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropForeign(['customer_id']);
            $table->dropColumn('customer_id');
        });

        Schema::table('orders', function (Blueprint $table): void {
            $table->renameColumn('customer_id_new', 'customer_id');
        });

        Schema::table('orders', function (Blueprint $table): void {
            $table->foreign('customer_id')->references('id')->on('customers')->nullOnDelete();
        });

        // CustomerAddresses: drop user_id FK to users, rename customer_id_new to customer_id
        Schema::table('customer_addresses', function (Blueprint $table): void {
            $table->dropForeign(['user_id']);
            $table->dropColumn('user_id');
        });

        Schema::table('customer_addresses', function (Blueprint $table): void {
            $table->renameColumn('customer_id_new', 'customer_id');
        });

        Schema::table('customer_addresses', function (Blueprint $table): void {
            $table->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();
        });

        // 10. Clean up guest customer User records
        // Only delete users that have role=customer AND email contains @dombi.local (auto-generated)
        // Preserve any users that might have real emails (future registered customers)
        DB::table('users')
            ->where('role', 'customer')
            ->where('email', 'like', '%@dombi.local')
            ->delete();
    }

    public function down(): void
    {
        // Reverse: add user_id back to customer_addresses
        Schema::table('customer_addresses', function (Blueprint $table): void {
            $table->foreignId('user_id')->nullable()->after('id');
        });

        // Reverse: add customer_id back to orders as user reference
        Schema::table('orders', function (Blueprint $table): void {
            $table->foreignId('user_id')->nullable()->after('id');
        });

        // Drop customers table
        Schema::dropIfExists('customers');
    }
};
