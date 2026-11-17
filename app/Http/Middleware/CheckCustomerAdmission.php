<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Reversible admission gate for new customer checkout and payment initiation.
 *
 * Attached per-route only (see routes/web.php), never globally: DOKU callbacks
 * must keep working while admissions are held.
 *
 * Only an explicit active state allows new admissions. Missing or invalid
 * configuration keeps the gate closed.
 */
class CheckCustomerAdmission
{
    private const ACTIVE_STATES = ['active', 'open'];

    public static function held(): bool
    {
        $state = strtolower(trim((string) config('admission.customer_checkout', 'held')));

        return ! in_array($state, self::ACTIVE_STATES, true);
    }

    public function handle(Request $request, Closure $next): Response
    {
        if (! self::held()) {
            return $next($request);
        }

        $message = (string) config('admission.message');

        // Inertia visit: a 302 keeps the client inside its own protocol, where
        // the flash channel the layouts drain turns this into a toast.
        if ($request->header('X-Inertia')) {
            return back()->withErrors(['admission_held' => $message])->with('error', $message);
        }

        // Raw fetch/AJAX (checkout payment submit): actionable non-2xx JSON.
        if ($request->expectsJson()) {
            return response()->json([
                'error' => 'admission_held',
                'message' => $message,
            ], 503);
        }

        // Full page form post: 302 back with an error bag.
        return back()->withErrors(['admission_held' => $message])->with('error', $message);
    }
}
