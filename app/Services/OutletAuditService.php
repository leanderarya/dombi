<?php

namespace App\Services;

use App\Models\Outlet;
use App\Models\OutletAuditLog;
use App\Models\User;

class OutletAuditService
{
    /**
     * Log a single field change on an outlet.
     */
    public function log(Outlet $outlet, string $field, mixed $oldValue, mixed $newValue, User $user): void
    {
        if ($oldValue === $newValue) {
            return;
        }

        OutletAuditLog::create([
            'outlet_id' => $outlet->id,
            'field' => $field,
            'old_value' => $oldValue !== null ? (string) $oldValue : null,
            'new_value' => $newValue !== null ? (string) $newValue : null,
            'changed_by' => $user->id,
        ]);
    }

    /**
     * Diff two arrays and log all changes.
     */
    public function logChanges(Outlet $outlet, array $oldData, array $newData, User $user): void
    {
        $trackedFields = [
            'name', 'phone', 'address', 'kelurahan', 'kecamatan', 'city',
            'province', 'postal_code', 'latitude', 'longitude',
            'operational_notes', 'delivery_radius_km', 'prep_estimate_minutes',
            'status', 'pic_name', 'pic_phone', 'pic_position',
        ];

        foreach ($trackedFields as $field) {
            $old = $oldData[$field] ?? null;
            $new = $newData[$field] ?? null;

            // Normalize for comparison
            $oldNorm = $old !== null ? (string) $old : null;
            $newNorm = $new !== null ? (string) $new : null;

            if ($oldNorm !== $newNorm) {
                $this->log($outlet, $field, $old, $new, $user);
            }
        }
    }
}
