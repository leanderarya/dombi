<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_webhook_logs', function (Blueprint $table): void {
            $table->text('raw_body')->nullable()->after('payload');
            $table->string('body_digest', 64)->nullable()->after('raw_body');
            $table->timestamp('claimed_at')->nullable()->after('body_digest');
        });

        $duplicates = DB::table('payment_webhook_logs')
            ->select('request_id')
            ->whereNotNull('request_id')
            ->groupBy('request_id')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('request_id');
        DB::table('payment_webhook_logs')->whereNull('raw_body')->orderBy('id')->chunkById(100, function ($rows): void {
            foreach ($rows as $row) {
                $rawBody = json_encode($row->payload ?? [], JSON_UNESCAPED_SLASHES);
                DB::table('payment_webhook_logs')->where('id', $row->id)->update([
                    'raw_body' => $rawBody,
                    'body_digest' => base64_encode(hash('sha256', $rawBody, true)),
                ]);
            }
        });

        foreach ($duplicates as $requestId) {
            $rows = DB::table('payment_webhook_logs')
                ->where('request_id', $requestId)
                ->orderByDesc('id')
                ->get(['id', 'status']);
            $retainId = $rows->firstWhere('status', 'processed')?->id ?? $rows->first()?->id;
            $deleteIds = $rows->pluck('id')->reject(static fn ($id): bool => $id === $retainId)->values()->all();
            if ($deleteIds !== []) {
                DB::table('payment_webhook_logs')->whereIn('id', $deleteIds)->delete();
            }
        }

        Schema::table('payment_webhook_logs', function (Blueprint $table): void {
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
