import { Link, router } from '@inertiajs/react';
import { Head } from '@inertiajs/react';
import { Truck, Route, Clock, MapPin, Loader2 } from 'lucide-react';
import { useState } from 'react';
import EmptyState from '@/components/ui/empty-state';
import FilterChips from '@/components/ui/filter-chips';
import Pagination from '@/components/ui/pagination';
import SectionCard from '@/components/ui/section-card';
import StatusBadge from '@/components/ui/status-badge';
import CourierLayout from '@/layouts/courier-layout';

const filterOptions = [
    { key: '', label: 'Semua' },
    { key: 'waiting_pickup', label: 'Menunggu' },
    { key: 'delivering', label: 'Diantar' },
    { key: 'completed', label: 'Selesai' },
    { key: 'failed', label: 'Gagal' },
];

export default function CourierDeliveriesIndex({ deliveries, filters }: any) {
    const [activeFilter, setActiveFilter] = useState(filters.status ?? '');
    const [optimizedRoute, setOptimizedRoute] = useState<any[]>([]);
    const [routeSummary, setRouteSummary] = useState<any>(null);
    const [loadingRoute, setLoadingRoute] = useState(false);

    const handleFilterChange = (key: string) => {
        setActiveFilter(key);
        router.get(
            '/courier/deliveries',
            { status: key || undefined },
            { preserveState: true, replace: true },
        );
    };

    const fetchOptimizedRoute = async () => {
        setLoadingRoute(true);

        try {
            const response = await fetch('/courier/deliveries/optimized-route');
            const data = await response.json();
            setOptimizedRoute(data.route);
            setRouteSummary(data.summary);
        } catch (error) {
            console.error('Failed to fetch optimized route:', error);
        } finally {
            setLoadingRoute(false);
        }
    };

    const hasActiveDeliveries = deliveries.data.some((d: any) =>
        ['waiting_pickup', 'picked_up', 'delivering'].includes(d.status),
    );

    return (
        <CourierLayout
            title="Pengiriman"
            headerBelow={
                <FilterChips
                    options={filterOptions}
                    active={activeFilter}
                    onChange={handleFilterChange}
                />
            }
        >
            <Head title="Pengiriman" />

            {/* Route Optimization — only when active deliveries exist */}
            {hasActiveDeliveries && (
                <div className="mt-4 mb-4">
                    <button
                        onClick={fetchOptimizedRoute}
                        disabled={loadingRoute}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white active:opacity-80 disabled:opacity-50"
                    >
                        {loadingRoute ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Route className="h-4 w-4" />
                        )}
                        {loadingRoute ? 'Menghitung Rute...' : 'Optimasi Rute'}
                    </button>
                </div>
            )}

            {/* Route Summary */}
            {routeSummary && routeSummary.stops > 0 && (
                <div className="mb-4">
                    <SectionCard label="Ringkasan Rute">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="flex flex-col items-center rounded-lg bg-surface-muted p-3">
                                <MapPin className="mb-1 h-4 w-4 text-primary" />
                                <div className="text-lg font-bold text-text">
                                    {routeSummary.stops}
                                </div>
                                <div className="text-[11px] text-text-muted">
                                    Stops
                                </div>
                            </div>
                            <div className="flex flex-col items-center rounded-lg bg-surface-muted p-3">
                                <Route className="mb-1 h-4 w-4 text-primary" />
                                <div className="text-lg font-bold text-text">
                                    {routeSummary.total_distance_km}
                                </div>
                                <div className="text-[11px] text-text-muted">
                                    KM
                                </div>
                            </div>
                            <div className="flex flex-col items-center rounded-lg bg-surface-muted p-3">
                                <Clock className="mb-1 h-4 w-4 text-primary" />
                                <div className="text-lg font-bold text-text">
                                    {routeSummary.estimated_minutes}
                                </div>
                                <div className="text-[11px] text-text-muted">
                                    Menit
                                </div>
                            </div>
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* Optimized Route List */}
            {optimizedRoute.length > 0 && (
                <div className="mb-4">
                    <SectionCard label="Urutan Pengiriman">
                        <div className="space-y-3">
                            {optimizedRoute.map((stop: any, index: number) => (
                                <div
                                    key={stop.id}
                                    className="flex items-start gap-3"
                                >
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary">
                                        {index + 1}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium text-text">
                                            {stop.customer_name}
                                        </div>
                                        <div className="mt-0.5 line-clamp-2 text-xs text-text-muted">
                                            {stop.address}
                                        </div>
                                        <div className="mt-1 text-xs font-medium text-primary">
                                            {stop.order_code}
                                        </div>
                                    </div>
                                    <StatusBadge status={stop.status} />
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* Delivery List */}
            {deliveries.data.length === 0 ? (
                <div className="mt-4">
                    <EmptyState
                        icon={<Truck className="h-8 w-8 text-text-subtle" />}
                        title="Belum ada pengiriman"
                        description="Pengiriman akan muncul setelah kamu di-assign."
                    />
                </div>
            ) : (
                <div className="mt-4 space-y-2">
                    {deliveries.data.map((delivery: any) => (
                        <Link
                            key={delivery.id}
                            href={`/courier/deliveries/${delivery.id}`}
                            className="block rounded-xl border border-border bg-white p-4 transition-all hover:shadow-sm active:opacity-80"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-bold text-text">
                                        {delivery.order.order_code}
                                    </div>
                                    <div className="mt-0.5 text-xs text-text-muted">
                                        {delivery.order.outlet?.name ?? '-'}
                                    </div>
                                    <div className="mt-1 text-sm font-medium text-text">
                                        {delivery.order.customer_name}
                                    </div>
                                    <div className="mt-0.5 line-clamp-1 text-xs text-text-muted">
                                        {delivery.order.customer_address}
                                    </div>
                                </div>
                                <StatusBadge status={delivery.status} />
                            </div>
                        </Link>
                    ))}
                </div>
            )}
            <div className="mt-4">
                <Pagination links={deliveries.links} />
            </div>
        </CourierLayout>
    );
}
