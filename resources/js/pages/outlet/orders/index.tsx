import { Head, Link, router } from '@inertiajs/react';
import EmptyState from '@/components/empty-state';
import OrderStatusBadge from '@/components/order-status-badge';
import Pagination from '@/components/pagination';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency, formatDate } from '@/lib/format';

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
                <select value={filters.status ?? ''} onChange={(e) => router.get('/outlet/orders', { status: e.target.value || undefined }, { preserveState: true, replace: true })} className="rounded-md border px-3 py-2 text-sm">
                    <option value="">Semua status</option>
                    {statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                </select>
            </div>
            <div className="mt-5 overflow-x-auto rounded-lg border bg-white">
                {orders.data.length === 0 ? (
                    <EmptyState icon="📦" title="Belum ada order" description="Order akan muncul saat customer memesan ke outlet ini." />
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-50">
                            <tr><th className="p-3">Order</th><th className="p-3">Customer</th><th className="p-3">Total</th><th className="p-3">Status</th><th className="p-3">Created</th></tr>
                        </thead>
                        <tbody>
                            {orders.data.map((order: any) => (
                                <tr key={order.id} className="border-t hover:bg-zinc-50/50">
                                    <td className="p-3 font-medium"><Link href={`/outlet/orders/${order.id}`} className="text-emerald-700">{order.order_code}</Link></td>
                                    <td className="p-3">{order.customer_name}</td>
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
        </OutletLayout>
    );
}
