<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TARGET_PRECISION = 14;

    /**
     * Currency columns that drifted across decimal(10,2), decimal(12,2), decimal(14,2)
     * and decimal(12,2) unsigned for the same Rupiah unit. 'from' is the precision the
     * column carried before this migration so down() can restore it exactly.
     */
    private const MONEY_COLUMNS = [
        'delivery_tiers' => [
            'fee' => ['from' => 10],
        ],
        'exchange_request_items' => [
            'subtotal' => ['from' => 12],
            'unit_price' => ['from' => 12],
        ],
        'exchange_requests' => [
            'exchange_value' => ['from' => 12, 'default' => '0.00'],
            'return_value' => ['from' => 12, 'default' => '0.00'],
        ],
        'offline_sales' => [
            'center_price' => ['from' => 12],
            'total_amount' => ['from' => 12],
        ],
        'order_items' => [
            'center_price_snapshot' => ['from' => 12, 'nullable' => true],
            'outlet_margin_snapshot' => ['from' => 12, 'nullable' => true],
            'price' => ['from' => 12],
            'selling_price_snapshot' => ['from' => 12, 'nullable' => true],
            'subtotal' => ['from' => 12],
        ],
        'orders' => [
            'absorbed_fee' => ['from' => 12, 'default' => '0.00'],
            'delivery_fee' => ['from' => 12, 'default' => '0.00'],
            'gateway_fee' => ['from' => 12, 'default' => '0.00'],
            'payment_fee' => ['from' => 12, 'default' => '0.00'],
            'refund_amount' => ['from' => 12, 'nullable' => true],
            'subtotal' => ['from' => 12, 'default' => '0.00'],
            'total' => ['from' => 12, 'default' => '0.00'],
        ],
        'outlet_product_prices' => [
            'selling_price' => ['from' => 12],
        ],
        'payment_attempts' => [
            'amount_snapshot' => ['from' => 12],
            'gateway_amount' => ['from' => 12, 'nullable' => true],
        ],
        'payment_transactions' => [
            'amount' => ['from' => 12],
        ],
        'pricing_audit_logs' => [
            'new_price' => ['from' => 12],
            'old_price' => ['from' => 12, 'nullable' => true],
        ],
        'products' => [
            'center_price' => ['from' => 12, 'default' => '0.00'],
            'selling_price' => ['from' => 12, 'default' => '0.00'],
        ],
        'refund_obligations' => [
            'amount' => ['from' => 12, 'unsigned' => true],
        ],
        'return_request_items' => [
            'subtotal' => ['from' => 12],
            'unit_price' => ['from' => 12],
        ],
        'return_requests' => [
            'total_value' => ['from' => 12, 'default' => '0.00'],
        ],
        'settlements' => [
            'delivery_fee_amount' => ['from' => 12, 'default' => '0.00'],
            'overpaid_amount' => ['from' => 12, 'default' => '0.00'],
        ],
    ];

    public function up(): void
    {
        foreach (self::MONEY_COLUMNS as $table => $columns) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            foreach ($columns as $column => $attributes) {
                if (! Schema::hasColumn($table, $column)) {
                    continue;
                }

                $this->resize($table, $column, self::TARGET_PRECISION, $attributes, unsigned: false);
            }
        }
    }

    public function down(): void
    {
        foreach (self::MONEY_COLUMNS as $table => $columns) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            foreach ($columns as $column => $attributes) {
                if (! Schema::hasColumn($table, $column)) {
                    continue;
                }

                $this->resize($table, $column, $attributes['from'], $attributes, unsigned: $attributes['unsigned'] ?? false);
            }
        }
    }

    private function resize(string $table, string $column, int $precision, array $attributes, bool $unsigned): void
    {
        Schema::table($table, function (Blueprint $blueprint) use ($column, $precision, $attributes, $unsigned): void {
            $definition = $blueprint->decimal($column, $precision, 2);

            if ($unsigned) {
                $definition->unsigned();
            }

            if ($attributes['nullable'] ?? false) {
                $definition->nullable();
            }

            if (array_key_exists('default', $attributes)) {
                $definition->default($attributes['default']);
            }

            $definition->change();
        });
    }
};
