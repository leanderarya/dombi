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
            'recentOrders' => Order::where('customer_id', auth()->id())->with('outlet')->latest()->limit(5)->get(),
        ]);
    }
}
