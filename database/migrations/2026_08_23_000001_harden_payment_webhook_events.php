<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $duplicates = DB::table('payment_webhook_logs')
            ->select('request_id')
            ->whereNotNull('request_id')
            ->groupBy('request_id')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('request_id');
        foreach ($duplicates as $requestId) {
            $ids = DB::table('payment_webhook_logs')
                ->where('request_id', $requestId)
                ->orderByDesc('id')
                ->pluck('id');
            $deleteIds = $ids->slice(1)->values()->all();
            if ($deleteIds !== []) {
                DB::table('payment_webhook_logs')->whereIn('id', $deleteIds)->delete();
            }
        }

        Schema::table('payment_webhook_logs', function (Blueprint $table): void {
            $table->text('raw_body')->nullable()->after('payload');
            $table->string('body_digest', 64)->nullable()->after('raw_body');
            $table->timestamp('claimed_at')->nullable()->after('body_digest');
            $table->unique('request_id');
        });
    }

    public function down(): void
    {
        Schema::table('payment_webhook_logs', function (Blueprint $table): void {
            $table->dropUnique(['request_id']);
            $table->dropColumn(['raw_body', 'body_digest', 'claimed_at']);
        });
    }
};
