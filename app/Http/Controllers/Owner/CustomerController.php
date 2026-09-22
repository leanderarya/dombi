<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Order;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CustomerController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));

        // Only non-expired orders count as transactions here, matching show().
        // last_order_at is likewise recomputed from those orders so the list's
        // "Terakhir Belanja" agrees with the detail page's stats.last_order_at
        // instead of the raw Customer.last_order_at stamped at order creation.
        $notExpired = fn ($q) => $q->where('status', '!=', Order::STATUS_EXPIRED);

        $customers = Customer::query()
            ->withCount(['orders as orders_count' => $notExpired])
            ->withSum(['orders as total_spend' => $notExpired], 'total')
            ->withMax(['orders as last_order_at' => $notExpired], 'created_at')
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
        $orders = $customer->orders()
            ->where('status', '!=', Order::STATUS_EXPIRED)
            ->with('outlet')
            ->latest()
            ->get();

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
