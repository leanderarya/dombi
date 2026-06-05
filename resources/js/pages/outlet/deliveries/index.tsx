import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { Truck } from 'lucide-react';
import AssignCourierSheet from '@/components/operations/assign-courier-sheet';
import DeliverySlaBadge from '@/components/operations/delivery-sla-badge';
import DeliveryStatusBadge from '@/components/delivery-status-badge';
import FilterSheet from '@/components/operations/filter-sheet';
import EmptyState from '@/components/ui/empty-state';
import SectionCard from '@/components/ui/section-card';
import StatusBadge from '@/components/ui/status-badge';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency, formatDeliveryAge, formatDistance } from '@/lib/format';
import { usePolling } from '@/lib/use-polling';

const statusOptions = [
    { value: 'waiting_pickup', label: 'Menunggu Pickup' },
    { value: 'picked_up', label: 'Picked Up' },
    { value: 'delivering', label: 'Dalam Perjalanan' },
    { value: 'completed', label: 'Selesai' },
    { value: 'failed', label: 'Gagal' },
];

export default function OutletDeliveriesIndex({ outlet, unassignedOrders, deliveries, stats, filters }: any) {
    usePolling(20000);
    const [filterOpen, setFilterOpen] = useState(false);
    const [assignOpen, setAssignOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [couriers, setCouriers] = useState<any[]>([]);

    const handleAssignCourier = async (orderId: number) => {
        const order = unassignedOrders.find((o: any) => o.id === orderId);
        if (order) {
            const res = await fetch(`/outlet/orders/${orderId}`, { headers: { 'X-Inertia': 'true' } });
            const data = await res.json();
            setCouriers(data.props?.couriers ?? []);
            setSelectedOrder(order);
            setAssignOpen(true);
        }
    };

    const handleFilterApply = (f: Record<string, string>) => {
        router.get('/outlet/deliveries', { status: f.status || undefined }, { preserveState: true, replace: true });
    };

    const activeFilterCount = filters.status ? 1 : 0;

    return (
        <OutletLayout title="Pengiriman" subtitle={outlet.name}>
            {/* Stats */}
            <div className="mb-4 grid grid-cols-2 gap-2">
                <StatCard label="Perlu Dikirim" value={stats.needsDispatch} alert={stats.needsDispatch > 0} />
                <StatCard label="Menunggu Pickup" value={stats.waitingPickup} />
                <StatCard label="Dalam Perjalanan" value={stats.inTransit} />
                <StatCard label="Gagal" value={stats.failed} alert={stats.failed > 0} />
            </div>

            {/* Unassigned Orders */}
            {unassignedOrders.length > 0 && (
                <SectionCard label="Perlu Assign Kurir" className="mb-4">
                    <div className="mt-2 space-y-2">
                        {unassignedOrders.map((order: any) => (
                            <div key={order.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-bold tabular-nums text-slate-900">{order.order_code}</div>
                                        <div className="mt-0.5 text-xs text-slate-500">{order.customer_name}</div>
                                        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                                            {order.distance_km != null && <span>{formatDistance(order.distance_km)}</span>}
                                            <span>{formatCurrency(order.total)}</span>
                                            <span className={`font-medium ${order.delivery_age > 30 ? 'text-red-600' : 'text-slate-500'}`}>
                                                {formatDeliveryAge(order.delivery_age)}
                                            </span>
                                        </div>
                                    </div>
                                    {order.sla_health && <DeliverySlaBadge health={order.sla_health} />}
                                </div>
                                <button
                                    onClick={() => handleAssignCourier(order.id)}
                                    className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 text-sm font-semibold text-white active:bg-emerald-800"
                                >
                                    <Truck className="h-4 w-4" />
                                    Assign Kurir
                                </button>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Delivery List */}
            <SectionCard label="Riwayat Pengiriman" className="mb-4">
                {deliveries.data.length === 0 ? (
                    <EmptyState
                        icon="📦"
                        title="Belum ada pengiriman"
                        description="Pengiriman akan muncul setelah kurir di-assign."
                    />
                ) : (
                    <div className="mt-2 space-y-2">
                        {deliveries.data.map((d: any) => (
                            <Link
                                key={d.id}
                                href={`/outlet/deliveries/${d.id}`}
                                className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-white p-3 active:bg-zinc-50"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold tabular-nums text-slate-900">{d.order_code}</span>
                                        {d.sla_health && <DeliverySlaBadge health={d.sla_health} />}
                                    </div>
                                    <div className="mt-0.5 text-xs text-slate-500">
                                        {d.customer_name} {d.courier ? `· ${d.courier.name}` : ''}
                                    </div>
                                    <div className="mt-1 text-[11px] tabular-nums text-slate-400">
                                        {d.delivery_age != null && (
                                            <span className={d.delivery_age > 60 ? 'text-red-600 font-medium' : ''}>
                                                {formatDeliveryAge(d.delivery_age)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <DeliveryStatusBadge status={d.status} />
                            </Link>
                        ))}
                    </div>
                )}
            </SectionCard>

            {/* Assign Courier Sheet */}
            {selectedOrder && (
                <AssignCourierSheet
                    order={selectedOrder}
                    couriers={couriers}
                    open={assignOpen}
                    onClose={() => { setAssignOpen(false); setSelectedOrder(null); }}
                    assignUrl={`/outlet/orders/${selectedOrder.id}/assign-courier`}
                />
            )}

            {/* Filter Sheet */}
            <FilterSheet
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                sections={[
                    { key: 'status', label: 'Status', options: statusOptions, value: filters.status ?? '' },
                ]}
                onApply={handleFilterApply}
            />
        </OutletLayout>
    );
}

function StatCard({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
    return (
        <div className={`rounded-lg border p-2.5 ${alert ? 'border-amber-200' : 'border-zinc-200'} bg-white`}>
            <div className="text-xs font-medium text-slate-500">{label}</div>
            <div className="mt-0.5 flex items-center gap-1.5">
                <span className="text-xl font-bold text-slate-900">{value}</span>
                {alert && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
            </div>
        </div>
    );
}
