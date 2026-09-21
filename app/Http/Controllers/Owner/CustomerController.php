<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CustomerController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));

        $customers = Customer::query()
            ->withCount('orders')
            ->withSum('orders as total_spend', 'total')
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%");
                });
            })
            ->latest()
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('owner/customers/index', [
            'customers' => $customers,
            'filters' => ['search' => $search],
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
