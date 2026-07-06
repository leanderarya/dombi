<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $activeOrders = collect();
        $lastOrder = null;

        if ($user && $user->customer) {
            $customerId = $user->customer->id;

            $activeOrders = Order::where('customer_id', $customerId)
                ->whereIn('status', Order::ACTIVE_STATUSES)
                ->whereNotIn('payment_status', ['expired', 'failed'])
                ->where(function ($q) {
                    $q->where('status', '!=', Order::STATUS_PENDING_CONFIRMATION)
                        ->orWhereNull('confirmation_expires_at')
                        ->orWhere('confirmation_expires_at', '>', now());
                })
                ->with(['outlet:id,name', 'delivery', 'items.variant.family'])
                ->latest()
                ->limit(5)
                ->get();

            $lastOrder = Order::where('customer_id', $customerId)
                ->where('status', 'completed')
                ->with(['outlet:id,name', 'items.variant.family'])
                ->latest()
                ->first();
        }

        return Inertia::render('customer/home', [
            'customerName' => $user?->customer?->name ?? $user?->name ?? null,
            'activeOrders' => $activeOrders,
            'lastOrder' => $lastOrder,
        ]);
    }

    public function setFulfillmentDraft(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'fulfillment_type' => ['required', Rule::in(['pickup', 'delivery_dombi'])],
        ]);

        $request->session()->put('checkout.fulfillment', [
            'fulfillment_type' => $validated['fulfillment_type'],
        ]);

        return redirect()->route('customer.products.index');
    }
}
