import { Head, Link, router } from '@inertiajs/react';
import DeliveryStatusBadge from '@/components/delivery-status-badge';
import EmptyState from '@/components/empty-state';
import Pagination from '@/components/pagination';
import OwnerLayout from '@/layouts/owner-layout';
import { formatDate } from '@/lib/format';

const statuses = ['waiting_pickup', 'picked_up', 'delivering', 'completed', 'failed', 'retry_delivery', 'returned_to_outlet', 'cancelled_and_released'];

export default function OwnerDeliveriesIndex({ deliveries, couriers, filters }: any) {
    const setFilter = (key: string, value: string) => {
        router.get('/owner/deliveries', { ...filters, [key]: value || undefined }, { preserveState: true, replace: true });
    };

    return (
        <OwnerLayout>
            <Head title="Deliveries" />
            <h1 className="text-2xl font-semibold">Delivery Monitoring</h1>
            <div className="mt-5 grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-3">
                <input defaultValue={filters.search ?? ''} onBlur={(e) => setFilter('search', e.target.value)} placeholder="Search order code" className="rounded-md border px-3 py-2 text-sm" />
                <select value={filters.status ?? ''} onChange={(e) => setFilter('status', e.target.value)} className="rounded-md border px-3 py-2 text-sm">
                    <option value="">Semua status</option>
                    {statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                </select>
                <select value={filters.courier_id ?? ''} onChange={(e) => setFilter('courier_id', e.target.value)} className="rounded-md border px-3 py-2 text-sm">
                    <option value="">Semua kurir</option>
                    {couriers.map((courier: any) => <option key={courier.id} value={courier.id}>{courier.name}</option>)}
                </select>
            </div>
            <div className="mt-5 overflow-x-auto rounded-lg border bg-white">
                {deliveries.data.length === 0 ? (
                    <EmptyState icon="🚚" title="Belum ada delivery" description="Delivery akan muncul setelah kurir di-assign." />
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-50">
                            <tr><th className="p-3">Order</th><th className="p-3">Outlet</th><th className="p-3">Courier</th><th className="p-3">Status</th><th className="p-3">Assigned</th></tr>
                        </thead>
                        <tbody>
                            {deliveries.data.map((delivery: any) => (
                                <tr key={delivery.id} className="border-t hover:bg-zinc-50/50">
                                    <td className="p-3 font-medium"><Link href={`/owner/deliveries/${delivery.id}`} className="text-emerald-700">{delivery.order.order_code}</Link></td>
                                    <td className="p-3">{delivery.order.outlet?.name ?? '-'}</td>
                                    <td className="p-3">{delivery.courier?.name ?? '-'}</td>
                                    <td className="p-3"><DeliveryStatusBadge status={delivery.status} /></td>
                                    <td className="p-3 text-xs text-slate-500">{formatDate(delivery.assigned_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            <Pagination links={deliveries.links} />
        </OwnerLayout>
    );
}
