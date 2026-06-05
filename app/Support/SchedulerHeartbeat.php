<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

class SchedulerHeartbeat
{
    private const CACHE_KEY = 'scheduler:last_heartbeat';
    private const STALE_THRESHOLD_MINUTES = 5;

    public static function record(): void
    {
        Cache::forever(self::CACHE_KEY, now()->toISOString());
    }

    public static function getLastHeartbeat(): ?string
    {
        return Cache::get(self::CACHE_KEY);
    }

    public static function isHealthy(): bool
    {
        $lastHeartbeat = Cache::get(self::CACHE_KEY);

        if (! $lastHeartbeat) {
            return false;
        }

        return now()->diffInMinutes(\Carbon\Carbon::parse($lastHeartbeat)) < self::STALE_THRESHOLD_MINUTES;
    }

    public static function minutesSinceLastBeat(): ?int
    {
        $lastHeartbeat = Cache::get(self::CACHE_KEY);

        if (! $lastHeartbeat) {
            return null;
        }

        return now()->diffInMinutes(\Carbon\Carbon::parse($lastHeartbeat));
    }
}
