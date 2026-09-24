<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class DashboardRedirectController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $role = $request->user()?->role;

        $target = match ($role) {
            'owner' => '/owner/dashboard',
            'outlet' => '/outlet/dashboard',
            'courier' => '/courier/dashboard',
            default => '/customer/home',
        };

        // This route is served by the internal app root. The customer home page
        // belongs to the customer root, whose pages the internal app cannot
        // resolve on a client-side visit — an Inertia visit would throw
        // "Page not found: customer/home" and leave the browser on /login.
        // Inertia::location hands off with a full page load instead.
        if ($role === 'customer') {
            return Inertia::location($target);
        }

        return redirect()->to($target);
    }
}
