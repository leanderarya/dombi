<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;

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
