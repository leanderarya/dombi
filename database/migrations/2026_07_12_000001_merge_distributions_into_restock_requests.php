<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restock_requests', function (Blueprint $table): void {
            $table->foreignId('sent_by')->nullable()->after('rejected_reason')->constrained('users')->nullOnDelete();
            $table->timestamp('sent_at')->nullable()->after('sent_by');
            $table->foreignId('received_by')->nullable()->after('sent_at')->constrained('users')->nullOnDelete();
            $table->timestamp('received_at')->nullable()->after('received_by');
            $table->text('received_notes')->nullable()->after('received_at');
            $table->text('damage_notes')->nullable()->after('received_notes');
        });

        DB::statement("
            UPDATE restock_requests rr
            INNER JOIN stock_distributions sd ON sd.restock_request_id = rr.id
            SET
                rr.sent_by        = sd.sent_by,
                rr.sent_at        = sd.sent_at,
                rr.received_by    = sd.received_by,
                rr.received_at    = sd.received_at,
                rr.received_notes = sd.received_notes,
                rr.damage_notes   = sd.damage_notes
        ");

        DB::statement("ALTER TABLE restock_requests MODIFY status ENUM('requested', 'rejected', 'preparing', 'shipped', 'completed', 'cancelled') NOT NULL DEFAULT 'requested'");

        Schema::dropIfExists('stock_distribution_items');
        Schema::dropIfExists('stock_distributions');
    }

    public function down(): void
    {
        Schema::create('stock_distributions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('restock_request_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->enum('status', ['preparing', 'shipped', 'received', 'completed'])->default('preparing');
            $table->foreignId('sent_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->text('received_notes')->nullable();
            $table->text('damage_notes')->nullable();
            $table->text('notes')->nullable();
            $table->unique('restock_request_id');
            $table->timestamps();
        });

        Schema::create('stock_distribution_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('stock_distribution_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('product_variant_id')->nullable()->after('product_id');
            $table->index('product_variant_id');
            $table->unsignedInteger('quantity');
            $table->timestamps();
        });

        DB::statement("ALTER TABLE restock_requests MODIFY status ENUM('requested', 'approved', 'rejected', 'preparing', 'shipped', 'received', 'completed', 'cancelled') NOT NULL DEFAULT 'requested'");

        Schema::table('restock_requests', function (Blueprint $table): void {
            $table->dropForeign(['sent_by']);
            $table->dropForeign(['received_by']);
            $table->dropColumn(['sent_by', 'sent_at', 'received_by', 'received_at', 'received_notes', 'damage_notes']);
        });
    }
};
