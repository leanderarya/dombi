<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use App\Models\Delivery;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(): Response
    {
        $courierId = auth()->id();

        return Inertia::render('courier/dashboard', [
            'stats' => [
                'waitingPickup' => Delivery::where('courier_id', $courierId)->where('status', 'waiting_pickup')->count(),
                'pickedUp' => Delivery::where('courier_id', $courierId)->where('status', 'picked_up')->count(),
                'delivering' => Delivery::where('courier_id', $courierId)->where('status', 'delivering')->count(),
                'completedToday' => Delivery::where('courier_id', $courierId)->where('status', 'completed')->whereDate('updated_at', today())->count(),
                'failedToday' => Delivery::where('courier_id', $courierId)->where('status', 'failed')->whereDate('updated_at', today())->count(),
            ],
        ]);
    }
}
