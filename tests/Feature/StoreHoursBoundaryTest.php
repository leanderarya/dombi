<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\OutletOperatingHours;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * The edge of the operating-hours window.
 *
 * close_time is set through an H:i form, so an outlet that stays open until
 * midnight stores 23:59. The column is a time and reads back as 23:59:00, and
 * the clock being compared carries seconds — "23:59:30" sorts after
 * "23:59:00", so the outlet called itself closed for the last minute of every
 * day. The CI run that surfaced this reached its checkout tests at 23:59:10
 * WIB and failed 27 of them with "Toko sedang tutup".
 */
class StoreHoursBoundaryTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @param  string  $open  H:i:s as the column returns it
     * @param  string  $close  H:i:s as the column returns it
     */
    private function outletTradingOn(Carbon $moment, string $open, string $close, bool $isClosed = false): Outlet
    {
        $outlet = Outlet::factory()->create(['status' => 'active']);

        OutletOperatingHours::factory()->create([
            'outlet_id' => $outlet->id,
            'day_of_week' => (int) $moment->format('w'),
            'open_time' => $open,
            'close_time' => $close,
            'is_closed' => $isClosed,
        ]);

        return $outlet;
    }

    private function at(string $moment): Carbon
    {
        $instant = Carbon::parse($moment, 'Asia/Jakarta');
        $this->travelTo($instant);

        return $instant;
    }

    /** An outlet open until midnight is open through the whole 23:59 minute. */
    public function test_an_outlet_open_until_midnight_is_open_during_the_last_minute(): void
    {
        $outlet = $this->outletTradingOn(
            $this->at('2026-09-30 23:59:30'),
            '00:00:00',
            '23:59:00',
        );

        $this->assertTrue($outlet->isOpen());
    }

    /** The closing minute itself still counts as open — the window is inclusive. */
    public function test_the_closing_minute_is_still_open(): void
    {
        $outlet = $this->outletTradingOn(
            $this->at('2026-09-30 20:00:30'),
            '08:00:00',
            '20:00:00',
        );

        $this->assertTrue($outlet->isOpen());
    }

    /** Past the window the outlet is shut, and the fix must not blur that. */
    public function test_an_outlet_is_closed_past_its_closing_time(): void
    {
        $outlet = $this->outletTradingOn(
            $this->at('2026-09-30 20:30:00'),
            '08:00:00',
            '20:00:00',
        );

        $this->assertFalse($outlet->isOpen());
    }

    /** Before opening it is shut too. */
    public function test_an_outlet_is_closed_before_its_opening_time(): void
    {
        $outlet = $this->outletTradingOn(
            $this->at('2026-09-30 07:30:00'),
            '08:00:00',
            '20:00:00',
        );

        $this->assertFalse($outlet->isOpen());
    }

    /** A day flagged closed stays closed regardless of the clock. */
    public function test_a_closed_day_is_not_open(): void
    {
        $outlet = $this->outletTradingOn(
            $this->at('2026-09-30 12:00:00'),
            '08:00:00',
            '20:00:00',
            isClosed: true,
        );

        $this->assertFalse($outlet->isOpen());
    }

    /**
     * The shape CI failed in: a real request through the store.open guard,
     * with the clock inside the last minute of the outlet's day.
     */
    public function test_cart_mutation_is_allowed_during_the_closing_minute(): void
    {
        $outlet = $this->outletTradingOn(
            $this->at('2026-09-30 23:59:10'),
            '00:00:00',
            '23:59:00',
        );

        $product = Product::factory()->create();
        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'current_stock' => 10,
            'reserved_stock' => 0,
            'minimum_stock' => 1,
        ]);

        session(['checkout.fulfillment.selected_outlet_id' => $outlet->id]);

        $this->post('/customer/cart/add', [
            'product_id' => $product->id,
            'quantity' => 1,
        ])->assertSessionHasNoErrors();
    }
}
