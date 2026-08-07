import { Head, Link, router } from '@inertiajs/react';
import { Package, Truck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import AssignCourierSheet from '@/components/operations/assign-courier-sheet';
import { createAssignCourierSheetLifecycle } from '@/components/operations/assign-courier-sheet-lifecycle';
import DeliverySlaBadge from '@/components/operations/delivery-sla-badge';
import OutletPageShell from '@/components/outlet/outlet-page-shell';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import FilterChips from '@/components/ui/filter-chips';
import SectionCard from '@/components/ui/section-card';
import { Skeleton, SkeletonList } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { useInertiaLoading } from '@/hooks/use-inertia-loading';
import OutletLayout from '@/layouts/outlet-layout';
import {
    formatCurrency,
    formatDeliveryAge,
    formatDistance,
} from '@/lib/format';
import { usePolling } from '@/lib/use-polling';
import { runAssignCourierLookup } from './assign-courier-request';

const statusOptions = [
    { key: 'waiting_pickup', label: 'Menunggu Pickup' },
    { key: 'picked_up', label: 'Picked Up' },
    { key: 'delivering', label: 'Dalam Perjalanan' },
    { key: 'completed', label: 'Selesai' },
    { key: 'failed', label: 'Gagal' },
];

export default function OutletDeliveriesIndex({
    outlet,
    unassignedOrders,
    deliveries,
    stats,
    filters,
}: any) {
    usePolling(20000);
    const { loading } = useInertiaLoading();
    const [assignOpen, setAssignOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [couriers, setCouriers] = useState<any[]>([]);
    const courierRequestLifecycleRef = useRef(
        createAssignCourierSheetLifecycle(),
    );

    useEffect(() => {
        const lifecycle = courierRequestLifecycleRef.current;

        return () => lifecycle.close();
    }, []);

    const handleAssignCourier = async (orderId: number) => {
        const order = unassignedOrders.find((o: any) => o.id === orderId);

        if (!order) {
            return;
        }

        await runAssignCourierLookup({
            lifecycle: courierRequestLifecycleRef.current,
            request: async (signal) => {
                const res = await fetch(`/outlet/orders/${orderId}`, {
                    headers: { 'X-Inertia': 'true' },
                    signal,
                });

                if (!res.ok) {
                    throw new Error('Gagal memuat daftar kurir');
                }

                return res.json();
            },
            onData: (data) => {
                const rawCouriers = data.props?.couriers ?? [];
                setCouriers(
                    rawCouriers.map((c: any) => ({
                        id: c.id,
                        name: c.name,
                        is_online: c.is_online ?? false,
                        at_capacity: c.at_capacity ?? false,
                    })),
                );
                setSelectedOrder(order);
                setAssignOpen(true);
            },
            onError: () =>
                toast.error('Gagal memuat daftar kurir. Periksa koneksi Anda.'),
        });
    };

    const closeAssignCourierSheet = () => {
        courierRequestLifecycleRef.current.close();
        setAssignOpen(false);
        setSelectedOrder(null);
    };

    return (
        <OutletLayout
            title="Pengiriman"
            subtitle={outlet.name}
            headerBelow={
                <FilterChips
                    options={statusOptions}
                    active={filters.status ?? ''}
                    onChange={(key) =>
                        router.get(
                            '/outlet/deliveries',
                            { status: key || undefined },
                            { preserveState: true, replace: true },
                        )
                    }
                />
            }
        >
            <Head title="Pengiriman" />
            <OutletPageShell>
                {loading ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="space-y-2 rounded-xl border border-border bg-surface p-4"
                                >
                                    <Skeleton className="h-3 w-2/3" />
                                    <Skeleton className="h-6 w-1/2" />
                                </div>
                            ))}
                        </div>
                        <SkeletonList count={5} />
                    </div>
                ) : (
                    <>
                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-2">
                            <StatCard
                                label="Perlu Dikirim"
                                value={stats.needsDispatch}
                                alert={stats.needsDispatch > 0}
                            />
                            <StatCard
                                label="Menunggu Pickup"
                                value={stats.waitingPickup}
                            />
                            <StatCard
                                label="Dalam Perjalanan"
                                value={stats.inTransit}
                            />
                            <StatCard
                                label="Gagal"
                                value={stats.failed}
                                alert={stats.failed > 0}
                            />
                        </div>

                        {/* Unassigned Orders */}
                        {unassignedOrders.length > 0 && (
                            <SectionCard label="Perlu Assign Kurir">
                                {unassignedOrders.map((order: any) => (
                                    <div
                                        key={order.id}
                                        className="rounded-xl border border-border bg-surface-muted p-3"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-bold text-text tabular-nums">
                                                    {order.order_code}
                                                </div>
                                                <div className="mt-0.5 text-xs text-text-muted">
                                                    {order.customer_name}
                                                </div>
                                                <div className="mt-1 flex items-center gap-2 text-[11px] text-text-subtle">
                                                    {order.distance_km !=
                                                        null && (
                                                        <span>
                                                            {formatDistance(
                                                                order.distance_km,
                                                            )}
                                                        </span>
                                                    )}
                                                    <span>
                                                        {formatCurrency(
                                                            order.total,
                                                        )}
                                                    </span>
                                                    <span
                                                        className={`font-medium ${order.delivery_age > 30 ? 'text-danger' : 'text-text-muted'}`}
                                                    >
                                                        {formatDeliveryAge(
                                                            order.delivery_age,
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                            {order.sla_health && (
                                                <DeliverySlaBadge
                                                    health={order.sla_health}
                                                />
                                            )}
                                        </div>
                                        <Button
                                            size="lg"
                                            onClick={() =>
                                                handleAssignCourier(order.id)
                                            }
                                            icon={Truck}
                                            className="mt-2 min-h-11 w-full"
                                        >
                                            Assign Kurir
                                        </Button>
                                    </div>
                                ))}
                            </SectionCard>
                        )}

                        {/* Delivery List */}
                        <SectionCard label="Riwayat Pengiriman">
                            {deliveries.data.length === 0 ? (
                                <EmptyState
                                    icon={
                                        <Package className="h-8 w-8 text-text-subtle" />
                                    }
                                    title="Belum ada pengiriman"
                                    description="Pengiriman akan muncul setelah kurir di-assign."
                                />
                            ) : (
                                <div className="space-y-2">
                                    {deliveries.data.map((d: any) => (
                                        <Link
                                            key={d.id}
                                            href={`/outlet/deliveries/${d.id}`}
                                            className="flex items-center gap-3 rounded-xl border border-border bg-white p-3 active:bg-surface-muted"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-text tabular-nums">
                                                        {d.order_code}
                                                    </span>
                                                    {d.sla_health && (
                                                        <DeliverySlaBadge
                                                            health={
                                                                d.sla_health
                                                            }
                                                        />
                                                    )}
                                                </div>
                                                <div className="mt-0.5 text-xs text-text-muted">
                                                    {d.customer_name}{' '}
                                                    {d.courier
                                                        ? `· ${d.courier.name}`
                                                        : ''}
                                                </div>
                                                <div className="mt-1 text-[11px] text-text-subtle tabular-nums">
                                                    {d.delivery_age != null && (
                                                        <span
                                                            className={
                                                                d.delivery_age >
                                                                60
                                                                    ? 'font-medium text-danger'
                                                                    : ''
                                                            }
                                                        >
                                                            {formatDeliveryAge(
                                                                d.delivery_age,
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <StatusBadge status={d.status} />
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </SectionCard>
                    </>
                )}
            </OutletPageShell>

            {/* Assign Courier Sheet */}
            {selectedOrder && (
                <AssignCourierSheet
                    order={selectedOrder}
                    couriers={couriers}
                    open={assignOpen}
                    onClose={closeAssignCourierSheet}
                    assignUrl={`/outlet/orders/${selectedOrder.id}/assign-courier`}
                />
            )}
        </OutletLayout>
    );
}

function StatCard({
    label,
    value,
    alert,
}: {
    label: string;
    value: number;
    alert?: boolean;
}) {
    return (
        <div className="rounded-xl border border-border bg-white p-3">
            <div className="flex items-center gap-1">
                {alert && (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                )}
                <span className="text-xl font-bold text-text tabular-nums">
                    {value}
                </span>
            </div>
            <div className="text-[11px] font-medium text-text-subtle">
                {label}
            </div>
        </div>
    );
}
