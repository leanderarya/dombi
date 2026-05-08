<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\CustomerAddress;
use App\Models\Product;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('customer/products', [
            'products' => Product::where('is_active', true)->latest()->paginate(12),
        ]);
    }

    public function checkout(): Response
    {
        return Inertia::render('customer/checkout', [
            'products' => Product::where('is_active', true)->orderBy('name')->get(),
            'addresses' => CustomerAddress::where('user_id', auth()->id())->latest()->get(),
        ]);
    }
}
