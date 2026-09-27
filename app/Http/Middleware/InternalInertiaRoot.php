<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class InternalInertiaRoot extends Middleware
{
    protected $rootView = 'internal-app';

    public function share(Request $request): array
    {
        return array_merge(parent::share($request), [
            'auth' => [
                'user' => $request->user() ? [
                    ...$request->user()->only('id', 'name', 'email', 'role'),
                    // The courier layout uses this to decide whether to report a
                    // location, and for its online label.
                    'is_online' => (bool) $request->user()->is_online,
                ] : null,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'outlet_provisioning' => fn () => $request->session()->get('outlet_provisioning'),
            ],
        ]);
    }
}
