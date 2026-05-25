<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\CustomerAddress;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function index(): Response
    {
        $customer = auth()->user();

        return Inertia::render('customer/profile', [
            'defaultAddress' => CustomerAddress::where('user_id', $customer->id)
                ->where('is_default', true)
                ->first(),
        ]);
    }
}
