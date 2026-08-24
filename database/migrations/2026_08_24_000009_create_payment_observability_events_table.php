<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('payment_observability_events', function (Blueprint $table): void {
            $table->id();
            $table->string('event_name');
            $table->unsignedBigInteger('order_id')->nullable();
            $table->unsignedBigInteger('attempt_id')->nullable();
            $table->string('invoice_number')->nullable();
            $table->string('request_id')->nullable();
            $table->string('gateway_reference')->nullable();
            $table->string('mapped_status')->nullable();
            $table->string('processing_result')->nullable();
            $table->string('error_reason')->nullable();
            $table->string('provider')->nullable();
            $table->string('provider_status')->nullable();
            $table->timestamps();
            $table->index(['event_name', 'attempt_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_observability_events');
    }
};
