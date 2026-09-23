<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Each entry drops the 'redundant' index only when the 'covering' index is present,
     * so a database that already lost one of the pair keeps the surviving index.
     */
    private const REDUNDANT_INDEXES = [
        [
            'table' => 'orders',
            'redundant' => 'idx_orders_expire_pending',
            'covering' => 'orders_status_expires_at_index',
            'columns' => ['status', 'confirmation_expires_at'],
            'unique' => false,
        ],
        [
            'table' => 'products',
            'redundant' => 'product_variants_sku_index',
            'covering' => 'product_variants_sku_unique',
            'columns' => ['sku'],
            'unique' => false,
        ],
        [
            'table' => 'customers',
            'redundant' => 'customers_phone_index',
            'covering' => 'customers_phone_unique',
            'columns' => ['phone'],
            'unique' => false,
        ],
        [
            'table' => 'courier_invitations',
            'redundant' => 'courier_invitations_token_index',
            'covering' => 'courier_invitations_token_unique',
            'columns' => ['token'],
            'unique' => false,
        ],
        [
            'table' => 'payment_webhook_logs',
            'redundant' => 'payment_webhook_logs_request_id_index',
            'covering' => 'payment_webhook_logs_request_id_unique',
            'columns' => ['request_id'],
            'unique' => false,
        ],
        [
            'table' => 'favorites',
            'redundant' => 'favorites_customer_id_product_variant_id_unique',
            'covering' => 'favorites_customer_id_product_id_unique',
            'columns' => ['customer_id', 'product_id'],
            'unique' => true,
        ],
        [
            'table' => 'outlet_inventories',
            'redundant' => 'outlet_inventories_outlet_id_product_variant_id_unique',
            'covering' => 'outlet_inventories_outlet_id_product_id_unique',
            'columns' => ['outlet_id', 'product_id'],
            'unique' => true,
        ],
        [
            'table' => 'outlet_product_prices',
            'redundant' => 'outlet_variant_prices_outlet_id_product_variant_id_unique',
            'covering' => 'outlet_product_prices_outlet_id_product_id_unique',
            'columns' => ['outlet_id', 'product_id'],
            'unique' => true,
        ],
    ];

    public function up(): void
    {
        foreach (self::REDUNDANT_INDEXES as $index) {
            if (! $this->hasIndex($index['table'], $index['redundant']) || ! $this->hasIndex($index['table'], $index['covering'])) {
                continue;
            }

            Schema::table($index['table'], function (Blueprint $table) use ($index): void {
                $table->dropIndex($index['redundant']);
            });
        }
    }

    public function down(): void
    {
        foreach (self::REDUNDANT_INDEXES as $index) {
            if ($this->hasIndex($index['table'], $index['redundant']) || ! $this->hasIndex($index['table'], $index['covering'])) {
                continue;
            }

            Schema::table($index['table'], function (Blueprint $table) use ($index): void {
                if ($index['unique']) {
                    $table->unique($index['columns'], $index['redundant']);
                } else {
                    $table->index($index['columns'], $index['redundant']);
                }
            });
        }
    }

    private function hasIndex(string $table, string $name): bool
    {
        if (! Schema::hasTable($table)) {
            return false;
        }

        return collect(Schema::getIndexes($table))->contains(
            fn (array $index): bool => $index['name'] === $name
        );
    }
};
