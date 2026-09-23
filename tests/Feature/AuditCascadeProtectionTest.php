<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Outlet;
use App\Models\PaymentAttempt;
use App\Models\Settlement;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AuditCascadeProtectionTest extends TestCase
{
    use RefreshDatabase;

    public function test_settlement_audit_log_protects_its_user(): void
    {
        $user = User::factory()->create();
        $settlement = Settlement::factory()->create();

        DB::table('settlement_audit_logs')->insert([
            'settlement_id' => $settlement->id,
            'user_id' => $user->id,
            'action' => 'status',
        ]);

        $this->expectException(QueryException::class);
        $user->delete();
    }

    public function test_settlement_protects_its_outlet(): void
    {
        $outlet = Outlet::factory()->create();
        Settlement::factory()->create(['outlet_id' => $outlet->id]);

        $this->expectException(QueryException::class);
        $outlet->forceDelete();
    }

    public function test_stock_ledger_protects_its_outlet(): void
    {
        $outlet = Outlet::factory()->create();

        DB::table('stock_movements')->insert([
            'outlet_id' => $outlet->id,
            'type' => 'initial_stock',
            'quantity' => 10,
        ]);

        $this->expectException(QueryException::class);
        $outlet->forceDelete();
    }

    public function test_payment_attempt_protects_its_order(): void
    {
        $order = Order::factory()->create();

        PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'attempt-cascade',
            'invoice_number' => 'invoice-cascade',
            'merchant_request_id' => 'request-cascade',
            'amount_snapshot' => 12500,
            'currency_snapshot' => 'IDR',
        ]);

        $this->expectException(QueryException::class);
        $order->delete();
    }

    public function test_order_status_history_protects_its_order(): void
    {
        $order = Order::factory()->create();

        DB::table('order_status_histories')->insert([
            'order_id' => $order->id,
            'to_status' => 'awaiting_preparation',
        ]);

        $this->expectException(QueryException::class);
        $order->delete();
    }

    public function test_an_outlet_without_protected_records_can_still_be_removed(): void
    {
        $outlet = Outlet::factory()->create();

        $outlet->forceDelete();

        $this->assertDatabaseMissing('outlets', ['id' => $outlet->id]);
    }

    public function test_an_order_without_protected_records_can_still_be_removed(): void
    {
        $order = Order::factory()->create();

        $order->delete();

        $this->assertDatabaseMissing('orders', ['id' => $order->id]);
    }
}
