<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Outlet;
use App\Models\Settlement;
use App\Models\SettlementPayment;
use App\Services\SettlementReconciliationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SettlementReconciliationBulkTest extends TestCase
{
    use RefreshDatabase;

    /**
     * getOutletReconciliations() is the bulk path and getOutletReconciliation()
     * is the single-outlet reference. They must keep returning the same values.
     */
    public function test_bulk_reconciliation_matches_the_per_outlet_result(): void
    {
        $outlets = $this->seedOutlets();
        $service = app(SettlementReconciliationService::class);

        $bulk = $service->getOutletReconciliations($outlets->pluck('id')->all());

        foreach ($outlets as $outlet) {
            $this->assertEquals(
                $service->getOutletReconciliation($outlet->id),
                $bulk[$outlet->id],
                "Bulk reconciliation differs from the per-outlet result for outlet {$outlet->id}."
            );
        }
    }

    public function test_collection_center_query_count_does_not_grow_with_outlets(): void
    {
        $service = app(SettlementReconciliationService::class);

        $this->seedOutlets(1);
        $few = $this->countQueries(fn () => $service->getCollectionCenter());

        $this->seedOutlets(5);
        $many = $this->countQueries(fn () => $service->getCollectionCenter());

        $this->assertSame($few, $many, 'Collection center must not run reconciliation queries per outlet.');
    }

    public function test_collection_center_priority_and_margin_match_direct_computation(): void
    {
        $outlets = $this->seedOutlets();
        $service = app(SettlementReconciliationService::class);
        $collection = $service->getCollectionCenter();

        $expectedPriority = [];
        foreach ($outlets as $outlet) {
            if ($service->getOutletReconciliation($outlet->id)['outstanding'] <= 0) {
                continue;
            }

            $oldest = Settlement::query()
                ->where('outlet_id', $outlet->id)
                ->where('status', '!=', Settlement::STATUS_PAID)
                ->where('amount_due', '>', 0)
                ->orderBy('due_date', 'asc')
                ->first();

            $expectedPriority[$outlet->id] = $oldest
                ? max(0, (int) $oldest->due_date->diffInDays(now(), false))
                : 0;
        }

        $this->assertEquals(
            $expectedPriority,
            collect($collection['priority_list'])->pluck('days_overdue', 'outlet.id')->all()
        );

        $expectedMargin = $outlets->map(function (Outlet $outlet): array {
            $rows = Settlement::where('outlet_id', $outlet->id)->get();
            $gross = (float) $rows->sum('sales_amount');

            return [
                'id' => $outlet->id,
                'margin' => $gross - (float) $rows->sum('amount_due'),
                'gross' => $gross,
            ];
        })->sortByDesc('margin')->take(5)->values()->all();

        $this->assertEquals(
            $expectedMargin,
            collect($collection['rankings']['by_margin'])
                ->map(fn (array $row): array => [
                    'id' => $row['outlet']['id'],
                    'margin' => $row['outlet_margin'],
                    'gross' => $row['gross_revenue'],
                ])
                ->all()
        );
    }

    public function test_hero_totals_are_summed_across_outlets(): void
    {
        $outlets = $this->seedOutlets();
        $service = app(SettlementReconciliationService::class);

        $reconciliations = $service->getOutletReconciliations($outlets->pluck('id')->all());
        $hero = $service->getCollectionCenter()['hero'];

        $this->assertSame(
            array_sum(array_column($reconciliations, 'outstanding')),
            $hero['total_outstanding']
        );
        $this->assertSame(
            array_sum(array_column($reconciliations, 'verified_payments')),
            $hero['total_collected']
        );
        $this->assertSame(
            array_sum(array_column($reconciliations, 'pending_payments')),
            $hero['total_pending']
        );
        $this->assertSame(
            count(array_filter($reconciliations, fn (array $row): bool => $row['outstanding'] > 0)),
            $hero['outlets_overdue']
        );
    }

    public function test_payments_sharing_a_date_resolve_to_the_latest_recorded_one(): void
    {
        $outlet = Outlet::factory()->create();

        SettlementPayment::factory()->create([
            'outlet_id' => $outlet->id, 'status' => SettlementPayment::STATUS_VERIFIED,
            'amount' => 1000, 'payment_date' => '2026-02-01', 'reference_number' => 'FIRST',
        ]);
        SettlementPayment::factory()->create([
            'outlet_id' => $outlet->id, 'status' => SettlementPayment::STATUS_VERIFIED,
            'amount' => 2000, 'payment_date' => '2026-02-01', 'reference_number' => 'SECOND',
        ]);

        $reconciliation = app(SettlementReconciliationService::class)
            ->getOutletReconciliations([$outlet->id])[$outlet->id];

        $this->assertSame('SECOND', $reconciliation['last_payment']['reference']);
    }

    public function test_an_outlet_without_history_reports_zeroes(): void
    {
        $outlet = Outlet::factory()->create();

        $reconciliation = app(SettlementReconciliationService::class)
            ->getOutletReconciliations([$outlet->id])[$outlet->id];

        $this->assertSame(0.0, $reconciliation['center_share']);
        $this->assertSame(0.0, $reconciliation['verified_payments']);
        $this->assertEquals(0.0, $reconciliation['outstanding']);
        $this->assertNull($reconciliation['last_payment']);
        $this->assertSame(
            ['online_outlet_share' => 0.0, 'delivery_cost' => 0.0, 'refund' => 0.0, 'offline_sales' => 0.0],
            $reconciliation['breakdown']
        );
    }

    public function test_monthly_settlements_count_towards_margin_but_not_towards_center_share(): void
    {
        $outlet = Outlet::factory()->create();

        Settlement::factory()->create([
            'outlet_id' => $outlet->id, 'period_type' => 'weekly', 'period_date' => '2026-03-01',
            'period_start' => '2026-02-23', 'period_end' => '2026-03-01', 'status' => 'pending',
            'sales_amount' => 10000, 'amount_due' => 4000, 'due_date' => '2026-03-08',
        ]);
        Settlement::factory()->create([
            'outlet_id' => $outlet->id, 'period_type' => 'daily', 'period_date' => '2026-03-02',
            'period_start' => '2026-03-02', 'period_end' => '2026-03-02', 'status' => 'pending',
            'sales_amount' => 5000, 'amount_due' => 1000, 'due_date' => '2026-03-09',
        ]);

        $service = app(SettlementReconciliationService::class);
        $reconciliation = $service->getOutletReconciliations([$outlet->id])[$outlet->id];

        $this->assertSame(4000.0, $reconciliation['center_share']);
        $this->assertSame(10000.0, $reconciliation['sales_amount']);

        $margin = collect($service->getCollectionCenter()['rankings']['by_margin'])
            ->firstWhere('outlet.id', $outlet->id);

        $this->assertSame(15000.0, $margin['gross_revenue']);
        $this->assertSame(10000.0, $margin['outlet_margin']);
    }

    private function seedOutlets(int $extra = 0): Collection
    {
        $rich = Outlet::factory()->create(['name' => 'Rich Outlet']);

        Settlement::factory()->create([
            'outlet_id' => $rich->id, 'period_date' => '2026-01-04', 'period_start' => '2025-12-29',
            'period_end' => '2026-01-04', 'period_type' => 'weekly', 'status' => 'pending',
            'sales_amount' => 100000, 'delivery_fee_amount' => 5000, 'adjustment_amount' => -2000,
            'total_online_share' => 30000, 'total_delivery_cost' => 4000, 'total_refund' => 1500,
            'total_offline_sales' => 2500, 'net_amount' => 90000, 'amount_due' => 88000,
            'due_date' => '2026-01-11',
        ]);
        Settlement::factory()->create([
            'outlet_id' => $rich->id, 'period_date' => '2026-01-11', 'period_start' => '2026-01-05',
            'period_end' => '2026-01-11', 'period_type' => 'weekly', 'status' => 'paid',
            'sales_amount' => 50000, 'delivery_fee_amount' => 1000, 'adjustment_amount' => 500,
            'total_online_share' => 15000, 'total_delivery_cost' => 900, 'total_refund' => 0,
            'total_offline_sales' => 0, 'net_amount' => 40000, 'amount_due' => 40000,
            'due_date' => '2026-01-18',
        ]);

        foreach ([
            ['verified', 25000, '2026-01-20', 'A'],
            ['verified', 10000, '2026-01-21', 'B'],
            ['pending_verification', 7000, '2026-01-25', 'C'],
            ['rejected', 3000, '2026-01-26', 'D'],
        ] as [$status, $amount, $date, $suffix]) {
            SettlementPayment::factory()->create([
                'outlet_id' => $rich->id, 'status' => $status, 'amount' => $amount,
                'payment_date' => $date, 'reference_number' => "PAY-{$rich->id}-{$suffix}",
            ]);
        }

        foreach (['dombi' => [6000, 0], 'eksternal' => [9000, 5500]] as $courierType => [$fee, $cost]) {
            $order = Order::factory()->create([
                'outlet_id' => $rich->id, 'status' => Order::STATUS_COMPLETED,
                'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI, 'delivery_fee' => $fee,
                'payment_status' => 'paid',
            ]);

            DB::table('deliveries')->insert([
                'order_id' => $order->id, 'courier_type' => $courierType,
                'status' => 'completed', 'courier_cost' => $cost,
            ]);
        }

        $outlets = collect([$rich]);
        for ($i = 0; $i < $extra; $i++) {
            $outlets->push(Outlet::factory()->create());
        }

        return $outlets->sortBy('id')->values();
    }

    private function countQueries(callable $callback): int
    {
        DB::flushQueryLog();
        DB::enableQueryLog();

        try {
            $callback();
        } finally {
            $count = count(DB::getQueryLog());
            DB::disableQueryLog();
            DB::flushQueryLog();
        }

        return $count;
    }
}
