<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\ProductFamily;
use App\Services\DeliveryPricingService;
use App\Services\OutletAssignmentService;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __construct(
        private readonly OutletAssignmentService $outletAssignmentService,
        private readonly DeliveryPricingService $deliveryPricingService,
    ) {}

    public function __invoke(): Response
    {
        $sessionLocation = request()->session()->get('checkout.location');
        $latitude = isset($sessionLocation['latitude']) ? (float) $sessionLocation['latitude'] : null;
        $longitude = isset($sessionLocation['longitude']) ? (float) $sessionLocation['longitude'] : null;
        $serviceStatus = null;

        if ($latitude !== null && $longitude !== null) {
            $nearestOutlet = $this->outletAssignmentService->findAvailableOutlet($latitude, $longitude, []);

            if ($nearestOutlet && $nearestOutlet->latitude !== null && $nearestOutlet->longitude !== null) {
                $quote = $this->deliveryPricingService->quote($latitude, $longitude, (float) $nearestOutlet->latitude, (float) $nearestOutlet->longitude);
                $serviceStatus = [
                    'is_serviceable' => $quote['is_serviceable'],
                    'outlet_name' => $nearestOutlet->name,
                    'distance_km' => $quote['distance_km'],
                    'delivery_fee' => $quote['delivery_fee'],
                ];
            }
        }

        $families = ProductFamily::query()
            ->where('is_active', true)
            ->with(['variants' => fn ($q) => $q->where('is_active', true)])
            ->orderBy('name')
            ->limit(6)
            ->get();

        return Inertia::render('customer/home', [
            'families' => $families,
            'activeOrders' => collect(),
            'lastOrder' => null,
            'serviceStatus' => $serviceStatus,
        ]);
    }
}
