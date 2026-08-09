<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Inertia\Inertia;
use Inertia\Response;

class CustomerController extends Controller
{
    public function index(): Response
    {
        $customers = Customer::query()
            ->withCount('orders')
            ->withSum('orders', 'total')
            ->latest()
            ->paginate(15);

        return Inertia::render('owner/customers/index', [
            'customers' => $customers,
        ]);
    }

    public function show(Customer $customer): Response
    {
        $orders = $customer->orders()->with('outlet')->latest()->get();

        $stats = [
            'total_orders' => $orders->count(),
            'total_spend' => (float) $orders->sum('total'),
            'avg_order' => $orders->count() ? (float) $orders->avg('total') : 0,
            'last_order_at' => $orders->first()?->created_at,
        ];

        return Inertia::render('owner/customers/show', [
            'customer' => $customer,
            'orders' => $orders,
            'stats' => $stats,
        ]);
    }
}