<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AllowGuestOrCustomer
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || $user->isCustomer()) {
            return $next($request);
        }

        return redirect(match ($user->role) {
            'owner' => '/owner/dashboard',
            'outlet' => '/outlet/dashboard',
            'courier' => '/courier/dashboard',
            default => '/dashboard',
        });
    }
}
