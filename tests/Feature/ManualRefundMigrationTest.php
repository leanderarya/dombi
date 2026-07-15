<?php

namespace Tests\Feature;

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
    }
}
