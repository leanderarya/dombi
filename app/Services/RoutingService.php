<?php

namespace App\Services;

class RoutingService
{
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

    public function calculateDistance(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371;

        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLng / 2) * sin($dLng / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c;
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
