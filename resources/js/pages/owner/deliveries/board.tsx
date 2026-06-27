import { router } from '@inertiajs/react';
import { useState } from 'react';
import AssignCourierSheet from '@/components/owner/assign-courier-sheet';
import CourierAvailabilityCard from '@/components/owner/courier-availability-card';
import DeliveryBoardColumn from '@/components/owner/delivery-board-column';
import DeliveryPerformanceCard from '@/components/owner/delivery-performance-card';
import FilterSheet from '@/components/owner/filter-sheet';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { usePolling } from '@/lib/use-polling';

export default function DeliveryBoard({ board, stats, couriers, filters, outlets }: any) {
    usePolling(20000);

    const [filterOpen, setFilterOpen] = useState(false);
    const [assignOpen, setAssignOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);

    const handleAssignCourier = (orderId: number) => {
        const order = board.unassigned.find((o: any) => o.id === orderId);

        if (order) {
            setSelectedOrder(order);
            setAssignOpen(true);
        }
    };

    const handleResolve = (deliveryId: number) => {
        router.get(`/owner/deliveries/${deliveryId}`);
    };

    const handleFilterApply = (f: Record<string, string>) => {
        router.get('/owner/deliveries/board', {
            outlet_id: f.outlet_id || undefined,
            courier_id: f.courier_id || undefined,
            date_range: f.date_range || 'today',
        }, { preserveState: true, replace: true });
    };

    const activeFilterCount = [filters.outlet_id, filters.courier_id].filter(Boolean).length + (filters.date_range === 'week' ? 1 : 0);

    const courierOptions = couriers.map((c: any) => ({ value: String(c.id), label: c.name }));
    const outletOptions = outlets.map((o: any) => ({ value: String(o.id), label: o.name }));
    const dateOptions = [
        { value: 'today', label: 'Hari Ini' },
        { value: 'week', label: 'Minggu Ini' },
    ];

    return (
        <OwnerPageShell
            title="Papan Pengiriman"
            subtitle={`${stats.unassigned + stats.assigned + stats.inTransit} pengiriman aktif`}
            headerRight={
                <button
                    onClick={() => setFilterOpen(true)}
                    className="relative flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-text-muted"
                >
                    <FilterIcon />
                    Filter
                    {activeFilterCount > 0 && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-white">
                            {activeFilterCount}
                        </span>
                    )}
                </button>
            }
        >
            {/* Performance KPIs */}
            <div className="grid grid-cols-3 gap-2">
                <DeliveryPerformanceCard label="Selesai" value={stats.completed} color="green" />
                <DeliveryPerformanceCard label="Gagal" value={stats.failed} color="red" href="/owner/deliveries?status=failed" />
                <DeliveryPerformanceCard label="Terlambat" value={stats.overdue} color="amber" />
            </div>

            {/* Courier Availability */}
            {couriers.length > 0 && (
                <div className="mt-4">
                    <CourierAvailabilityCard couriers={couriers} />
                </div>
            )}

            {/* Board Columns */}
            <div className="mt-4 grid grid-cols-5 gap-4">
                <DeliveryBoardColumn title="Menunggu Kurir" count={stats.unassigned} items={board.unassigned} color="slate" emptyMessage="Semua pesanan sudah di-assign" onAssignCourier={handleAssignCourier} />
                <DeliveryBoardColumn title="Ditugaskan" count={stats.assigned} items={board.assigned} color="blue" emptyMessage="Tidak ada kurir menunggu pickup" />
                <DeliveryBoardColumn title="Dalam Perjalanan" count={stats.inTransit} items={board.inTransit} color="purple" emptyMessage="Tidak ada pengiriman dalam perjalanan" />
                <DeliveryBoardColumn title="Perlu Tindakan" count={stats.needsAction} items={board.needsAction} color="amber" emptyMessage="Tidak ada pengiriman bermasalah" onResolve={handleResolve} />
                <DeliveryBoardColumn title="Selesai" count={stats.completed} items={board.completed} color="green" emptyMessage="Belum ada pengiriman selesai hari ini" />
            </div>

            {/* Assign Courier Sheet */}
            {selectedOrder && (
                <AssignCourierSheet order={selectedOrder} couriers={couriers} open={assignOpen} onClose={() => {
 setAssignOpen(false); setSelectedOrder(null); 
}} />
            )}

            {/* Filter Sheet */}
            <FilterSheet
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                sections={[
                    { key: 'outlet_id', label: 'Outlet', options: outletOptions, value: filters.outlet_id ? String(filters.outlet_id) : '' },
                    { key: 'courier_id', label: 'Kurir', options: courierOptions, value: filters.courier_id ? String(filters.courier_id) : '' },
                    { key: 'date_range', label: 'Periode', options: dateOptions, value: filters.date_range ?? 'today' },
                ]}
                onApply={handleFilterApply}
            />
        </OwnerPageShell>
    );
}

function FilterIcon() {
    return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>;
}
