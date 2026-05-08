import { Head, Link, router } from '@inertiajs/react';
import OrderStatusBadge from '../../components/order-status-badge';
import { formatCurrency } from '../../lib/format';
import CustomerLayout from '../../layouts/customer-layout';

export default function Home({ products, recentOrders, activeOrder, lastOrder }: any) {
    return (
        <CustomerLayout>
            <Head title="Customer Home" />
            <h1 className="text-2xl font-semibold">Home</h1>
            {activeOrder && (
                <Link href={`/customer/orders/${activeOrder.id}`} className="mt-5 block rounded-lg border border-emerald-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="text-sm text-zinc-500">Active order</div>
                            <div className="mt-1 font-semibold">{activeOrder.order_code}</div>
                            <div className="text-sm text-zinc-500">{activeOrder.outlet?.name ?? '-'}</div>
                        </div>
                        <OrderStatusBadge status={activeOrder.status} />
                    </div>
                </Link>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/customer/checkout" className="rounded-md bg-emerald-700 px-4 py-2 text-white">Checkout</Link>
                <Link href="/customer/orders" className="rounded-md border bg-white px-4 py-2">Order History</Link>
                <Link href="/customer/addresses" className="rounded-md border bg-white px-4 py-2">Addresses</Link>
                {lastOrder && <button onClick={() => router.post(`/customer/orders/${lastOrder.id}/repeat`)} className="rounded-md border bg-white px-4 py-2">Order Again</button>}
            </div>
            <h2 className="mt-8 font-semibold">Produk aktif</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {products.map((product: any) => <div key={product.id} className="rounded-lg border bg-white p-4"><div className="font-medium">{product.name}</div><div className="text-sm text-zinc-500">{product.size} {product.unit}</div><div className="mt-3 font-semibold">{formatCurrency(product.price)}</div></div>)}
            </div>
            <h2 className="mt-8 font-semibold">Order terbaru</h2>
            <div className="mt-3 space-y-3">
                {recentOrders.length === 0 && <div className="rounded-lg border bg-white p-4 text-sm text-zinc-500">Belum ada order.</div>}
                {recentOrders.map((order: any) => <Link key={order.id} href={`/customer/orders/${order.id}`} className="block rounded-lg border bg-white p-4"><div className="flex items-center justify-between"><div><div className="font-medium">{order.order_code}</div><div className="text-sm text-zinc-500">{order.outlet?.name ?? '-'}</div></div><OrderStatusBadge status={order.status} /></div></Link>)}
            </div>
        </CustomerLayout>
    );
}
