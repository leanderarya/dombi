<?php

namespace App\Http\Middleware;

use App\Models\ExchangeRequest;
use App\Models\ReturnRequest;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'appVersion' => config('app.version', '1.0.0'),
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'must_change_password' => $user->must_change_password,
                    'is_active' => $user->is_active,
                ] : null,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'outlet_provisioning' => fn () => $request->session()->get('outlet_provisioning'),
            ],
            'guestMode' => fn () => session('guest_mode', false),
            'dev' => [
                'isLocal' => app()->isLocal(),
                'env' => config('app.env'),
                'currentRole' => $user?->role ?? 'guest',
            ],
            'ownerOperationalCounts' => function () use ($user) {
                if (! $user || $user->role !== 'owner') {
                    return null;
                }

                return [
                    'pendingReturns' => ReturnRequest::where('status', ReturnRequest::STATUS_SUBMITTED)->count(),
                    'pendingExchanges' => ExchangeRequest::where('status', ExchangeRequest::STATUS_SUBMITTED)->count(),
                ];
            },
        ];
    }
}
