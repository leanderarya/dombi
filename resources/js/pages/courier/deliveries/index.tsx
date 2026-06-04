import { Link, router } from '@inertiajs/react';
import DeliveryStatusBadge from '@/components/delivery-status-badge';
import EmptyState from '@/components/empty-state';
import Pagination from '@/components/pagination';
import CourierLayout from '@/layouts/courier-layout';
import { Head } from '@inertiajs/react';

const statuses = ['waiting_pickup', 'picked_up', 'delivering', 'completed', 'failed'];

export default function CourierDeliveriesIndex({ deliveries, filters }: any) {
    return (
        <CourierLayout>
            <Head title="Riwayat Delivery" />
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-slate-900">Riwayat Delivery</h1>
                <select
                    value={filters.status ?? ''}
                    onChange={(e) => router.get('/courier/deliveries', { status: e.target.value || undefined }, { preserveState: true, replace: true })}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                >
                    <option value="">Semua status</option>
                    {statuses.map((status) => (
                        <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>
                    ))}
                </select>
            </div>

            {deliveries.data.length === 0 ? (
                <div className="mt-5">
                    <EmptyState icon="🚚" title="Belum ada delivery" description="Delivery akan muncul setelah kamu di-assign." />
                </div>
            ) : (
                <div className="mt-4 space-y-2">
                    {deliveries.data.map((delivery: any) => (
                        <Link
                            key={delivery.id}
                            href={`/courier/deliveries/${delivery.id}`}
                            className="block rounded-lg border border-zinc-200 bg-white p-4 transition-colors active:bg-zinc-50"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-bold text-slate-900">{delivery.order.order_code}</div>
                                    <div className="mt-0.5 text-xs text-slate-500">{delivery.order.outlet?.name ?? '-'}</div>
                                    <div className="mt-1 text-sm font-medium text-slate-700">{delivery.order.customer_name}</div>
                                    <div className="mt-0.5 text-xs text-slate-500 line-clamp-1">{delivery.order.customer_address}</div>
                                </div>
                                <DeliveryStatusBadge status={delivery.status} />
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
