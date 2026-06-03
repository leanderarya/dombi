<?php

namespace App\Services;

class DeliveryPricingService
{
    public function __construct(
        private readonly OutletAssignmentService $outletAssignmentService,
    ) {}

    public function quote(float $customerLatitude, float $customerLongitude, float $outletLatitude, float $outletLongitude): array
    {
        $distanceKm = round($this->outletAssignmentService->calculateDistance(
            $customerLatitude,
            $customerLongitude,
            $outletLatitude,
            $outletLongitude
        ), 2);

        foreach (config('delivery.tiers', []) as $tier) {
            if ($distanceKm <= (float) $tier['max_km']) {
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
}
