<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
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

        return Inertia::render('customer/home', [
            'customerName' => $user?->customer?->name ?? $user?->name ?? null,
            'activeOrders' => collect(),
            'lastOrder' => null,
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
