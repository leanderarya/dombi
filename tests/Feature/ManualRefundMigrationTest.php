<?php

namespace Tests\Feature;

use App\Models\Order;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ManualRefundMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_manual_refund_columns_exist(): void
    {
        $this->assertTrue(Schema::hasColumn('orders', 'refund_requested_at'));
        $this->assertTrue(Schema::hasColumn('orders', 'refund_proof_image'));
        $this->assertTrue(Schema::hasColumn('orders', 'refunded_by'));
        $this->assertTrue(Schema::hasColumn('orders', 'refund_rejected_reason'));
        $this->assertTrue(Schema::hasColumns('orders', [
            'refund_destination_type',
            'refund_bank_name',
            'refund_account_number',
            'refund_account_holder',
            'refund_ewallet_provider',
            'refund_ewallet_number',
            'refund_ewallet_holder',
            'refund_destination_submitted_at',
            'refund_started_at',
            'refund_started_by',
            'refund_transfer_reference',
            'refund_transfer_note',
            'refund_rejected_at',
            'refund_rejected_by',
            'refund_rejection_note',
        ]));
    }

    public function test_refund_in_progress_payment_status_is_supported(): void
    {
        $order = Order::factory()->create(['payment_status' => 'refund_in_progress']);

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'payment_status' => 'refund_in_progress',
        ]);
    }
}
