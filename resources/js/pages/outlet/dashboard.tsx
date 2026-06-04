import { Head, Link } from '@inertiajs/react';
import OrderStatusBadge from '@/components/order-status-badge';
import StockLevelBadge from '@/components/stock-level-badge';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency } from '@/lib/format';
import { usePolling } from '@/lib/use-polling';

export default function OutletDashboard({ outlet, stats, deliveryStats, lowStockItems, recentOrders }: any) {
    usePolling(20000); // Refresh every 20s
    return (
        <OutletLayout>
            <Head title="Outlet Dashboard" />
            <div>
                <h1 className="text-xl font-semibold sm:text-2xl">{outlet.name}</h1>
                <p className="text-sm text-zinc-500">{outlet.kecamatan}</p>
            </div>

            {/* Delivery Stats */}
            <div className="mt-5">
                <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Delivery</h2>
                    <Link href="/outlet/deliveries" className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Lihat Semua</Link>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatCard label="Perlu Dikirim" value={deliveryStats.needsDispatch} href="/outlet/deliveries" color="amber" urgent={deliveryStats.needsDispatch > 0} />
                    <StatCard label="Menunggu Pickup" value={deliveryStats.waitingPickup} href="/outlet/deliveries?status=waiting_pickup" color="blue" />
                    <StatCard label="Dalam Perjalanan" value={deliveryStats.inTransit} href="/outlet/deliveries?status=delivering" color="purple" />
                    <StatCard label="Gagal" value={deliveryStats.failed} href="/outlet/deliveries?status=failed" color="red" urgent={deliveryStats.failed > 0} />
                </div>
            </div>

            {/* Order Stats - mobile 2 cols */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard label="Pending" value={stats.pendingOrders} href="/outlet/orders?status=pending" color="yellow" urgent={stats.pendingOrders > 0} />
                <StatCard label="Preparing" value={stats.preparingOrders} href="/outlet/orders?status=preparing" color="blue" />
                <StatCard label="Ready Pickup" value={stats.readyForPickupOrders} href="/outlet/orders?status=ready_for_pickup" color="purple" />
                <StatCard label="Order Hari Ini" value={stats.todayOrders} />
                <StatCard label="Low Stock" value={stats.lowStocks} href="/outlet/inventory" color="amber" urgent={stats.lowStocks > 0} />
                <StatCard label="Restock Active" value={stats.pendingRestocks} href="/outlet/restocks" color="orange" />
            </div>

            {/* Quick Actions - sticky on mobile */}
            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
                <Link href="/outlet/orders?status=pending" className="shrink-0 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white active:bg-emerald-800">Proses Order</Link>
                <Link href="/outlet/inventory" className="shrink-0 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium active:bg-zinc-50">Inventory</Link>
                <Link href="/outlet/restocks/create" className="shrink-0 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium active:bg-zinc-50">Request Restock</Link>
            </div>

            {/* Low Stock Warning */}
            {lowStockItems.length > 0 && (
                <section className="mt-6">
                    <h2 className="text-sm font-semibold text-amber-800">⚠️ Stok Rendah</h2>
                    <div className="mt-2 space-y-2">
                        {lowStockItems.map((item: any) => (
                            <div key={item.id} className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5">
                                <div>
                                    <div className="text-sm font-medium">{item.product?.name}</div>
                                    <div className="text-xs text-amber-700">Available: {item.current_stock - item.reserved_stock} / Min: {item.minimum_stock}</div>
                                </div>
                                <StockLevelBadge currentStock={item.current_stock} reservedStock={item.reserved_stock} minimumStock={item.minimum_stock} />
                            </div>
                        ))}
                    </div>
                    <Link href="/outlet/restocks/create" className="mt-3 block rounded-lg border border-amber-200 bg-amber-100 px-4 py-2.5 text-center text-sm font-medium text-amber-900 active:bg-amber-200">
                        Request Restock →
                    </Link>
                </section>
            )}

            {/* Recent Orders */}
            {recentOrders.length > 0 && (
                <section className="mt-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-slate-700">Order Aktif</h2>
                        <Link href="/outlet/orders" className="text-xs text-emerald-700">Lihat semua</Link>
                    </div>
                    <div className="mt-2 space-y-2">
                        {recentOrders.map((order: any) => (
                            <Link key={order.id} href={`/outlet/orders/${order.id}`} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-white px-3 py-3 active:bg-zinc-50">
                                <div>
                                    <div className="text-sm font-medium">{order.order_code}</div>
                                    <div className="text-xs text-zinc-500">{order.customer_name} · {formatCurrency(order.total)}</div>
                                </div>
                                <OrderStatusBadge status={order.status} />
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </OutletLayout>
    );
}

function StatCard({ label, value, href, color, urgent }: { label: string; value: number; href?: string; color?: string; urgent?: boolean }) {
    const colorClasses: Record<string, string> = {
        yellow: 'border-yellow-100 bg-yellow-50',
        amber: 'border-amber-100 bg-amber-50',
        orange: 'border-orange-100 bg-orange-50',
        blue: 'border-blue-100 bg-blue-50',
        purple: 'border-purple-100 bg-purple-50',
    };
    const base = colorClasses[color ?? ''] ?? 'border-zinc-100 bg-white';
    const Wrapper = href ? Link : 'div';

    return (
        <Wrapper {...(href ? { href } : {})} className={`rounded-xl border p-3 ${base} ${urgent ? 'ring-2 ring-amber-300' : ''} active:scale-[0.97] transition-transform`}>
            <div className="text-xs font-medium text-slate-500">{label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
        </Wrapper>
    );
}
