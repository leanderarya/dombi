<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __invoke(): Response
    {
        $customerId = auth()->id();

        return Inertia::render('customer/home', [
            'products' => Product::where('is_active', true)->latest()->limit(6)->get(),
            'activeOrders' => Order::where('customer_id', $customerId)
                ->whereIn('status', Order::ACTIVE_STATUSES)
                ->with(['outlet:id,name', 'delivery:id,order_id,status,courier_id', 'delivery.courier:id,name'])
                ->latest()
                ->limit(3)
                ->get(),
            'lastOrder' => Order::where('customer_id', $customerId)
                ->whereIn('status', Order::HISTORY_STATUSES)
                ->with('items')
                ->latest()
                ->first(),
        ]);
    }
}
