<?php

namespace App\Services;

use App\Models\Order;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

class CourierRevenueService
{
    /**
     * Aggregate courier revenue for all outlets within a period.
     */
    public function revenue(string $period): array
    {
        [$from, $to] = $this->window($period);

        $rows = $this->baseQuery($from, $to)
            ->join('outlets', 'orders.outlet_id', '=', 'outlets.id')
            ->selectRaw('
                orders.outlet_id,
                outlets.name as outlet_name,
                COUNT(*) as deliveries,
                SUM(orders.delivery_fee) as delivery_fee,
                SUM(CASE WHEN deliveries.courier_type = ? THEN deliveries.courier_cost ELSE 0 END) as external_cost
            ', ['eksternal'])
            ->groupBy('orders.outlet_id', 'outlets.name')
            ->get();

        $outlets = $rows->map(fn ($row) => [
            'outlet' => ['id' => (int) $row->outlet_id, 'name' => $row->outlet_name],
            'deliveries' => (int) $row->deliveries,
            'delivery_fee' => (float) $row->delivery_fee,
            'external_cost' => (float) $row->external_cost,
            'net' => (float) $row->delivery_fee - (float) $row->external_cost,
        ])->sortBy(fn ($row) => $row['outlet']['name'])->values();

        $summary = [
            'total_deliveries' => (int) $rows->sum('deliveries'),
            'delivery_fee' => (float) $rows->sum('delivery_fee'),
            'external_cost' => (float) $rows->sum('external_cost'),
            'net' => (float) $rows->sum('delivery_fee') - (float) $rows->sum('external_cost'),
        ];

        return [
            'summary' => $summary,
            'outlets' => $outlets,
        ];
    }

    /**
     * Aggregate courier revenue for a single outlet within a period.
     */
    public function outletDetail(int $outletId, string $period): array
    {
        [$from, $to] = $this->window($period);

        $row = $this->baseQuery($from, $to)
            ->where('orders.outlet_id', $outletId)
            ->selectRaw('
                COUNT(*) as deliveries,
                SUM(orders.delivery_fee) as delivery_fee,
                SUM(CASE WHEN deliveries.courier_type = ? THEN deliveries.courier_cost ELSE 0 END) as external_cost
            ', ['eksternal'])
            ->first();

        return [
            'deliveries' => (int) ($row->deliveries ?? 0),
            'delivery_fee' => (float) ($row->delivery_fee ?? 0),
            'external_cost' => (float) ($row->external_cost ?? 0),
            'net' => (float) ($row->delivery_fee ?? 0) - (float) ($row->external_cost ?? 0),
        ];
    }

    private function baseQuery(?CarbonInterface $from, ?CarbonInterface $to)
    {
        return DB::table('deliveries')
            ->join('orders', 'deliveries.order_id', '=', 'orders.id')
            ->where('orders.status', Order::STATUS_COMPLETED)
            ->where('deliveries.status', 'completed')
            ->when($from, fn ($q) => $q->where('orders.created_at', '>=', $from))
            ->when($to, fn ($q) => $q->where('orders.created_at', '<', $to));
    }

    /**
     * @return array{0: CarbonInterface, 1: CarbonInterface}
     */
    private function window(string $period): array
    {
        return match ($period) {
            'harian' => [today(), today()->addDay()],
            'mingguan' => [now()->startOfWeek(), now()->startOfWeek()->addWeek()],
            'bulanan' => [now()->startOfMonth(), now()->startOfMonth()->addMonth()],
            default => throw new \InvalidArgumentException("Periode tidak dikenal: {$period}"),
        };
    }
}
