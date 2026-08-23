<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private function addMysqlCheckConstraint(): void
    {
        try {
            DB::statement('ALTER TABLE refund_obligations ADD CONSTRAINT refund_obligations_amount_positive CHECK (amount > 0)');
        } catch (QueryException $exception) {
            if (! str_contains(strtolower($exception->getMessage()), 'duplicate') && ! str_contains(strtolower($exception->getMessage()), 'already exists')) {
                throw $exception;
            }
        }
    }

    public function up(): void
    {
        $created = ! Schema::hasTable('refund_obligations');
        if ($created) {
            Schema::create('refund_obligations', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('payment_attempt_id')->constrained('payment_attempts')->cascadeOnDelete();
                $table->decimal('amount', 12, 2)->unsigned();
                $table->char('currency', 3);
                $table->string('reason');
                $table->enum('status', ['pending', 'in_progress', 'completed', 'rejected', 'failed', 'needs_review'])->default('pending');
                $table->string('destination_type')->nullable();
                $table->text('bank_name')->nullable();
                $table->text('account_number')->nullable();
                $table->text('account_holder')->nullable();
                $table->text('ewallet_provider')->nullable();
                $table->text('ewallet_number')->nullable();
                $table->text('ewallet_holder')->nullable();
                $table->timestamp('destination_submitted_at')->nullable();
                $table->string('transfer_reference')->nullable();
                $table->text('transfer_note')->nullable();
                $table->string('proof_image')->nullable();
                $table->foreignId('processed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('processed_at')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();
                $table->unique(['payment_attempt_id', 'reason']);
                $table->index(['status', 'created_at']);
            });
        }

        if (! Schema::hasTable('refund_obligations')) {
            return;
        }

        $indexes = collect(Schema::getIndexes('refund_obligations'));
        $hasUnique = $indexes->contains(fn (array $index): bool => $index['unique'] && $index['columns'] === ['payment_attempt_id', 'reason']);
        if (! $hasUnique) {
            try {
                Schema::table('refund_obligations', function (Blueprint $table): void {
                    $table->unique(['payment_attempt_id', 'reason'], 'refund_obligations_attempt_reason_unique');
                });
            } catch (QueryException $exception) {
                throw new RuntimeException('Unable to repair refund obligation uniqueness; resolve duplicate payment_attempt_id/reason rows.', 0, $exception);
            }
        }

        if (Schema::hasTable('payment_attempts')) {
            $foreignKeys = collect(Schema::getForeignKeys('refund_obligations'));
            $hasAttemptForeignKey = $foreignKeys->contains(fn (array $foreign): bool => $foreign['columns'] === ['payment_attempt_id'] && $foreign['foreign_table'] === 'payment_attempts');
            if (! $hasAttemptForeignKey) {
                $orphanCount = DB::table('refund_obligations')->whereNotExists(function ($query): void {
                    $query->select(DB::raw(1))->from('payment_attempts')->whereColumn('payment_attempts.id', 'refund_obligations.payment_attempt_id');
                })->count();
                if ($orphanCount > 0) {
                    throw new RuntimeException('Unable to repair refund obligation foreign key; orphan payment_attempt_id rows exist.');
                }
                try {
                    Schema::table('refund_obligations', function (Blueprint $table): void {
                        $table->foreign('payment_attempt_id')->references('id')->on('payment_attempts')->cascadeOnDelete();
                    });
                } catch (QueryException $exception) {
                    throw new RuntimeException('Unable to repair refund obligation payment_attempt_id foreign key.', 0, $exception);
                }
            }
        }

        match (DB::getDriverName()) {
            'sqlite' => [
                DB::statement('CREATE TRIGGER IF NOT EXISTS refund_obligations_amount_positive_insert BEFORE INSERT ON refund_obligations FOR EACH ROW WHEN NEW.amount <= 0 BEGIN SELECT RAISE(ABORT, \'Refund obligation amount must be positive\'); END'),
                DB::statement('CREATE TRIGGER IF NOT EXISTS refund_obligations_amount_positive_update BEFORE UPDATE OF amount ON refund_obligations FOR EACH ROW WHEN NEW.amount <= 0 BEGIN SELECT RAISE(ABORT, \'Refund obligation amount must be positive\'); END'),
            ],
            'mysql' => $this->addMysqlCheckConstraint(),
            'pgsql' => DB::statement("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'refund_obligations_amount_positive') THEN ALTER TABLE refund_obligations ADD CONSTRAINT refund_obligations_amount_positive CHECK (amount > 0); END IF; END $$"),
            default => null,
        };

    }

    public function down(): void
    {
        Schema::dropIfExists('refund_obligations');
    }
};
