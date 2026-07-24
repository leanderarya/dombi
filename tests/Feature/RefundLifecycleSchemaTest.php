<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Tests\TestCase;
use App\Models\Order;

class RefundLifecycleSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_lifecycle_columns_and_history_table_exist(): void
    {
        $this->assertTrue(Schema::hasColumn('orders', 'refund_destination_status'));
        foreach (['id', 'order_id', 'from_status', 'to_status', 'event', 'actor_type', 'actor_id', 'reason_code', 'note', 'metadata', 'created_at'] as $column) {
            $this->assertTrue(Schema::hasColumn('refund_status_histories', $column));
        }
        $this->assertFalse(Schema::hasColumn('refund_status_histories', 'updated_at'));
    }

    public function test_existing_destination_rows_backfill_valid_and_missing(): void
    {
        $this->artisan('migrate:fresh', [
            '--path' => 'database/migrations',
            '--realpath' => false,
        ])->assertSuccessful();

        Schema::table('orders', function (Blueprint $table): void {
            $table->dropIndex('orders_refund_queue_index');
            $table->dropColumn('refund_destination_status');
        });
        Schema::dropIfExists('refund_status_histories');
        DB::table('migrations')
            ->where('migration', '2026_07_24_010000_add_refund_lifecycle_hardening')
            ->delete();

        $base = Order::factory()->raw(['payment_status' => 'refund_pending']);
        $validId = DB::table('orders')->insertGetId(array_merge($base, [
            'refund_destination_type' => 'bank',
            'refund_destination_submitted_at' => now(),
        ]));
        $missingId = DB::table('orders')->insertGetId(array_merge($base, [
            'order_code' => $base['order_code'].'-M',
            'refund_destination_type' => null,
            'refund_destination_submitted_at' => null,
        ]));

        $this->artisan('migrate', [
            '--path' => 'database/migrations/2026_07_24_010000_add_refund_lifecycle_hardening.php',
        ])->assertSuccessful();

        $this->assertSame('valid', DB::table('orders')->find($validId)->refund_destination_status);
        $this->assertSame('missing', DB::table('orders')->find($missingId)->refund_destination_status);
    }
}
