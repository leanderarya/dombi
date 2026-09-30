<?php

use App\Models\Order;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Close deliveries left open on orders that already died.
     *
     * OrderStatusService now releases the delivery row as part of the
     * cancellation, but rows created before that change are still sitting in
     * waiting_pickup with a courier attached. On the courier's screen they read
     * as a live task, and confirming pickup walks straight into the order's
     * transition guard, which throws InvalidOrderTransitionException — a 500,
     * because nothing catches it.
     */
    private const DEAD_ORDER_STATUSES = [
        Order::STATUS_CANCELLED_BY_OUTLET,
        Order::STATUS_CANCELLED_BY_CUSTOMER,
        Order::STATUS_REJECTED_BY_OUTLET,
        Order::STATUS_EXPIRED,
    ];

    private const OPEN_DELIVERY_STATUSES = [
        'waiting_assignment',
        'waiting_pickup',
        'picked_up',
        'delivering',
    ];

    public function up(): void
    {
        $now = now();

        $ghosts = DB::table('deliveries')
            ->join('orders', 'orders.id', '=', 'deliveries.order_id')
            ->whereIn('orders.status', self::DEAD_ORDER_STATUSES)
            ->whereIn('deliveries.status', self::OPEN_DELIVERY_STATUSES)
            ->select('deliveries.id', 'deliveries.status', 'orders.status as order_status')
            ->get();

        foreach ($ghosts as $ghost) {
            DB::table('deliveries')
                ->where('id', $ghost->id)
                ->update(['status' => 'cancelled_and_released', 'updated_at' => $now]);

            DB::table('delivery_status_histories')->insert([
                'delivery_id' => $ghost->id,
                'from_status' => $ghost->status,
                'to_status' => 'cancelled_and_released',
                'changed_by_type' => 'system',
                'changed_by_id' => null,
                'reason' => $ghost->order_status,
                'notes' => 'Perbaikan data: pesanan sudah tidak aktif, tugas pengiriman dilepas.',
                'created_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        // One-way repair — the previous status of each row is not worth
        // reconstructing, and restoring a ghost would restore the 500.
    }
};
