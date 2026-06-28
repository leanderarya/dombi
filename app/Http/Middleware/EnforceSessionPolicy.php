<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnforceSessionPolicy
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = Auth::user();

        // Guest / unauthenticated — pass through entirely
        if (! $user) {
            return $next($request);
        }

        $now = now()->timestamp;
        $policy = $this->policyFor($user->role);

        // Initialize timestamps on first hit (safe default — no mass logout)
        if (! $request->session()->has('login_at')) {
            $request->session()->put('login_at', $now);
        }
        if (! $request->session()->has('last_activity_at')) {
            $request->session()->put('last_activity_at', $now);
        }

        $loginAt = (int) $request->session()->get('login_at');
        $lastActivityAt = (int) $request->session()->get('last_activity_at');

        // 1. Absolute timeout (operational only)
        if ($policy['absolute_minutes'] !== null) {
            $absoluteSeconds = $policy['absolute_minutes'] * 60;
            if (($now - $loginAt) > $absoluteSeconds) {
                return $this->forceLogout($request, $user->role);
            }
        }

        // 2. Idle timeout (rolling)
        $idleSeconds = $policy['idle_minutes'] * 60;
        if (($now - $lastActivityAt) > $idleSeconds) {
            return $this->forceLogout($request, $user->role);
        }

        // 3. Touch last_activity_at
        $request->session()->put('last_activity_at', $now);

        return $next($request);
    }

    private function policyFor(string $role): array
    {
        $policies = config('auth.session_policy', []);

        if ($role === 'customer') {
            return $policies['customer'] ?? [
                'idle_minutes' => 43200,
                'absolute_minutes' => null,
            ];
        }

        // owner, outlet, courier → operational policy
        return $policies['operational'] ?? [
            'idle_minutes' => 480,
            'absolute_minutes' => 10080,
        ];
    }

    private function forceLogout(Request $request, string $role): Response
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        if ($role === 'customer') {
            return redirect('/')->with('error', 'Sesi Anda telah berakhir. Silakan masuk kembali.');
        }

        return redirect()->route('login')->with('error', 'Sesi Anda telah berakhir. Silakan login kembali.');
    }
}
