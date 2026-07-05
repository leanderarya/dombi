<?php

namespace App\Providers;

use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureRateLimiting();
    }

    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }

    protected function configureRateLimiting(): void
    {
        // Login: 5 attempts per minute per IP
        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip());
        });

        // Checkout/order creation: 3 per minute per user
        RateLimiter::for('checkout', function (Request $request) {
            return Limit::perMinute(3)->by($request->user()?->id ?: $request->ip());
        });

        // Stock adjustment: 10 per minute per user
        RateLimiter::for('stock-adjustment', function (Request $request) {
            return Limit::perMinute(10)->by($request->user()?->id ?: $request->ip());
        });

        // Export: 5 per minute per user
        RateLimiter::for('export', function (Request $request) {
            return Limit::perMinute(5)->by($request->user()?->id ?: $request->ip());
        });

        // Sensitive actions (resolve delivery, approve restock): 10 per minute
        RateLimiter::for('sensitive', function (Request $request) {
            return Limit::perMinute(10)->by($request->user()?->id ?: $request->ip());
        });

        // Recovery: 5 per minute per IP (prevent phone enumeration)
        RateLimiter::for('recovery', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip());
        });

        // Customer lookup: 10 per minute per IP
        RateLimiter::for('lookup', function (Request $request) {
            return Limit::perMinute(10)->by($request->ip());
        });

        // Payment submit: 3 per minute per user/IP (prevent double-tap)
        RateLimiter::for('payment-submit', function (Request $request) {
            return Limit::perMinute(3)->by($request->user()?->id ?: $request->ip());
        });

        // Pay (Snap token retry): 5 per minute per user/IP (allow retry after Snap close/error)
        RateLimiter::for('pay-token', function (Request $request) {
            return Limit::perMinute(5)->by($request->user()?->id ?: $request->ip());
        });

        // Tracking: 30 per minute per IP (prevent abuse of public tracking endpoint)
        RateLimiter::for('track', function (Request $request) {
            return Limit::perMinute(30)->by($request->ip());
        });

        // Track cancel: 5 per minute per IP (prevent brute force last4 HP)
        RateLimiter::for('track-cancel', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip());
        });

        // Order report: 5 per minute per user
        RateLimiter::for('order-report', function (Request $request) {
            return Limit::perMinute(5)->by($request->user()?->id ?: $request->ip());
        });
    }
}
