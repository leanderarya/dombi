<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class SystemController extends Controller
{
    /**
     * Lightweight health check for load balancers and monitoring.
     */
    public function health(): JsonResponse
    {
        $checks = [
            'database' => $this->checkDatabase(),
            'cache' => $this->checkCache(),
        ];

        $healthy = ! in_array(false, $checks, true);

        return response()->json([
            'status' => $healthy ? 'healthy' : 'degraded',
            'checks' => $checks,
            'version' => config('app.version', '1.0.0'),
            'timestamp' => now()->toIso8601String(),
        ], $healthy ? 200 : 503);
    }

    /**
     * Detailed system status (owner-only).
     */
    public function status(Request $request): JsonResponse
    {
        return response()->json([
            'app' => [
                'name' => config('app.name'),
                'version' => config('app.version', '1.0.0'),
                'env' => config('app.env'),
                'debug' => config('app.debug'),
                'url' => config('app.url'),
            ],
            'php' => PHP_VERSION,
            'laravel' => app()->version(),
            'database' => [
                'connected' => $this->checkDatabase(),
                'driver' => config('database.default'),
            ],
            'cache' => [
                'connected' => $this->checkCache(),
                'driver' => config('cache.default'),
            ],
            'queue' => [
                'driver' => config('queue.default'),
            ],
            'storage' => [
                'writable' => is_writable(storage_path()),
            ],
        ]);
    }

    /**
     * Service worker version endpoint for PWA update detection.
     */
    public function version(): JsonResponse
    {
        return response()->json([
            'version' => config('app.version', '1.0.0'),
            'build' => filemtime(public_path('build/manifest.json')) ?: null,
        ]);
    }

    private function checkDatabase(): bool
    {
        try {
            DB::connection()->getPdo();

            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    private function checkCache(): bool
    {
        try {
            Cache::put('_health_check', true, 5);

            return Cache::get('_health_check') === true;
        } catch (\Throwable) {
            return false;
        }
    }
}
