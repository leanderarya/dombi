<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    public function index(): Response
    {
        $families = ProductFamily::query()
            ->where('is_active', true)
            ->with(['variants' => fn ($q) => $q->where('is_active', true)->orderBy('name')])
            ->orderBy('name')
            ->get();

        return Inertia::render('customer/products', [
            'families' => $families,
        ]);
    }

    public function show(ProductFamily $family): Response
    {
        $family->load(['variants' => fn ($q) => $q->where('is_active', true)->orderBy('name')]);

        return Inertia::render('customer/product-detail', [
            'family' => $family,
        ]);
    }
}
