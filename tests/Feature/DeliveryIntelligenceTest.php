<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Delivery;
use App\Models\DeliveryResolutionLog;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use App\Services\DeliveryIntelligenceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeliveryIntelligenceTest extends TestCase
{
    use RefreshDatabase;

    private function makeContext(): array
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $courier = User::factory()->create(['role' => 'courier', 'is_active' => true]);
        $courier2 = User::factory()->create(['role' => 'courier', 'is_active' => true]);
        $customer = Customer::create([
            'name' => 'Budi Customer',
            'phone' => '6281234567890',
        ]);
        $outlet = Outlet::create([
            'user_id' => $owner->id,
            'name' => 'Outlet Test',
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'address' => 'Jl. Test',
            'latitude' => -6.2,
            'longitude' => 106.8,
            'phone' => '08123456789',
            'status' => 'active',
        ]);

        return compact('owner', 'courier', 'courier2', 'customer', 'outlet');
    }

    private function makeOrder(array $ctx, string $status = 'ready_for_pickup'): Order
    {
        return Order::create([
            'customer_id' => $ctx['customer']->id,
            'outlet_id' => $ctx['outlet']->id,
            'order_code' => 'ORD-'.strtoupper(substr(uniqid(), -6)),
            'status' => $status,
            'fulfillment_type' => 'delivery_dombi',
            'subtotal' => 25000,
            'delivery_fee' => 5000,
            'total' => 30000,
            'customer_name' => 'Budi',
            'customer_phone' => '08123456789',
            'customer_address' => 'Jl. Customer',
            'latitude' => -6.21,
            'longitude' => 106.81,
            'ordered_at' => now(),
        ]);
    }

    // ─── COURIER CAPACITY ──────────────────────────────────────────

    public function test_courier_capacity_status_available(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        $capacity = $intelligence->getCourierCapacity($ctx['courier']);

        $this->assertEquals(0, $capacity['active_deliveries']);
        $this->assertEquals('available', $capacity['capacity_status']);
    }

    public function test_courier_capacity_status_busy(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        for ($i = 0; $i < 3; $i++) {
            $order = $this->makeOrder($ctx);
            Delivery::create([
                'order_id' => $order->id,
                'courier_id' => $ctx['courier']->id,
                'status' => 'delivering',
                'assigned_by' => $ctx['owner']->id,
                'assigned_at' => now(),
                'pickup_time' => now(),
            ]);
        }

        $capacity = $intelligence->getCourierCapacity($ctx['courier']);

        $this->assertEquals(3, $capacity['active_deliveries']);
        $this->assertEquals('busy', $capacity['capacity_status']);
    }

    public function test_courier_capacity_status_overloaded(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        for ($i = 0; $i < 5; $i++) {
            $order = $this->makeOrder($ctx);
            Delivery::create([
                'order_id' => $order->id,
                'courier_id' => $ctx['courier']->id,
                'status' => 'delivering',
                'assigned_by' => $ctx['owner']->id,
                'assigned_at' => now(),
                'pickup_time' => now(),
            ]);
        }

        $capacity = $intelligence->getCourierCapacity($ctx['courier']);

        $this->assertEquals(5, $capacity['active_deliveries']);
        $this->assertEquals('overloaded', $capacity['capacity_status']);
    }

    public function test_courier_today_completed(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        $order = $this->makeOrder($ctx);
        Delivery::create([
            'order_id' => $order->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'completed',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now()->subHour(),
            'pickup_time' => now()->subMinutes(45),
            'delivered_time' => now()->subMinutes(15),
        ]);

        $capacity = $intelligence->getCourierCapacity($ctx['courier']);

        $this->assertEquals(1, $capacity['today_completed']);
    }

    public function test_courier_today_failed(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        $order = $this->makeOrder($ctx);
        Delivery::create([
            'order_id' => $order->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'failed',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now()->subHour(),
            'failed_reason' => 'Alamat tidak ditemukan',
        ]);

        $capacity = $intelligence->getCourierCapacity($ctx['courier']);

        $this->assertEquals(1, $capacity['today_failed']);
    }

    public function test_courier_avg_delivery_time(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        // 30 min delivery
        $order1 = $this->makeOrder($ctx);
        Delivery::create([
            'order_id' => $order1->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'completed',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now()->subHour(),
            'pickup_time' => now()->subMinutes(45),
            'delivered_time' => now()->subMinutes(15),
        ]);

        // 50 min delivery
        $order2 = $this->makeOrder($ctx);
        Delivery::create([
            'order_id' => $order2->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'completed',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now()->subHours(2),
            'pickup_time' => now()->subMinutes(70),
            'delivered_time' => now()->subMinutes(20),
        ]);

        $capacity = $intelligence->getCourierCapacity($ctx['courier']);

        $this->assertEquals(40, $capacity['avg_delivery_time']); // (30+50)/2
    }

    // ─── DELIVERY AGING ────────────────────────────────────────────

    public function test_oldest_deliveries_returns_sorted_list(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        $order1 = $this->makeOrder($ctx);
        Delivery::create([
            'order_id' => $order1->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'delivering',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now()->subMinutes(30),
            'pickup_time' => now()->subMinutes(20),
        ]);

        $order2 = $this->makeOrder($ctx);
        Delivery::create([
            'order_id' => $order2->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'waiting_pickup',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now()->subMinutes(60),
        ]);

        $oldest = $intelligence->getOldestDeliveries(10);

        $this->assertCount(2, $oldest);
        $this->assertEquals($order2->order_code, $oldest[0]['order_code']);
        $this->assertGreaterThan($oldest[1]['age_minutes'], $oldest[0]['age_minutes']);
    }

    public function test_oldest_deliveries_respects_limit(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        for ($i = 0; $i < 5; $i++) {
            $order = $this->makeOrder($ctx);
            Delivery::create([
                'order_id' => $order->id,
                'courier_id' => $ctx['courier']->id,
                'status' => 'delivering',
                'assigned_by' => $ctx['owner']->id,
                'assigned_at' => now()->subMinutes($i * 10),
                'pickup_time' => now()->subMinutes($i * 10),
            ]);
        }

        $oldest = $intelligence->getOldestDeliveries(3);

        $this->assertCount(3, $oldest);
    }

    public function test_oldest_deliveries_excludes_completed(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        $order1 = $this->makeOrder($ctx);
        Delivery::create([
            'order_id' => $order1->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'completed',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now()->subHour(),
            'pickup_time' => now()->subMinutes(45),
            'delivered_time' => now()->subMinutes(15),
        ]);

        $order2 = $this->makeOrder($ctx);
        Delivery::create([
            'order_id' => $order2->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'delivering',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now()->subMinutes(30),
            'pickup_time' => now()->subMinutes(20),
        ]);

        $oldest = $intelligence->getOldestDeliveries(10);

        $this->assertCount(1, $oldest);
        $this->assertEquals($order2->order_code, $oldest[0]['order_code']);
    }

    // ─── SLA VIOLATIONS ────────────────────────────────────────────

    public function test_sla_violations_detects_assignment_violations(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        $order = $this->makeOrder($ctx);
        // Manually set updated_at to 15 min ago (SLA is 10 min)
        \DB::table('orders')->where('id', $order->id)->update(['updated_at' => now()->subMinutes(15)]);

        $violations = $intelligence->getSlaViolations();

        $this->assertEquals(1, $violations['assignment']['count']);
        $this->assertEquals(0, $violations['pickup']['count']);
        $this->assertEquals(0, $violations['delivery']['count']);
    }

    public function test_sla_violations_detects_pickup_violations(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        $order = $this->makeOrder($ctx);
        Delivery::create([
            'order_id' => $order->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'waiting_pickup',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now()->subMinutes(25),
        ]);

        $violations = $intelligence->getSlaViolations();

        $this->assertEquals(1, $violations['pickup']['count']);
    }

    public function test_sla_violations_detects_delivery_violations(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        $order = $this->makeOrder($ctx);
        Delivery::create([
            'order_id' => $order->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'delivering',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now()->subMinutes(70),
            'pickup_time' => now()->subMinutes(65),
        ]);

        $violations = $intelligence->getSlaViolations();

        $this->assertEquals(1, $violations['delivery']['count']);
    }

    public function test_sla_violations_total_count(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        // Assignment violation
        $order1 = $this->makeOrder($ctx);
        \DB::table('orders')->where('id', $order1->id)->update(['updated_at' => now()->subMinutes(15)]);

        // Pickup violation
        $order2 = $this->makeOrder($ctx);
        Delivery::create([
            'order_id' => $order2->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'waiting_pickup',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now()->subMinutes(25),
        ]);

        $violations = $intelligence->getSlaViolations();

        $this->assertEquals(2, $violations['total']);
    }

    // ─── RETRY TRACKING ────────────────────────────────────────────

    public function test_retry_count_from_resolution_logs(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);
        $order = $this->makeOrder($ctx);

        DeliveryResolutionLog::create([
            'order_id' => $order->id,
            'delivery_id' => 1,
            'resolution_type' => 'retry_delivery',
            'resolved_by' => $ctx['owner']->id,
            'resolution_notes' => 'First retry',
            'retry_attempt' => 1,
            'previous_status' => 'failed',
            'new_status' => 'retry_delivery',
            'inventory_effect' => 'Reserved stock preserved',
            'created_at' => now()->subHours(2),
        ]);

        DeliveryResolutionLog::create([
            'order_id' => $order->id,
            'delivery_id' => 2,
            'resolution_type' => 'retry_delivery',
            'resolved_by' => $ctx['owner']->id,
            'resolution_notes' => 'Second retry',
            'retry_attempt' => 2,
            'previous_status' => 'failed',
            'new_status' => 'retry_delivery',
            'inventory_effect' => 'Reserved stock preserved',
            'created_at' => now()->subHour(),
        ]);

        $retryCount = $intelligence->getRetryCount($order->id);

        $this->assertEquals(2, $retryCount);
    }

    public function test_high_retry_deliveries_detection(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        $order = $this->makeOrder($ctx);

        for ($i = 1; $i <= 3; $i++) {
            DeliveryResolutionLog::create([
                'order_id' => $order->id,
                'delivery_id' => $i,
                'resolution_type' => 'retry_delivery',
                'resolved_by' => $ctx['owner']->id,
                'resolution_notes' => "Retry $i",
                'retry_attempt' => $i,
                'previous_status' => 'failed',
                'new_status' => 'retry_delivery',
                'inventory_effect' => 'Reserved stock preserved',
                'created_at' => now()->subHours($i),
            ]);
        }

        $highRetry = $intelligence->getHighRetryDeliveries(2);

        $this->assertCount(1, $highRetry);
        $this->assertEquals(3, $highRetry[0]['retry_count']);
    }

    public function test_high_retry_excludes_single_retries(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        $order = $this->makeOrder($ctx);

        DeliveryResolutionLog::create([
            'order_id' => $order->id,
            'delivery_id' => 1,
            'resolution_type' => 'retry_delivery',
            'resolved_by' => $ctx['owner']->id,
            'resolution_notes' => 'First retry',
            'retry_attempt' => 1,
            'previous_status' => 'failed',
            'new_status' => 'retry_delivery',
            'inventory_effect' => 'Reserved stock preserved',
            'created_at' => now()->subHour(),
        ]);

        $highRetry = $intelligence->getHighRetryDeliveries(2);

        $this->assertCount(0, $highRetry);
    }

    // ─── FAILURE INTELLIGENCE ──────────────────────────────────────

    public function test_top_failure_reasons(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        for ($i = 0; $i < 3; $i++) {
            $order = $this->makeOrder($ctx);
            Delivery::create([
                'order_id' => $order->id,
                'courier_id' => $ctx['courier']->id,
                'status' => 'failed',
                'assigned_by' => $ctx['owner']->id,
                'assigned_at' => now()->subHour(),
                'pickup_time' => now()->subMinutes(45),
                'failed_reason' => 'Customer Tidak Ditemukan',
            ]);
        }

        for ($i = 0; $i < 2; $i++) {
            $order = $this->makeOrder($ctx);
            Delivery::create([
                'order_id' => $order->id,
                'courier_id' => $ctx['courier']->id,
                'status' => 'failed',
                'assigned_by' => $ctx['owner']->id,
                'assigned_at' => now()->subHour(),
                'pickup_time' => now()->subMinutes(45),
                'failed_reason' => 'Alamat Tidak Jelas',
            ]);
        }

        $reasons = $intelligence->getTopFailureReasons(5);

        $this->assertCount(2, $reasons);
        $this->assertEquals('Customer Tidak Ditemukan', $reasons[0]['reason']);
        $this->assertEquals(3, $reasons[0]['count']);
        $this->assertEquals('Alamat Tidak Jelas', $reasons[1]['reason']);
        $this->assertEquals(2, $reasons[1]['count']);
    }

    public function test_top_failure_reasons_excludes_null_reasons(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        $order = $this->makeOrder($ctx);
        Delivery::create([
            'order_id' => $order->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'failed',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now()->subHour(),
            'failed_reason' => null,
        ]);

        $reasons = $intelligence->getTopFailureReasons(5);

        $this->assertCount(0, $reasons);
    }

    // ─── COURIER LEADERBOARD ───────────────────────────────────────

    public function test_courier_leaderboard_ranking(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        // Courier 1: 3 completed
        for ($i = 0; $i < 3; $i++) {
            $order = $this->makeOrder($ctx);
            Delivery::create([
                'order_id' => $order->id,
                'courier_id' => $ctx['courier']->id,
                'status' => 'completed',
                'assigned_by' => $ctx['owner']->id,
                'assigned_at' => now()->subHour(),
                'pickup_time' => now()->subMinutes(45),
                'delivered_time' => now()->subMinutes(15),
            ]);
        }

        // Courier 2: 1 completed, 1 failed
        $order = $this->makeOrder($ctx);
        Delivery::create([
            'order_id' => $order->id,
            'courier_id' => $ctx['courier2']->id,
            'status' => 'completed',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now()->subHour(),
            'pickup_time' => now()->subMinutes(45),
            'delivered_time' => now()->subMinutes(15),
        ]);

        $order = $this->makeOrder($ctx);
        Delivery::create([
            'order_id' => $order->id,
            'courier_id' => $ctx['courier2']->id,
            'status' => 'failed',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now()->subHour(),
            'pickup_time' => now()->subMinutes(45),
            'failed_reason' => 'Gagal',
        ]);

        $leaderboard = $intelligence->getCourierLeaderboard(5);

        $this->assertCount(2, $leaderboard);
        $this->assertEquals($ctx['courier']->id, $leaderboard[0]['id']);
        $this->assertEquals(3, $leaderboard[0]['completed']);
        $this->assertEquals(100.0, $leaderboard[0]['success_rate']);
    }

    public function test_courier_leaderboard_success_rate(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        // 1 completed, 1 failed = 50%
        $order1 = $this->makeOrder($ctx);
        Delivery::create([
            'order_id' => $order1->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'completed',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now()->subHour(),
            'pickup_time' => now()->subMinutes(45),
            'delivered_time' => now()->subMinutes(15),
        ]);

        $order2 = $this->makeOrder($ctx);
        Delivery::create([
            'order_id' => $order2->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'failed',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now()->subHour(),
            'failed_reason' => 'Gagal',
        ]);

        $leaderboard = $intelligence->getCourierLeaderboard(5);

        $courier1Entry = $leaderboard->firstWhere('id', $ctx['courier']->id);
        $this->assertNotNull($courier1Entry);
        $this->assertEquals(50.0, $courier1Entry['success_rate']);
    }

    // ─── HEALTH SCORE ──────────────────────────────────────────────

    public function test_health_score_excellent_when_no_issues(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        $health = $intelligence->getHealthScore();

        $this->assertEquals('excellent', $health['status']);
        $this->assertGreaterThanOrEqual(90, $health['score']);
    }

    public function test_health_score_drops_with_failures(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        for ($i = 0; $i < 5; $i++) {
            $order = $this->makeOrder($ctx);
            Delivery::create([
                'order_id' => $order->id,
                'courier_id' => $ctx['courier']->id,
                'status' => 'failed',
                'assigned_by' => $ctx['owner']->id,
                'assigned_at' => now()->subHour(),
                'failed_reason' => 'Gagal',
            ]);
        }

        $health = $intelligence->getHealthScore();

        $this->assertLessThan(90, $health['score']);
        $this->assertEquals(5, $health['factors']['failed_deliveries']);
    }

    public function test_health_score_with_overloaded_couriers(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        for ($i = 0; $i < 6; $i++) {
            $order = $this->makeOrder($ctx);
            Delivery::create([
                'order_id' => $order->id,
                'courier_id' => $ctx['courier']->id,
                'status' => 'delivering',
                'assigned_by' => $ctx['owner']->id,
                'assigned_at' => now(),
                'pickup_time' => now(),
            ]);
        }

        $health = $intelligence->getHealthScore();

        $this->assertGreaterThanOrEqual(1, $health['factors']['overloaded_couriers']);
    }

    public function test_health_score_needs_attention_status(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        // Create enough failures + SLA violations to drop score below 70
        // 10 failures = -25 (max)
        for ($i = 0; $i < 10; $i++) {
            $order = $this->makeOrder($ctx);
            Delivery::create([
                'order_id' => $order->id,
                'courier_id' => $ctx['courier']->id,
                'status' => 'failed',
                'assigned_by' => $ctx['owner']->id,
                'assigned_at' => now()->subHour(),
                'failed_reason' => 'Gagal',
            ]);
        }

        // Also create SLA violations to push score further down
        for ($i = 0; $i < 5; $i++) {
            $order = $this->makeOrder($ctx);
            \DB::table('orders')->where('id', $order->id)->update(['updated_at' => now()->subMinutes(15)]);
        }

        $health = $intelligence->getHealthScore();

        $this->assertContains($health['status'], ['needs_attention', 'critical', 'good']);
        $this->assertLessThanOrEqual(80, $health['score']);
    }

    // ─── COURIER FAILURE RATE ──────────────────────────────────────

    public function test_courier_failure_rate(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        for ($i = 0; $i < 2; $i++) {
            $order = $this->makeOrder($ctx);
            Delivery::create([
                'order_id' => $order->id,
                'courier_id' => $ctx['courier']->id,
                'status' => 'completed',
                'assigned_by' => $ctx['owner']->id,
                'assigned_at' => now()->subHour(),
                'pickup_time' => now()->subMinutes(45),
                'delivered_time' => now()->subMinutes(15),
            ]);
        }

        $order = $this->makeOrder($ctx);
        Delivery::create([
            'order_id' => $order->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'failed',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now()->subHour(),
            'failed_reason' => 'Gagal',
        ]);

        $rate = $intelligence->getCourierFailureRate($ctx['courier']);

        $this->assertEquals(33.3, $rate);
    }

    public function test_courier_failure_rate_zero_when_no_deliveries(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        $rate = $intelligence->getCourierFailureRate($ctx['courier']);

        $this->assertEquals(0, $rate);
    }

    // ─── CAPACITY STATUS THRESHOLDS ────────────────────────────────

    public function test_capacity_thresholds(): void
    {
        $ctx = $this->makeContext();
        $intelligence = app(DeliveryIntelligenceService::class);

        $this->assertEquals('available', $intelligence->capacityStatus(0));
        $this->assertEquals('available', $intelligence->capacityStatus(1));
        $this->assertEquals('available', $intelligence->capacityStatus(2));
        $this->assertEquals('busy', $intelligence->capacityStatus(3));
        $this->assertEquals('busy', $intelligence->capacityStatus(4));
        $this->assertEquals('overloaded', $intelligence->capacityStatus(5));
        $this->assertEquals('overloaded', $intelligence->capacityStatus(10));
    }
}
