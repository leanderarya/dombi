# Phase 7: Courier Routing - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add route optimization for courier deliveries

**Architecture:** New RoutingService + enhanced delivery UI with maps

**Tech Stack:** Laravel 13, PHP 8.3, React 19, Inertia.js, Leaflet (maps)

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `app/Services/RoutingService.php` | Create | Route optimization logic |
| `app/Http/Controllers/Courier/DeliveryController.php` | Modify | Add optimized route endpoint |
| `resources/js/pages/courier/deliveries/index.tsx` | Modify | Add route optimization UI |
| `routes/web.php` | Modify | Add route |

---

### Task 1: Route Optimization

**Files:**
- Create: `app/Services/RoutingService.php`
- Modify: `app/Http/Controllers/Courier/DeliveryController.php`
- Modify: `resources/js/pages/courier/deliveries/index.tsx`
- Modify: `routes/web.php`

- [ ] **Step 1: Create RoutingService**

```php
<?php

namespace App\Services;

use App\Models\Delivery;
use App\Models\Order;

class RoutingService
{
    /**
     * Calculate optimized route for multiple deliveries.
     * Uses nearest-neighbor algorithm for simplicity.
     */
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
            // Find nearest unvisited delivery
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

    /**
     * Calculate distance between two points using Haversine formula.
     * Returns distance in kilometers.
     */
    public function calculateDistance(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371; // km

        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLng / 2) * sin($dLng / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c;
    }

    /**
     * Get route summary with total distance and estimated time.
     */
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

        // Estimate: 30 km/h average speed in city
        $estimatedMinutes = ($totalDistance / 30) * 60;

        return [
            'total_distance_km' => round($totalDistance, 2),
            'estimated_minutes' => (int) ceil($estimatedMinutes),
            'stops' => count($route),
        ];
    }
}
```

- [ ] **Step 2: Add optimized route endpoint to DeliveryController**

```php
use App\Services\RoutingService;

public function getOptimizedRoute(Request $request, RoutingService $routingService): JsonResponse
{
    $user = $request->user();

    abort_unless($user->role === 'courier', 403);

    // Get active deliveries for this courier
    $deliveries = Delivery::where('courier_id', $user->id)
        ->whereIn('status', ['waiting_pickup', 'picked_up'])
        ->with('order')
        ->get();

    if ($deliveries->isEmpty()) {
        return response()->json([
            'route' => [],
            'summary' => ['total_distance_km' => 0, 'estimated_minutes' => 0, 'stops' => 0],
        ]);
    }

    // Calculate courier's current position (use first delivery or default)
    $startLat = $deliveries->first()->order->latitude ?? -7.0568;
    $startLng = $deliveries->first()->order->longitude ?? 110.4381;

    // Calculate optimized route
    $optimizedRoute = $routingService->calculateOptimizedRoute($deliveries->all(), $startLat, $startLng);
    $summary = $routingService->getRouteSummary($optimizedRoute, $startLat, $startLng);

    return response()->json([
        'route' => collect($optimizedRoute)->map(fn ($d) => [
            'id' => $d->id,
            'order_code' => $d->order->order_code,
            'customer_name' => $d->order->customer_name,
            'address' => $d->order->customer_address,
            'latitude' => $d->order->latitude,
            'longitude' => $d->order->longitude,
            'status' => $d->status,
        ]),
        'summary' => $summary,
    ]);
}
```

- [ ] **Step 3: Add route**

```php
// Courier optimized route
Route::get('/courier/deliveries/optimized-route', [CourierDeliveryController::class, 'getOptimizedRoute'])
    ->name('courier.deliveries.optimized-route');
```

- [ ] **Step 4: Update frontend to show optimized route**

Add to `resources/js/pages/courier/deliveries/index.tsx`:

```tsx
const [optimizedRoute, setOptimizedRoute] = useState<any[]>([]);
const [routeSummary, setRouteSummary] = useState<any>(null);
const [loadingRoute, setLoadingRoute] = useState(false);

const fetchOptimizedRoute = async () => {
    setLoadingRoute(true);
    try {
        const response = await fetch('/courier/deliveries/optimized-route');
        const data = await response.json();
        setOptimizedRoute(data.route);
        setRouteSummary(data.summary);
    } catch (error) {
        console.error('Failed to fetch optimized route:', error);
    } finally {
        setLoadingRoute(false);
    }
};

// Add button and route display in the UI
```

- [ ] **Step 5: Test**

Run: `php artisan test --filter=Routing`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/Services/RoutingService.php app/Http/Controllers/Courier/DeliveryController.php resources/js/pages/courier/deliveries/index.tsx routes/web.php
git commit -m "feat: add courier route optimization with nearest-neighbor algorithm"
```

---

## Verification

After completing all tasks:

1. Run full test suite: `php artisan test`
2. Run linter: `./vendor/bin/pint --test`
3. Build frontend: `npm run build`
4. Test route optimization manually
5. Verify maps display

## Summary

| Task | Description | Est. |
|------|-------------|------|
| 1. Route Optimization | Nearest-neighbor algorithm + maps | 3d |
| **Total** | | **3d** |
