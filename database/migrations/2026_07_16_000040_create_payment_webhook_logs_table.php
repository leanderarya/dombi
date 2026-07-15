<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_webhook_logs', function (Blueprint $table) {
            $table->id();
            $table->string('request_id')->nullable()->index();
            $table->string('source'); // notify | redirect
            $table->string('invoice_number')->nullable()->index();
            $table->string('status'); // received | signature_invalid | processed | error
            $table->boolean('signature_valid')->default(false);
            $table->string('mapped_status')->nullable();
            $table->json('payload')->nullable();
            $table->text('error')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_webhook_logs');
    }
};
