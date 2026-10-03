import { Link, router } from '@inertiajs/react';
import { Head } from '@inertiajs/react';
import {
    Truck,
    Route,
    Clock,
    MapPin,
    Loader2,
    AlertTriangle,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
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

export default function CourierDeliveriesIndex({
    deliveries,
    filters,
    hasActiveDeliveries,
}: any) {
    const [activeFilter, setActiveFilter] = useState(filters.status ?? '');
    const [optimizedRoute, setOptimizedRoute] = useState<any[]>([]);
    const [routeSummary, setRouteSummary] = useState<any>(null);
    const [loadingRoute, setLoadingRoute] = useState(false);
    const [routeError, setRouteError] = useState<string | null>(null);

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
        setRouteError(null);

        try {
            const response = await fetch('/courier/deliveries/optimized-route');

            if (!response.ok) {
                throw new Error(`Rute gagal dihitung (${response.status})`);
            }

            const data = await response.json();

            // Guard the array: the render reads .length, so an undefined route
            // (empty body, unexpected shape) would throw instead of degrading.
            setOptimizedRoute(Array.isArray(data.route) ? data.route : []);
            setRouteSummary(data.summary ?? null);
        } catch (error) {
            console.error('Failed to fetch optimized route:', error);
            setOptimizedRoute([]);
            setRouteSummary(null);
            setRouteError(
                'Rute gagal dihitung. Periksa koneksi lalu coba lagi.',
            );
        } finally {
            setLoadingRoute(false);
        }
    };

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
                    <Button
                        onClick={fetchOptimizedRoute}
                        disabled={loadingRoute}
                        size="lg"
                        className="w-full active:opacity-80"
                    >
                        {loadingRoute ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Route className="h-4 w-4" />
                        )}
                        {loadingRoute ? 'Menghitung Rute...' : 'Optimasi Rute'}
                    </Button>
                    {routeError && (
                        <div className="mt-2 flex items-start gap-2 rounded-lg border border-danger-border bg-danger-bg p-3">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                            <div className="text-sm text-danger-text">
                                {routeError}
                            </div>
                        </div>
                    )}
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
                                <div className="text-caption text-text-muted">
                                    Stops
                                </div>
                            </div>
                            <div className="flex flex-col items-center rounded-lg bg-surface-muted p-3">
                                <Route className="mb-1 h-4 w-4 text-primary" />
                                <div className="text-lg font-bold text-text">
                                    {routeSummary.total_distance_km}
                                </div>
                                <div className="text-caption text-text-muted">
                                    KM
                                </div>
                            </div>
                            <div className="flex flex-col items-center rounded-lg bg-surface-muted p-3">
                                <Clock className="mb-1 h-4 w-4 text-primary" />
                                <div className="text-lg font-bold text-text">
                                    {routeSummary.estimated_minutes}
                                </div>
                                <div className="text-caption text-text-muted">
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
                            className="block rounded-xl border border-border bg-surface p-4 transition-all hover:shadow-sm active:opacity-80"
                        >
                            {/* Same wrap/shrink guard as the dashboard cards:
                                `flex-1` needs the `min-w-32` floor for the
                                wrap decision to see the column's width. */}
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-32 flex-1">
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
                                <StatusBadge
                                    className="shrink-0"
                                    status={delivery.status}
                                />
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
