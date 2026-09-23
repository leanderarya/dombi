<?php

namespace Tests\Feature;

use App\Models\Delivery;
use App\Models\ExchangeRequest;
use App\Models\Order;
use App\Models\OrderReport;
use App\Models\Outlet;
use App\Models\ReturnRequest;
use App\Models\Settlement;
use App\Support\StatusConstraints;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use ReflectionClass;
use Tests\TestCase;

class StatusConstraintTest extends TestCase
{
    use RefreshDatabase;

    public function test_order_status_columns_stay_in_sync_with_model_constants(): void
    {
        $this->assertSame(
            $this->modelConstants(Order::class, 'STATUS_'),
            $this->allowed('orders', 'status')
        );
        $this->assertSame(
            $this->modelConstants(Order::class, 'FULFILLMENT_'),
            $this->allowed('orders', 'fulfillment_type')
        );
        $this->assertSame(
            $this->modelConstants(Order::class, 'REFUND_DESTINATION_'),
            $this->allowed('orders', 'refund_destination_status')
        );
    }

    public function test_operational_status_columns_stay_in_sync_with_model_constants(): void
    {
        $this->assertSame(
            $this->modelConstants(Settlement::class, 'STATUS_'),
            $this->allowed('settlements', 'status')
        );
        $this->assertSame(
            $this->modelConstants(Settlement::class, 'DIRECTION_'),
            $this->allowed('settlements', 'direction')
        );
        $this->assertSame(
            $this->modelConstants(Settlement::class, 'DIRECTION_'),
            $this->allowed('settlement_payments', 'direction')
        );
        $this->assertSame(
            $this->modelConstants(ReturnRequest::class, 'STATUS_'),
            $this->allowed('return_requests', 'status')
        );
        $this->assertSame(
            $this->modelConstants(ExchangeRequest::class, 'STATUS_'),
            $this->allowed('exchange_requests', 'status')
        );
        $this->assertSame(
            $this->modelConstants(OrderReport::class, 'STATUS_'),
            $this->allowed('order_reports', 'status')
        );
        $this->assertSame(
            $this->modelConstants(OrderReport::class, 'TYPE_'),
            $this->allowed('order_reports', 'type')
        );
    }

    public function test_delivery_status_columns_stay_in_sync_with_model_lists(): void
    {
        $this->assertSame(
            $this->sorted(Delivery::RESOLUTION_STATUSES),
            $this->allowed('deliveries', 'resolution_status')
        );
        $this->assertSame(
            $this->sorted(Delivery::RETURN_STATUSES),
            $this->allowed('deliveries', 'return_status')
        );
    }

    public function test_columns_without_model_constants_keep_their_documented_values(): void
    {
        $this->assertSame(
            $this->sorted([
                'waiting_assignment', 'waiting_pickup', 'picked_up', 'delivering',
                'completed', 'failed', 'retry_delivery', 'returned_to_outlet',
                'cancelled_and_released', 'rejected_by_courier',
            ]),
            $this->allowed('deliveries', 'status')
        );
        $this->assertSame($this->sorted(['dombi', 'eksternal']), $this->allowed('deliveries', 'courier_type'));
        $this->assertSame(
            $this->sorted(['active', 'inactive', 'temporarily_closed', 'maintenance', 'archived']),
            $this->allowed('outlets', 'status')
        );
        $this->assertSame($this->sorted(['weekly']), $this->allowed('settlements', 'period_type'));
        $this->assertSame($this->sorted(['daily']), $this->sorted(StatusConstraints::legacyFor('settlements', 'period_type')));
        $this->assertSame($this->sorted(['pending', 'cancelled', 'failed']), $this->sorted(StatusConstraints::legacyFor('orders', 'status')));
    }

    public function test_no_column_lists_the_same_value_as_both_current_and_legacy(): void
    {
        foreach (StatusConstraints::ALLOWED_VALUES as $table => $columns) {
            foreach (array_keys($columns) as $column) {
                $current = StatusConstraints::currentFor($table, $column);
                $allowed = StatusConstraints::allowedFor($table, $column);

                $this->assertSame(
                    count($current) + count(StatusConstraints::legacyFor($table, $column)),
                    count(array_unique($allowed)),
                    "{$table}.{$column} repeats a value across current and legacy."
                );
            }
        }
    }

    public function test_every_current_order_status_is_accepted(): void
    {
        foreach ($this->modelConstants(Order::class, 'STATUS_') as $status) {
            Order::factory()->create(['order_code' => 'STATUS-'.$status, 'status' => $status]);
        }

        $this->assertDatabaseCount('orders', count($this->modelConstants(Order::class, 'STATUS_')));
    }

    public function test_unknown_order_status_is_rejected(): void
    {
        $this->expectException(QueryException::class);
        Order::factory()->create(['status' => 'bogus_status']);
    }

    public function test_unknown_fulfillment_type_is_rejected(): void
    {
        $this->expectException(QueryException::class);
        Order::factory()->create(['fulfillment_type' => 'delivery_drone']);
    }

    public function test_unknown_outlet_status_is_rejected(): void
    {
        $this->expectException(QueryException::class);
        Outlet::factory()->create(['status' => 'closed_forever']);
    }

    public function test_unknown_settlement_status_is_rejected(): void
    {
        $this->expectException(QueryException::class);
        Settlement::factory()->create(['status' => 'written_off']);
    }

    public function test_unknown_return_request_status_is_rejected(): void
    {
        $this->expectException(QueryException::class);
        ReturnRequest::factory()->create(['status' => 'pending_forever']);
    }

    public function test_unknown_delivery_status_is_rejected(): void
    {
        $order = Order::factory()->create();

        $this->expectException(QueryException::class);
        DB::table('deliveries')->insert(['order_id' => $order->id, 'status' => 'teleported']);
    }

    private function modelConstants(string $class, string $prefix): array
    {
        $values = collect((new ReflectionClass($class))->getConstants())
            ->filter(fn (mixed $value, string $name): bool => str_starts_with($name, $prefix) && is_string($value))
            ->values()
            ->all();

        return $this->sorted($values);
    }

    private function allowed(string $table, string $column): array
    {
        return $this->sorted(StatusConstraints::currentFor($table, $column));
    }

    private function sorted(array $values): array
    {
        sort($values);

        return $values;
    }
}
