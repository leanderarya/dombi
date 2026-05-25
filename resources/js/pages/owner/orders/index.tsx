import { Head, Link, router } from '@inertiajs/react';
import EmptyState from '@/components/empty-state';
import OrderStatusBadge from '@/components/order-status-badge';
import Pagination from '@/components/pagination';
import OwnerLayout from '@/layouts/owner-layout';
import { formatCurrency, formatDate } from '@/lib/format';

const statuses = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering', 'completed', 'cancelled', 'failed'];

export default function OwnerOrdersIndex({ orders, outlets, filters }: any) {
    const setFilter = (key: string, value: string) => {
        router.get('/owner/orders', { ...filters, [key]: value || undefined }, { preserveState: true, replace: true });
    };

    return (
        <OwnerLayout>
            <Head title="Owner Orders" />
            <h1 className="text-2xl font-semibold">Order Monitoring</h1>
            <div className="mt-5 grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-4">
                <input defaultValue={filters.search ?? ''} onBlur={(e) => setFilter('search', e.target.value)} placeholder="Search order code" className="rounded-md border px-3 py-2 text-sm" />
                <select value={filters.status ?? ''} onChange={(e) => setFilter('status', e.target.value)} className="rounded-md border px-3 py-2 text-sm">
                    <option value="">Semua status</option>
                    {statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                </select>
                <select value={filters.outlet_id ?? ''} onChange={(e) => setFilter('outlet_id', e.target.value)} className="rounded-md border px-3 py-2 text-sm">
                    <option value="">Semua outlet</option>
                    {outlets.map((outlet: any) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}
                </select>
                <input type="date" value={filters.date ?? ''} onChange={(e) => setFilter('date', e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
            </div>
            <div className="mt-5 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
                {orders.data.length === 0 ? (
                    <EmptyState icon="📦" title="Belum ada order" description="Order akan muncul setelah customer membuat pesanan." />
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-50">
                            <tr><th className="p-3">Order</th><th className="p-3">Customer</th><th className="p-3">Outlet</th><th className="p-3">Total</th><th className="p-3">Status</th><th className="p-3">Created</th></tr>
                        </thead>
                        <tbody>
                            {orders.data.map((order: any) => (
                                <tr key={order.id} className="border-t hover:bg-zinc-50/50">
                                    <td className="p-3 font-medium"><Link href={`/owner/orders/${order.id}`} className="text-emerald-700">{order.order_code}</Link></td>
                                    <td className="p-3">{order.customer_name}</td>
                                    <td className="p-3">{order.outlet?.name ?? '-'}</td>
                                    <td className="p-3">{formatCurrency(order.total)}</td>
                                    <td className="p-3"><OrderStatusBadge status={order.status} /></td>
                                    <td className="p-3 text-xs text-slate-500">{formatDate(order.created_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            <Pagination links={orders.links} />
        </OwnerLayout>
    );
}
