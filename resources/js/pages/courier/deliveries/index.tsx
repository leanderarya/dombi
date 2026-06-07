import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { Truck } from 'lucide-react';
import DeliveryStatusBadge from '@/components/delivery-status-badge';
import FilterChips from '@/components/ui/filter-chips';
import SectionCard from '@/components/ui/section-card';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/pagination';
import CourierLayout from '@/layouts/courier-layout';
import { Head } from '@inertiajs/react';

const filterOptions = [
    { key: '', label: 'Semua' },
    { key: 'waiting_pickup', label: 'Pickup' },
    { key: 'delivering', label: 'Diantar' },
    { key: 'completed', label: 'Selesai' },
    { key: 'failed', label: 'Gagal' },
];

export default function CourierDeliveriesIndex({ deliveries, filters }: any) {
    const [activeFilter, setActiveFilter] = useState(filters.status ?? '');

    const handleFilterChange = (key: string) => {
        setActiveFilter(key);
        router.get('/courier/deliveries', { status: key || undefined }, { preserveState: true, replace: true });
    };

    return (
        <CourierLayout
            title="Riwayat Delivery"
            headerBelow={<FilterChips options={filterOptions} active={activeFilter} onChange={handleFilterChange} />}
        >
            <Head title="Riwayat Delivery" />

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
