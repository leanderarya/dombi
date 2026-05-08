import { Head, Link, router } from '@inertiajs/react';
import OrderStatusBadge from '../../../components/order-status-badge';
import OutletLayout from '../../../layouts/outlet-layout';

const statuses = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'completed', 'cancelled'];

export default function OutletOrdersIndex({ outlet, orders, filters }: any) {
    return (
        <OutletLayout>
            <Head title="Outlet Orders" />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Orders</h1>
                    <p className="text-sm text-zinc-500">{outlet.name}</p>
                </div>
                <select defaultValue={filters.status ?? ''} onChange={(e) => router.get('/outlet/orders', { status: e.target.value }, { preserveState: true })} className="rounded-md border px-3 py-2 text-sm">
                    <option value="">Semua status</option>
                    {statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                </select>
            </div>
            <div className="mt-5 overflow-x-auto rounded-lg border bg-white">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50">
                        <tr><th className="p-3">Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Created</th></tr>
                    </thead>
                    <tbody>
                        {orders.data.map((order: any) => (
                            <tr key={order.id} className="border-t">
                                <td className="p-3 font-medium"><Link href={`/outlet/orders/${order.id}`} className="text-emerald-700">{order.order_code}</Link></td>
                                <td>{order.customer_name}</td>
                                <td>Rp {Number(order.total).toLocaleString('id-ID')}</td>
                                <td><OrderStatusBadge status={order.status} /></td>
                                <td>{new Date(order.created_at).toLocaleString('id-ID')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </OutletLayout>
    );
}
