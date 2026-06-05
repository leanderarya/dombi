<?php

namespace App\Http\Controllers;

use App\Support\SchedulerHeartbeat;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

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
            'storage' => $this->checkStorage(),
        ];

        // Scheduler is informational — unhealthy scheduler doesn't make the app "down"
        $checks['scheduler'] = $this->checkScheduler();

        $healthy = $checks['database'] && $checks['cache'] && $checks['storage'];

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
                'size' => $this->getQueueSize(),
            ],
            'scheduler' => [
                'healthy' => SchedulerHeartbeat::isHealthy(),
                'last_heartbeat' => SchedulerHeartbeat::getLastHeartbeat(),
                'minutes_since_last_beat' => SchedulerHeartbeat::minutesSinceLastBeat(),
            ],
            'storage' => [
                'writable' => is_writable(storage_path()),
                'disk_free_bytes' => disk_free_space(storage_path()),
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

    private function checkScheduler(): bool
    {
        return SchedulerHeartbeat::isHealthy();
    }

    private function checkStorage(): bool
    {
        try {
            $testFile = storage_path('app/.health_check_test');
            file_put_contents($testFile, 'ok');
            $result = file_get_contents($testFile) === 'ok';
            @unlink($testFile);

            return $result && is_writable(storage_path());
        } catch (\Throwable) {
            return false;
        }
    }

    private function getQueueSize(): ?int
    {
        try {
            return Queue::size();
        } catch (\Throwable) {
            return null;
        }
    }
}
