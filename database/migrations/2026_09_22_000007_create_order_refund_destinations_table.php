<?php

use App\Support\StatusConstraints;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_refund_destinations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained()->restrictOnDelete();
            $table->string('event');
            $table->string('destination_type');
            $table->text('bank_name')->nullable();
            $table->text('account_number')->nullable();
            $table->text('account_holder')->nullable();
            $table->text('ewallet_provider')->nullable();
            $table->text('ewallet_number')->nullable();
            $table->text('ewallet_holder')->nullable();
            $table->string('actor_type')->nullable();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->nullable();

            $table->index(['order_id', 'created_at']);
        });

        $this->addStatusConstraints();
    }

    public function down(): void
    {
        Schema::dropIfExists('order_refund_destinations');
    }

    /**
     * The status constraints migration runs before this table exists, so the
     * allowed values are applied here from the same definition source.
     */
    private function addStatusConstraints(): void
    {
        if (! in_array(DB::getDriverName(), ['mysql', 'pgsql'], true)) {
            return;
        }

        foreach (array_keys(StatusConstraints::ALLOWED_VALUES['order_refund_destinations']) as $column) {
            $name = StatusConstraints::constraintName('order_refund_destinations', $column);

            $quoted = implode(', ', array_map(
                fn (string $value): string => "'".str_replace("'", "''", $value)."'",
                StatusConstraints::allowedFor('order_refund_destinations', $column)
            ));

            DB::statement("ALTER TABLE order_refund_destinations ADD CONSTRAINT {$name} CHECK ({$column} IN ({$quoted}))");
        }
    }
};
