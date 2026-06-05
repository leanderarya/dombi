<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    public function index(): RedirectResponse
    {
        return redirect()->route('owner.product-families.index');
    }

    public function create(): RedirectResponse
    {
        return redirect()->route('owner.product-families.index');
    }

    public function edit(): RedirectResponse
    {
        return redirect()->route('owner.product-families.index');
    }
}
