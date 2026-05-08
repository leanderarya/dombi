<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE stock_movements MODIFY type ENUM('initial_stock', 'stock_adjustment', 'order_reserved', 'order_completed', 'order_cancelled', 'restock_in') NOT NULL");
        }

        Schema::create('restock_requests', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('status', ['requested', 'approved', 'rejected', 'preparing', 'shipped', 'received', 'completed'])->default('requested');
            $table->text('notes')->nullable();
            $table->text('owner_notes')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('rejected_at')->nullable();
            $table->text('rejected_reason')->nullable();
            $table->timestamps();
        });

        Schema::create('restock_request_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('restock_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('requested_quantity');
            $table->unsignedInteger('approved_quantity')->nullable();
            $table->timestamps();
        });

        Schema::create('stock_distributions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('restock_request_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->enum('status', ['preparing', 'shipped', 'received', 'completed'])->default('preparing');
            $table->foreignId('sent_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('stock_distribution_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('stock_distribution_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('quantity');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_distribution_items');
        Schema::dropIfExists('stock_distributions');
        Schema::dropIfExists('restock_request_items');
        Schema::dropIfExists('restock_requests');

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE stock_movements MODIFY type ENUM('initial_stock', 'stock_adjustment', 'order_reserved', 'order_completed', 'order_cancelled') NOT NULL");
        }
    }
};
