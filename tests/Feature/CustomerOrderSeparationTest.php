<?php

namespace Tests\Feature;

use App\Models\Order;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerOrderSeparationTest extends TestCase
{
    use RefreshDatabase;

    public function test_order_model_has_status_constants(): void
    {
        $this->assertSame(
            ['pending_confirmation', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering'],
            Order::ACTIVE_STATUSES
        );

        $this->assertSame(
            ['completed', 'cancelled_by_customer', 'cancelled_by_outlet', 'rejected_by_outlet', 'failed_delivery', 'expired'],
            Order::HISTORY_STATUSES
        );
    }
}
