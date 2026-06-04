import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import AssignCourierSheet from '@/components/owner/assign-courier-sheet';
import DeliverySlaBadge from '@/components/owner/delivery-sla-badge';
import DeliveryStatusBadge from '@/components/delivery-status-badge';
import FilterSheet from '@/components/owner/filter-sheet';
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
        <OutletLayout>
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold sm:text-2xl">Deliveries</h1>
                    <p className="text-sm text-zinc-500">{outlet.name}</p>
                </div>
                <button onClick={() => setFilterOpen(true)} className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200">
                    <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                    {activeFilterCount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-0.5 text-[9px] font-bold text-white">
                            {activeFilterCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Stats */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Perlu Dikirim" value={stats.needsDispatch} color="amber" urgent={stats.needsDispatch > 0} />
                <StatCard label="Menunggu Pickup" value={stats.waitingPickup} color="blue" />
                <StatCard label="Dalam Perjalanan" value={stats.inTransit} color="purple" />
                <StatCard label="Gagal" value={stats.failed} color="red" urgent={stats.failed > 0} />
            </div>

            {/* Unassigned Orders */}
            {unassignedOrders.length > 0 && (
                <section className="mt-5">
                    <h2 className="text-sm font-semibold text-amber-800">Perlu Assign Kurir</h2>
                    <div className="mt-2 space-y-2">
                        {unassignedOrders.map((order: any) => (
                            <div key={order.id} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
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
                                    className="mt-2 flex min-h-[36px] w-full items-center justify-center rounded-md bg-emerald-700 text-xs font-semibold text-white active:bg-emerald-800"
                                >
                                    Assign Kurir
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Delivery List */}
            <section className="mt-5">
                <h2 className="text-sm font-semibold text-slate-700">Riwayat Delivery</h2>
                {deliveries.data.length === 0 ? (
                    <div className="mt-3 rounded-lg border border-dashed border-slate-200 p-8 text-center">
                        <span className="text-3xl">📦</span>
                        <p className="mt-2 text-sm text-slate-500">Belum ada delivery</p>
                    </div>
                ) : (
                    <div className="mt-2 space-y-2">
                        {deliveries.data.map((d: any) => (
                            <Link
                                key={d.id}
                                href={`/outlet/deliveries/${d.id}`}
                                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 active:bg-slate-50"
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
            </section>

            {/* Assign Courier Sheet */}
            {selectedOrder && (
                <AssignCourierSheet
                    order={selectedOrder}
                    couriers={couriers}
                    open={assignOpen}
                    onClose={() => { setAssignOpen(false); setSelectedOrder(null); }}
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

function StatCard({ label, value, color, urgent }: { label: string; value: number; color: string; urgent?: boolean }) {
    const colorClasses: Record<string, string> = {
        amber: 'border-amber-100 bg-amber-50',
        blue: 'border-blue-100 bg-blue-50',
        purple: 'border-purple-100 bg-purple-50',
        red: 'border-red-100 bg-red-50',
    };
    const base = colorClasses[color] ?? 'border-zinc-100 bg-white';

    return (
        <div className={`rounded-xl border p-3 ${base} ${urgent ? 'ring-2 ring-amber-300' : ''}`}>
            <div className="text-xs font-medium text-slate-500">{label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
        </div>
    );
}
