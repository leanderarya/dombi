<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\Product;
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
        $customer = auth()->user();
        $customerId = $customer?->isCustomer() ? $customer->id : null;
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

        return Inertia::render('customer/home', [
            'products' => Product::where('is_active', true)->latest()->limit(6)->get(),
            'activeOrders' => $customerId
                ? Order::where('customer_id', $customerId)
                    ->whereIn('status', Order::ACTIVE_STATUSES)
                    ->with(['outlet:id,name', 'delivery:id,order_id,status,courier_id', 'delivery.courier:id,name'])
                    ->latest()
                    ->limit(3)
                    ->get()
                : collect(),
            'lastOrder' => $customerId
                ? Order::where('customer_id', $customerId)
                    ->whereIn('status', Order::HISTORY_STATUSES)
                    ->with('items')
                    ->latest()
                    ->first()
                : null,
            'serviceStatus' => $serviceStatus,
        ]);
    }
}
