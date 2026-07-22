<?php

namespace Tests;

use App\Models\Outlet;
use App\Models\OutletOperatingHours;

trait WithTestOutlet
{
    protected function withOutletSession(): Outlet
    {
        $outlet = Outlet::factory()->create(['status' => 'active']);

        OutletOperatingHours::factory()->create([
            'outlet_id' => $outlet->id,
            'day_of_week' => (int) now('Asia/Jakarta')->format('w'),
            'open_time' => '00:00',
            'close_time' => '23:59',
            'is_closed' => false,
        ]);

        session(['checkout.fulfillment.selected_outlet_id' => $outlet->id]);

        return $outlet;
    }
}