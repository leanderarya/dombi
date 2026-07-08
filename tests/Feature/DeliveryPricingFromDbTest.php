<?php

namespace Tests\Feature;

use App\Models\DeliveryTier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeliveryPricingFromDbTest extends TestCase
{
    use RefreshDatabase;

    public function test_pricing_service_uses_db_tiers_over_config(): void
    {
        DeliveryTier::create(['min_km' => 0, 'max_km' => 5, 'fee' => 7777, 'sort_order' => 1]);
        DeliveryTier::create(['min_km' => 5, 'max_km' => 15, 'fee' => 9999, 'sort_order' => 2]);

        $service = app(\App\Services\DeliveryPricingService::class);

        $quote = $service->quote(-7.05, 110.43, -7.051, 110.431);

        $this->assertEquals(7777, $quote['delivery_fee']);
        $this->assertTrue($quote['is_serviceable']);
    }

    public function test_pricing_service_falls_back_to_config_when_no_db_tiers(): void
    {
        $service = app(\App\Services\DeliveryPricingService::class);

        $quote = $service->quote(-7.05, 110.43, -7.051, 110.431);

        $this->assertEquals(5000, $quote['delivery_fee']);
    }
}
