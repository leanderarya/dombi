import { Head, Link, router } from '@inertiajs/react';
import DeliveryStatusBadge from '../../../components/delivery-status-badge';
import OwnerLayout from '../../../layouts/owner-layout';

const statuses = ['waiting_pickup', 'picked_up', 'delivering', 'completed', 'failed'];

export default function OwnerDeliveriesIndex({ deliveries, couriers, filters }: any) {
    const setFilter = (key: string, value: string) => {
        router.get('/owner/deliveries', { ...filters, [key]: value }, { preserveState: true });
    };

    return (
        <OwnerLayout>
            <Head title="Deliveries" />
            <h1 className="text-2xl font-semibold">Delivery Monitoring</h1>
            <div className="mt-5 grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-3">
                <input defaultValue={filters.search ?? ''} onBlur={(e) => setFilter('search', e.target.value)} placeholder="Search order code" className="rounded-md border px-3 py-2 text-sm" />
                <select defaultValue={filters.status ?? ''} onChange={(e) => setFilter('status', e.target.value)} className="rounded-md border px-3 py-2 text-sm">
                    <option value="">Semua status</option>
                    {statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                </select>
                <select defaultValue={filters.courier_id ?? ''} onChange={(e) => setFilter('courier_id', e.target.value)} className="rounded-md border px-3 py-2 text-sm">
                    <option value="">Semua kurir</option>
                    {couriers.map((courier: any) => <option key={courier.id} value={courier.id}>{courier.name}</option>)}
                </select>
            </div>
            <div className="mt-5 overflow-x-auto rounded-lg border bg-white">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50">
                        <tr><th className="p-3">Order</th><th>Outlet</th><th>Courier</th><th>Status</th><th>Assigned</th></tr>
                    </thead>
                    <tbody>
                        {deliveries.data.map((delivery: any) => (
                            <tr key={delivery.id} className="border-t">
                                <td className="p-3 font-medium"><Link href={`/owner/deliveries/${delivery.id}`} className="text-emerald-700">{delivery.order.order_code}</Link></td>
                                <td>{delivery.order.outlet?.name ?? '-'}</td>
                                <td>{delivery.courier?.name ?? '-'}</td>
                                <td><DeliveryStatusBadge status={delivery.status} /></td>
                                <td>{delivery.assigned_at ? new Date(delivery.assigned_at).toLocaleString('id-ID') : '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </OwnerLayout>
    );
}
