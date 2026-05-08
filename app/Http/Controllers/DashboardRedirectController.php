<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class DashboardRedirectController extends Controller
{
    public function __invoke(Request $request): RedirectResponse
    {
        return redirect()->to(match ($request->user()?->role) {
            'owner' => '/owner/dashboard',
            'outlet' => '/outlet/dashboard',
            'courier' => '/courier/dashboard',
            default => '/customer/home',
        });
    }
}
