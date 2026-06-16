<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Outlet;
use App\Models\OutletHoliday;
use App\Services\OutletAuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class OutletHolidayController extends Controller
{
    public function store(Request $request, Outlet $outlet, OutletAuditService $auditService): JsonResponse
    {
        $validated = $request->validate([
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $holiday = $outlet->holidays()->create($validated);

        $auditService->log($outlet, 'holiday_added', null, "{$validated['start_date']} - {$validated['end_date']}".($validated['reason'] ? " ({$validated['reason']})" : ''), $request->user());

        return response()->json(['success' => true, 'holiday' => $holiday]);
    }

    public function update(Request $request, Outlet $outlet, OutletHoliday $holiday, OutletAuditService $auditService): JsonResponse
    {
        if ($holiday->outlet_id !== $outlet->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $oldValue = "{$holiday->start_date} - {$holiday->end_date}";
        $holiday->update($validated);
        $newValue = "{$validated['start_date']} - {$validated['end_date']}";

        $auditService->log($outlet, 'holiday_updated', $oldValue, $newValue, $request->user());

        return response()->json(['success' => true, 'holiday' => $holiday]);
    }

    public function destroy(Request $request, Outlet $outlet, OutletHoliday $holiday, OutletAuditService $auditService): RedirectResponse
    {
        if ($holiday->outlet_id !== $outlet->id) {
            abort(403);
        }

        $oldValue = "{$holiday->start_date} - {$holiday->end_date}";
        $holiday->delete();

        $auditService->log($outlet, 'holiday_removed', $oldValue, null, $request->user());

        return redirect()->route('owner.outlets.show', $outlet)->with('success', 'Hari libur berhasil dihapus.');
    }
}
