<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    public function handle(Request $request, Closure $next, string $role): Response
    {
        $user = $request->user();

        if (! $user || ! $user->is_active) {
            abort(403);
        }

        if ($user->role !== $role) {
            return redirect()->to(match ($user->role) {
                'owner' => '/owner/dashboard',
                'outlet' => '/outlet/dashboard',
                'courier' => '/courier/dashboard',
                default => '/customer/home',
            });
        }

        return $next($request);
    }
}
