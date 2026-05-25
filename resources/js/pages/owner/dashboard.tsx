import { Head, Link } from '@inertiajs/react';
import DeliveryStatusBadge from '@/components/delivery-status-badge';
import OwnerLayout from '@/layouts/owner-layout';
import { formatDate } from '@/lib/format';
import { usePolling } from '@/lib/use-polling';

export default function Dashboard({ stats, alerts, recentActivity }: any) {
    usePolling(30000); // Refresh every 30s
    return (
        <OwnerLayout>
            <Head title="Owner Dashboard" />
            <h1 className="text-xl font-semibold sm:text-2xl">Dashboard</h1>

            {/* Operational Alerts */}
            {(alerts.failedDeliveries.length > 0 || alerts.lowStockItems.length > 0) && (
                <section className="mt-4 space-y-3">
                    {alerts.failedDeliveries.length > 0 && (
                        <Link href="/owner/deliveries?status=failed" className="block rounded-xl border border-red-200 bg-red-50 p-4">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">⚠️</span>
                                <span className="text-sm font-semibold text-red-800">{alerts.failedDeliveries.length} delivery gagal perlu ditindak</span>
                            </div>
                            <div className="mt-2 space-y-1">
                                {alerts.failedDeliveries.slice(0, 3).map((d: any) => (
                                    <div key={d.id} className="text-xs text-red-700">{d.order?.order_code} — {d.failed_reason?.slice(0, 40)}</div>
                                ))}
                            </div>
                        </Link>
                    )}
                    {alerts.lowStockItems.length > 0 && (
                        <Link href="/owner/inventories" className="block rounded-xl border border-amber-200 bg-amber-50 p-4">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">📉</span>
                                <span className="text-sm font-semibold text-amber-800">{alerts.lowStockItems.length} produk stok rendah</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                                {alerts.lowStockItems.slice(0, 4).map((item: any) => (
                                    <span key={item.id} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                                        {item.outlet?.name}: {item.product?.name}
                                    </span>
                                ))}
                                {alerts.lowStockItems.length > 4 && <span className="text-xs text-amber-600">+{alerts.lowStockItems.length - 4} lainnya</span>}
                            </div>
                        </Link>
                    )}
                </section>
            )}

            {/* Stats Grid - mobile 2 cols */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <StatCard label="Pending" value={stats.pendingOrders} href="/owner/orders?status=pending" color="yellow" />
                <StatCard label="Ready Pickup" value={stats.readyPickupOrders} href="/owner/orders?status=ready_for_pickup" color="purple" />
                <StatCard label="Active Delivery" value={stats.activeDeliveries} href="/owner/deliveries?status=delivering" color="blue" />
                <StatCard label="Failed" value={stats.failedDeliveries} href="/owner/deliveries?status=failed" color="red" />
                <StatCard label="Low Stock" value={stats.lowStocks} href="/owner/inventories" color="amber" />
                <StatCard label="Restock Pending" value={stats.pendingRestocks} href="/owner/restocks?status=requested" color="orange" />
                <StatCard label="Order Hari Ini" value={stats.todayOrders} href="/owner/orders" />
                <StatCard label="Outlet Aktif" value={stats.activeOutlets} href="/owner/outlets" />
                <StatCard label="Produk Aktif" value={stats.activeProducts} href="/owner/products" />
                <StatCard label="Total Active" value={stats.activeOrders} href="/owner/orders" />
            </div>

            {/* Quick Actions */}
            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
                <Link href="/owner/orders?status=pending" className="shrink-0 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white active:bg-emerald-800">Orders</Link>
                <Link href="/owner/deliveries" className="shrink-0 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium active:bg-zinc-50">Deliveries</Link>
                <Link href="/owner/inventories" className="shrink-0 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium active:bg-zinc-50">Inventory</Link>
                <Link href="/owner/restocks?status=requested" className="shrink-0 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium active:bg-zinc-50">Restocks</Link>
                <Link href="/owner/reports" className="shrink-0 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium active:bg-zinc-50">Reports</Link>
            </div>

            {/* Recent Activity */}
            {recentActivity.length > 0 && (
                <section className="mt-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-slate-700">Aktivitas Terbaru</h2>
                        <Link href="/owner/stock-movements" className="text-xs text-emerald-700">Lihat semua</Link>
                    </div>
                    <div className="mt-2 space-y-2">
                        {recentActivity.slice(0, 6).map((m: any) => (
                            <div key={m.id} className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-white px-3 py-2.5">
                                <MovementIcon type={m.type} />
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-medium">{m.product?.name ?? '-'}</div>
                                    <div className="text-xs text-zinc-500">{m.outlet?.name} · {typeLabel(m.type)}</div>
                                </div>
                                <div className={`shrink-0 text-sm font-mono font-medium ${m.quantity >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                    {m.quantity >= 0 ? '+' : ''}{m.quantity}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Pending Restocks */}
            {alerts.pendingRestocks.length > 0 && (
                <section className="mt-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-slate-700">Restock Menunggu Approval</h2>
                        <Link href="/owner/restocks?status=requested" className="text-xs text-emerald-700">Lihat semua</Link>
                    </div>
                    <div className="mt-2 space-y-2">
                        {alerts.pendingRestocks.map((r: any) => (
                            <Link key={r.id} href={`/owner/restocks/${r.id}`} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-white px-3 py-2.5">
                                <div>
                                    <div className="text-sm font-medium">Request #{r.id}</div>
                                    <div className="text-xs text-zinc-500">{r.outlet?.name}</div>
                                </div>
                                <div className="text-xs text-zinc-400">{formatDate(r.created_at)}</div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </OwnerLayout>
    );
}

function StatCard({ label, value, href, color }: { label: string; value: number; href?: string; color?: string }) {
    const colorClasses: Record<string, string> = {
        red: 'border-red-100 bg-red-50',
        amber: 'border-amber-100 bg-amber-50',
        yellow: 'border-yellow-100 bg-yellow-50',
        orange: 'border-orange-100 bg-orange-50',
        blue: 'border-blue-100 bg-blue-50',
        purple: 'border-purple-100 bg-purple-50',
    };
    const base = colorClasses[color ?? ''] ?? 'border-zinc-100 bg-white';
    const Wrapper = href ? Link : 'div';

    return (
        <Wrapper {...(href ? { href } : {})} className={`rounded-xl border p-3 ${base} active:scale-[0.97] transition-transform`}>
            <div className="text-xs font-medium text-slate-500">{label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
        </Wrapper>
    );
}

function MovementIcon({ type }: { type: string }) {
    const icons: Record<string, string> = {
        order_reserved: '🔒',
        order_completed: '✅',
        order_cancelled: '↩️',
        restock_in: '📦',
        stock_adjustment: '✏️',
        initial_stock: '🏁',
    };
    return <span className="text-base">{icons[type] ?? '📋'}</span>;
}

function typeLabel(type: string): string {
    const labels: Record<string, string> = {
        order_reserved: 'Reserved',
        order_completed: 'Completed',
        order_cancelled: 'Cancelled',
        restock_in: 'Restock In',
        stock_adjustment: 'Adjustment',
        initial_stock: 'Initial',
    };
    return labels[type] ?? type;
}
