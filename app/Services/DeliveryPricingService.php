<?php

namespace App\Services;

use App\Models\DeliveryTier;
use App\Services\Concerns\CalculatesDistance;
use Illuminate\Support\Facades\Cache;

class DeliveryPricingService
{
    use CalculatesDistance;

    public function __construct(
        private readonly OutletAssignmentService $outletAssignmentService,
    ) {}

    public function quote(float $customerLat, float $customerLng, float $outletLat, float $outletLng): array
    {
        $distanceKm = round($this->calculateDistance(
            $customerLat, $customerLng, $outletLat, $outletLng
        ), 2);

        $tiers = $this->loadTiers();

        foreach ($tiers as $tier) {
            if ($distanceKm >= $tier['min_km'] && $distanceKm <= $tier['max_km']) {
                return [
                    'distance_km' => $distanceKm,
                    'delivery_fee' => (float) $tier['fee'],
                    'is_serviceable' => true,
                ];
            }
        }

        return [
            'distance_km' => $distanceKm,
            'delivery_fee' => 0.0,
            'is_serviceable' => false,
        ];
    }

    /**
     * Load tiers from cache, fallback to config.
     */
    private function loadTiers(): array
    {
        $tiers = Cache::remember(
            DeliveryTier::PRICING_CACHE_KEY,
            now()->addDay(),
            fn (): array => DeliveryTier::active()->get()->map(fn (DeliveryTier $t) => [
                'min_km' => (float) $t->min_km,
                'max_km' => (float) $t->max_km,
                'fee' => (float) $t->fee,
            ])->all(),
        );

        if ($tiers !== []) {
            return $tiers;
        }

        return array_map(fn (array $tier) => [
            'min_km' => (float) ($tier['min_km'] ?? 0),
            'max_km' => (float) $tier['max_km'],
            'fee' => (float) $tier['fee'],
        ], config('delivery.tiers', []));
    }
}
