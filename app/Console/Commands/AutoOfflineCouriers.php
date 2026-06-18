<?php

namespace App\Console\Commands;

use App\Models\Delivery;
use App\Models\User;
use App\Support\OperationalLog;
use Illuminate\Console\Command;

class AutoOfflineCouriers extends Command
{
    protected $signature = 'couriers:auto-offline';

    protected $description = 'Automatically offline couriers with no activity for configured hours and no active deliveries';

    public function handle(): int
    {
        $hours = config('delivery.auto_offline.hours', 4);
        $threshold = now()->subHours($hours);

        $activeDeliveryCourierIds = Delivery::whereIn('status', ['waiting_pickup', 'picked_up', 'delivering'])
            ->pluck('courier_id')
            ->unique();

        $couriers = User::where('role', 'courier')
            ->where('is_online', true)
            ->where(function ($query) use ($threshold) {
                $query->where('last_activity_at', '<', $threshold)
                    ->orWhereNull('last_activity_at');
            })
            ->whereNotIn('id', $activeDeliveryCourierIds)
            ->get();

        $offlined = 0;

        foreach ($couriers as $courier) {
            $courier->goOffline();

            OperationalLog::operationalError('Courier auto-offlined due to inactivity', [
                'courier_id' => $courier->id,
                'courier_name' => $courier->name,
                'last_activity' => $courier->last_activity_at?->toISOString(),
                'hours_inactive' => $hours,
            ]);

            $offlined++;
        }

        $this->info("Auto-offlined {$offlined} couriers.");

        return self::SUCCESS;
    }
}
