<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->timestamp('fulfilment_claimed_at')->nullable()->after('paid_at');
            $table->foreignId('fulfilment_claimed_by')->nullable()->after('fulfilment_claimed_at')->constrained('payment_attempts')->nullOnDelete();
            $table->index(['fulfilment_claimed_at']);
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('orders')) {
            return;
        }

        $foreignKeys = collect(Schema::getForeignKeys('orders'));
        $indexes = collect(Schema::getIndexes('orders'));
        Schema::table('orders', function (Blueprint $table) use ($foreignKeys, $indexes): void {
            if ($foreignKeys->contains(fn (array $foreign): bool => in_array('fulfilment_claimed_by', $foreign['columns'], true))) {
                $table->dropForeign(['fulfilment_claimed_by']);
            }
            if ($indexes->contains(fn (array $index): bool => in_array('fulfilment_claimed_at', $index['columns'], true))) {
                $table->dropIndex(['fulfilment_claimed_at']);
            }
            $columns = array_values(array_filter(['fulfilment_claimed_at', 'fulfilment_claimed_by'], fn (string $column): bool => Schema::hasColumn('orders', $column)));
            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
