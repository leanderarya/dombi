<?php

use App\Exceptions\RegisteredPhoneException;
use App\Http\Middleware\AllowCustomerOrRecoveredGuest;
use App\Http\Middleware\AllowGuestOrCustomer;
use App\Http\Middleware\CustomerInertiaRoot;
use App\Http\Middleware\DevOnly;
use App\Http\Middleware\EnforceSessionPolicy;
use App\Http\Middleware\EnsurePasswordIsChanged;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\InternalInertiaRoot;
use App\Http\Middleware\RoleMiddleware;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        // Exclude guest cancel route and DOKU webhook from CSRF verification
        $middleware->validateCsrfTokens(except: [
            'track/*/cancel',
            'payment/doku/notify',
            'oauth/exchange-token',
            'api/auth/google-token',
        ]);

        $middleware->alias([
            'customer.inertia' => CustomerInertiaRoot::class,
            'internal.inertia' => InternalInertiaRoot::class,
            'guest.or.customer' => AllowGuestOrCustomer::class,
            'customer.or.recovered' => AllowCustomerOrRecoveredGuest::class,
            'role' => RoleMiddleware::class,
            'password.changed' => EnsurePasswordIsChanged::class,
            'enforce.session' => EnforceSessionPolicy::class,
            'dev' => DevOnly::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->renderable(function (RegisteredPhoneException $e, $request) {
            if ($request->expectsJson() || $request->header('X-Inertia')) {
                return back()->withErrors([
                    'phone_number' => $e->getMessage(),
                ])->withInput();
            }

            return back()->withErrors([
                'phone_number' => $e->getMessage(),
            ])->withInput();
        });

        $exceptions->reportable(function (Throwable $e) {
            if (app()->bound('sentry')) {
                app('sentry')->captureException($e);
            }
        });
    })->create();
