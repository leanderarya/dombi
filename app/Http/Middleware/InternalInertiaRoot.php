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
                'user' => $request->user()?->only('id', 'name', 'email', 'role'),
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'outlet_provisioning' => fn () => $request->session()->get('outlet_provisioning'),
            ],
        ]);
    }
}
