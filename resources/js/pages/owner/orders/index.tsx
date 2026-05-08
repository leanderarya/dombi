import { Head, Link, router } from '@inertiajs/react';
import OrderStatusBadge from '../../../components/order-status-badge';
import OwnerLayout from '../../../layouts/owner-layout';

const statuses = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'completed', 'cancelled'];

export default function OwnerOrdersIndex({ orders, outlets, filters }: any) {
    const setFilter = (key: string, value: string) => {
        router.get('/owner/orders', { ...filters, [key]: value }, { preserveState: true });
    };

    return (
        <OwnerLayout>
            <Head title="Owner Orders" />
            <h1 className="text-2xl font-semibold">Order Monitoring</h1>
            <div className="mt-5 grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-4">
                <input defaultValue={filters.search ?? ''} onBlur={(e) => setFilter('search', e.target.value)} placeholder="Search order code" className="rounded-md border px-3 py-2 text-sm" />
                <select defaultValue={filters.status ?? ''} onChange={(e) => setFilter('status', e.target.value)} className="rounded-md border px-3 py-2 text-sm">
                    <option value="">Semua status</option>
                    {statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                </select>
                <select defaultValue={filters.outlet_id ?? ''} onChange={(e) => setFilter('outlet_id', e.target.value)} className="rounded-md border px-3 py-2 text-sm">
                    <option value="">Semua outlet</option>
                    {outlets.map((outlet: any) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}
                </select>
                <input type="date" defaultValue={filters.date ?? ''} onChange={(e) => setFilter('date', e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
            </div>
            <div className="mt-5 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50">
                        <tr><th className="p-3">Order</th><th>Customer</th><th>Outlet</th><th>Total</th><th>Status</th><th>Created</th></tr>
                    </thead>
                    <tbody>
                        {orders.data.map((order: any) => (
                            <tr key={order.id} className="border-t">
                                <td className="p-3 font-medium"><Link href={`/owner/orders/${order.id}`} className="text-emerald-700">{order.order_code}</Link></td>
                                <td>{order.customer_name}</td>
                                <td>{order.outlet?.name ?? '-'}</td>
                                <td>Rp {Number(order.total).toLocaleString('id-ID')}</td>
                                <td><OrderStatusBadge status={order.status} /></td>
                                <td>{new Date(order.created_at).toLocaleString('id-ID')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </OwnerLayout>
    );
}
