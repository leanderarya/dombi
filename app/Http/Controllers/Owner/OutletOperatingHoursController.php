<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Outlet;
use App\Models\OutletOperatingHours;
use App\Services\OutletAuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OutletOperatingHoursController extends Controller
{
    /**
     * Get all operating hours for an outlet.
     */
    public function index(Outlet $outlet): JsonResponse
    {
        $hours = $outlet->operatingHours()->orderBy('day_of_week')->get();

        return response()->json($hours);
    }

    /**
     * Bulk update operating hours for an outlet.
     */
    public function bulkUpdate(Request $request, Outlet $outlet, OutletAuditService $auditService): JsonResponse
    {
        $validated = $request->validate([
            'hours' => ['required', 'array', 'size:7'],
            'hours.*.day_of_week' => ['required', 'integer', 'between:0,6'],
            'hours.*.open_time' => ['required', 'date_format:H:i'],
            'hours.*.close_time' => ['required', 'date_format:H:i'],
            'hours.*.is_closed' => ['boolean'],
        ]);

        $oldHours = $outlet->operatingHours()->get()->keyBy('day_of_week')->toArray();

        foreach ($validated['hours'] as $dayData) {
            $dayOfWeek = (int) $dayData['day_of_week'];
            $isClosed = (bool) ($dayData['is_closed'] ?? false);

            if (! $isClosed && $dayData['open_time'] >= $dayData['close_time']) {
                return response()->json([
                    'error' => "Jam buka harus lebih kecil dari jam tutup untuk hari {$dayOfWeek}.",
                ], 422);
            }

            OutletOperatingHours::updateOrCreate(
                ['outlet_id' => $outlet->id, 'day_of_week' => $dayOfWeek],
                [
                    'open_time' => $isClosed ? '08:00' : $dayData['open_time'],
                    'close_time' => $isClosed ? '17:00' : $dayData['close_time'],
                    'is_closed' => $isClosed,
                ],
            );
        }

        $newHours = $outlet->operatingHours()->orderBy('day_of_week')->get()->toArray();
        $auditService->log($outlet, 'operational_hours', json_encode($oldHours), json_encode($newHours), $request->user());

        return response()->json(['success' => true]);
    }
}
