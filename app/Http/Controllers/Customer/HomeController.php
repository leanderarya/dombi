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
        return Inertia::render('customer/home', [
            'products' => Product::where('is_active', true)->latest()->limit(6)->get(),
            'activeOrder' => Order::where('customer_id', auth()->id())
                ->whereIn('status', ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering'])
                ->with('outlet')
                ->latest()
                ->first(),
            'recentOrders' => Order::where('customer_id', auth()->id())->with('outlet')->latest()->limit(5)->get(),
            'lastOrder' => Order::where('customer_id', auth()->id())->with('items')->latest()->first(),
        ]);
    }
}
