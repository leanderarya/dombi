<?php

namespace App\Http\Middleware;

use Carbon\Carbon;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AllowCustomerOrRecoveredGuest
{
    private const RECOVERY_SESSION_TTL_HOURS = 24;

    /**
     * Allow access if:
     * - User is authenticated with 'customer' role, OR
     * - Session has valid guest_recovery data (from phone-based order recovery)
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // Authenticated customer — always allowed
        if ($user && $user->is_active && $user->role === 'customer') {
            return $next($request);
        }

        // Recovered guest — allowed if session has valid recovery data
        if (! $user && $this->hasValidRecoverySession($request)) {
            return $next($request);
        }

        // Not authenticated and not recovered — redirect to login
        if (! $user) {
            return redirect()->route('login');
        }

        // Authenticated but wrong role
        return redirect()->to(match ($user->role) {
            'owner' => '/owner/dashboard',
            'outlet' => '/outlet/dashboard',
            'courier' => '/courier/dashboard',
            default => '/customer/home',
        });
    }

    private function hasValidRecoverySession(Request $request): bool
    {
        $recovery = $request->session()->get('guest_recovery');

        if (! is_array($recovery)) {
            return false;
        }

        if (empty($recovery['customer_id']) || empty($recovery['order_ids']) || empty($recovery['recovery_verified_at'])) {
            return false;
        }

        // Check TTL
        $verifiedAt = Carbon::parse($recovery['recovery_verified_at']);
        if ($verifiedAt->addHours(self::RECOVERY_SESSION_TTL_HOURS)->isPast()) {
            $request->session()->forget('guest_recovery');

            return false;
        }

        return true;
    }
}
