import { Link, router } from '@inertiajs/react';
import { Head } from '@inertiajs/react';
import { Truck, Route, Clock, MapPin, Loader2 } from 'lucide-react';
import { useState } from 'react';
import DeliveryStatusBadge from '@/components/delivery-status-badge';
import Pagination from '@/components/pagination';
import EmptyState from '@/components/ui/empty-state';
import FilterChips from '@/components/ui/filter-chips';
import SectionCard from '@/components/ui/section-card';
import CourierLayout from '@/layouts/courier-layout';

const filterOptions = [
    { key: '', label: 'Semua' },
    { key: 'waiting_pickup', label: 'Pickup' },
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
        router.get('/courier/deliveries', { status: key || undefined }, { preserveState: true, replace: true });
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

    return (
        <CourierLayout
            title="Riwayat Delivery"
            headerBelow={<FilterChips options={filterOptions} active={activeFilter} onChange={handleFilterChange} />}
        >
            <Head title="Riwayat Delivery" />

            <div className="mb-4">
                <button
                    onClick={fetchOptimizedRoute}
                    disabled={loadingRoute}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white active:bg-emerald-800 disabled:opacity-50"
                >
                    {loadingRoute ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Route className="h-4 w-4" />
                    )}
                    {loadingRoute ? 'Menghitung Rute...' : 'Optimasi Rute'}
                </button>
            </div>

            {routeSummary && routeSummary.stops > 0 && (
                <div className="mb-4">
                    <SectionCard label="Ringkasan Rute">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="flex flex-col items-center rounded-lg bg-slate-50 p-3">
                                <MapPin className="mb-1 h-4 w-4 text-emerald-600" />
                                <div className="text-lg font-bold text-slate-900">{routeSummary.stops}</div>
                                <div className="text-[10px] text-slate-500">Stops</div>
                            </div>
                            <div className="flex flex-col items-center rounded-lg bg-slate-50 p-3">
                                <Route className="mb-1 h-4 w-4 text-emerald-600" />
                                <div className="text-lg font-bold text-slate-900">{routeSummary.total_distance_km}</div>
                                <div className="text-[10px] text-slate-500">KM</div>
                            </div>
                            <div className="flex flex-col items-center rounded-lg bg-slate-50 p-3">
                                <Clock className="mb-1 h-4 w-4 text-emerald-600" />
                                <div className="text-lg font-bold text-slate-900">{routeSummary.estimated_minutes}</div>
                                <div className="text-[10px] text-slate-500">Menit</div>
                            </div>
                        </div>
                    </SectionCard>
                </div>
            )}

            {optimizedRoute.length > 0 && (
                <div className="mb-4">
                    <SectionCard label="Urutan Pengiriman">
                        <div className="space-y-3">
                            {optimizedRoute.map((stop: any, index: number) => (
                                <div key={stop.id} className="flex items-start gap-3">
                                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                                        {index + 1}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium text-slate-900">{stop.customer_name}</div>
                                        <div className="mt-0.5 text-xs text-slate-500 line-clamp-2">{stop.address}</div>
                                        <div className="mt-1 text-xs font-medium text-emerald-600">{stop.order_code}</div>
                                    </div>
                                    <DeliveryStatusBadge status={stop.status} />
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                </div>
            )}

            {deliveries.data.length === 0 ? (
                <EmptyState
                    icon={<Truck className="h-8 w-8 text-slate-400" />}
                    title="Belum ada delivery"
                    description="Delivery akan muncul setelah kamu di-assign."
                />
            ) : (
                <div className="space-y-3">
                    {deliveries.data.map((delivery: any) => (
                        <Link
                            key={delivery.id}
                            href={`/courier/deliveries/${delivery.id}`}
                            className="block"
                        >
                            <SectionCard noPadding>
                                <div className="flex items-start justify-between gap-3 p-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-bold text-slate-900">{delivery.order.order_code}</div>
                                        <div className="mt-0.5 text-xs text-slate-500">{delivery.order.outlet?.name ?? '-'}</div>
                                        <div className="mt-1 text-sm font-medium text-slate-700">{delivery.order.customer_name}</div>
                                        <div className="mt-0.5 text-xs text-slate-500 line-clamp-1">{delivery.order.customer_address}</div>
                                    </div>
                                    <DeliveryStatusBadge status={delivery.status} />
                                </div>
                            </SectionCard>
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
