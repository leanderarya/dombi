<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\Settlement;
use App\Models\SettlementPayment;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DatabaseSchemaHardeningTest extends TestCase
{
    use RefreshDatabase;

    private const CURRENCY_COLUMNS = [
        'delivery_tiers' => ['fee'],
        'exchange_request_items' => ['subtotal', 'unit_price'],
        'exchange_requests' => ['exchange_value', 'return_value'],
        'offline_sales' => ['center_price', 'total_amount'],
        'order_items' => ['center_price_snapshot', 'outlet_margin_snapshot', 'price', 'selling_price_snapshot', 'subtotal'],
        'orders' => ['absorbed_fee', 'delivery_fee', 'gateway_fee', 'payment_fee', 'refund_amount', 'subtotal', 'total'],
        'outlet_product_prices' => ['selling_price'],
        'payment_attempts' => ['amount_snapshot', 'gateway_amount'],
        'payment_transactions' => ['amount'],
        'pricing_audit_logs' => ['new_price', 'old_price'],
        'products' => ['center_price', 'selling_price'],
        'refund_obligations' => ['amount'],
        'return_request_items' => ['subtotal', 'unit_price'],
        'return_requests' => ['total_value'],
        'settlements' => ['delivery_fee_amount', 'overpaid_amount'],
    ];

    public function test_no_application_table_declares_two_indexes_over_the_same_columns(): void
    {
        $duplicates = [];

        foreach ($this->applicationTables() as $table) {
            $grouped = collect(Schema::getIndexes($table))
                ->groupBy(fn (array $index): string => implode(',', $index['columns']))
                ->filter(fn (Collection $indexes): bool => $indexes->count() > 1);

            foreach ($grouped as $columns => $indexes) {
                $duplicates[] = $table.' ('.$columns.'): '.$indexes->pluck('name')->implode(', ');
            }
        }

        $this->assertSame([], $duplicates, 'Redundant indexes: '.implode(' | ', $duplicates));
    }

    public function test_currency_columns_share_one_decimal_precision(): void
    {
        foreach (self::CURRENCY_COLUMNS as $table => $columns) {
            $this->assertTrue(Schema::hasTable($table), "Missing table {$table}.");
            $definition = collect(Schema::getColumns($table))->keyBy('name');

            foreach ($columns as $column) {
                $this->assertTrue($definition->has($column), "Missing column {$table}.{$column}.");
                $this->assertMatchesRegularExpression(
                    '/^(decimal|numeric)\(14, ?2\)$/',
                    $definition[$column]['type'],
                    "{$table}.{$column} must use the shared currency precision."
                );
            }
        }
    }

    public function test_stock_movement_product_and_timeline_lookups_each_have_an_index(): void
    {
        $indexes = collect(Schema::getIndexes('stock_movements'))->keyBy('name');

        $this->assertSame(
            ['product_id', 'created_at'],
            $indexes['stock_movements_product_id_created_at_index']['columns'] ?? null
        );
        $this->assertSame(
            ['created_at'],
            $indexes['stock_movements_created_at_index']['columns'] ?? null
        );
    }

    public function test_settlement_payment_rejects_unknown_settlement(): void
    {
        $payment = SettlementPayment::factory()->create();

        $this->expectException(QueryException::class);
        $payment->update(['settlement_id' => 999999]);
    }

    public function test_settlement_payment_link_is_cleared_when_settlement_is_removed(): void
    {
        $outlet = Outlet::factory()->create();
        $settlement = Settlement::factory()->create(['outlet_id' => $outlet->id]);
        $payment = SettlementPayment::factory()->create([
            'outlet_id' => $outlet->id,
            'settlement_id' => $settlement->id,
        ]);

        $settlement->delete();

        $this->assertNull($payment->fresh()->settlement_id);
    }

    private function applicationTables(): array
    {
        $database = DB::connection()->getDatabaseName();

        return collect(Schema::getTables())
            ->filter(fn (array $table): bool => ($table['schema'] ?? null) === $database)
            ->pluck('name')
            ->all();
    }
}
