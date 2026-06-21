<?php

namespace App\Services;

use App\Services\Concerns\CalculatesDistance;

class RoutingService
{
    use CalculatesDistance;

    public function calculateOptimizedRoute(array $deliveries, float $startLat, float $startLng): array
    {
        if (count($deliveries) <= 1) {
            return $deliveries;
        }

        $unvisited = collect($deliveries);
        $route = [];
        $currentLat = $startLat;
        $currentLng = $startLng;

        while ($unvisited->isNotEmpty()) {
            $nearest = null;
            $minDistance = PHP_FLOAT_MAX;

            foreach ($unvisited as $delivery) {
                $distance = $this->calculateDistance(
                    $currentLat,
                    $currentLng,
                    $delivery->order->latitude,
                    $delivery->order->longitude
                );

                if ($distance < $minDistance) {
                    $minDistance = $distance;
                    $nearest = $delivery;
                }
            }

            if ($nearest) {
                $route[] = $nearest;
                $currentLat = $nearest->order->latitude;
                $currentLng = $nearest->order->longitude;
                $unvisited = $unvisited->filter(fn ($d) => $d->id !== $nearest->id)->values();
            }
        }

        return $route;
    }

    public function getRouteSummary(array $route, float $startLat, float $startLng): array
    {
        $totalDistance = 0;
        $currentLat = $startLat;
        $currentLng = $startLng;

        foreach ($route as $delivery) {
            $distance = $this->calculateDistance(
                $currentLat,
                $currentLng,
                $delivery->order->latitude,
                $delivery->order->longitude
            );
            $totalDistance += $distance;
            $currentLat = $delivery->order->latitude;
            $currentLng = $delivery->order->longitude;
        }

        $estimatedMinutes = ($totalDistance / 30) * 60;

        return [
            'total_distance_km' => round($totalDistance, 2),
            'estimated_minutes' => (int) ceil($estimatedMinutes),
            'stops' => count($route),
        ];
    }
}
