import { Head, Link, router, usePage } from '@inertiajs/react';
import ActivityFeed from '@/components/owner/activity-feed-card';
import KpiCard from '@/components/owner/kpi-card';
import OperationalAlertCard, { AlertTruckIcon, AlertInventoryIcon, AlertRestockIcon } from '@/components/owner/operational-alert-card';
import OutletHealthCard from '@/components/owner/outlet-health-card';
import OwnerBottomNav from '@/components/owner/owner-bottom-nav';
import QuickActionCard from '@/components/owner/quick-action-card';
import OfflineBanner from '@/components/offline-banner';
import OwnerLayout from '@/layouts/owner-layout';
import { confirmLogout } from '@/lib/confirm-logout';
import { usePolling } from '@/lib/use-polling';

export default function Dashboard({ stats, deliveryStats, alerts, recentActivity }: any) {
    usePolling(30000);

    return (
        <>
            {/* Desktop: use existing sidebar layout */}
            <div className="hidden lg:block">
                <OwnerLayout>
                    <DesktopDashboard stats={stats} deliveryStats={deliveryStats} alerts={alerts} recentActivity={recentActivity} />
                </OwnerLayout>
            </div>

            {/* Mobile: dedicated operational mobile UI */}
            <div className="lg:hidden">
                <MobileDashboard stats={stats} deliveryStats={deliveryStats} alerts={alerts} recentActivity={recentActivity} />
            </div>
        </>
    );
}

function MobileDashboard({ stats, deliveryStats, alerts, recentActivity }: any) {
    const hasAlerts = alerts.failedDeliveries.length > 0 || alerts.lowStockItems.length > 0 || alerts.pendingRestocks.length > 0;

    // Build activity feed items
    const activityItems = recentActivity.slice(0, 5).map((m: any) => ({
        id: m.id,
        title: `${m.product?.name ?? 'Produk'} ${activityVerb(m.type)}`,
        subtitle: `${timeAgo(m.created_at)} · ${m.outlet?.name ?? ''}`,
        color: activityColor(m.type),
    }));

    // Build outlet health from low stock data
    const outletHealth = buildOutletHealth(alerts.lowStockItems, stats.activeOutlets);

    return (
        <div className="min-h-dvh bg-slate-50 text-slate-900">
            <Head title="Owner Dashboard" />
            <OfflineBanner />

            <DashboardGreeting />

            <main className="px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
                {/* Operational Alerts */}
                {hasAlerts && (
                    <section>
                        <SectionLabel>Operational Alerts</SectionLabel>
                        <div className="mt-2 space-y-2">
                            {alerts.failedDeliveries.length > 0 && (
                                <OperationalAlertCard
                                    href="/owner/deliveries?status=failed"
                                    icon={<AlertTruckIcon />}
                                    title={`${alerts.failedDeliveries.length} Failed Deliveries`}
                                    subtitle="Immediate operational action required"
                                    count={alerts.failedDeliveries.length}
                                    severity="critical"
                                />
                            )}
                            {alerts.lowStockItems.length > 0 && (
                                <OperationalAlertCard
                                    href="/owner/inventories"
                                    icon={<AlertInventoryIcon />}
                                    title={`${alerts.lowStockItems.length} Low Stock Outlets`}
                                    subtitle="Available stock below minimum threshold"
                                    count={alerts.lowStockItems.length}
                                    severity="warning"
                                />
                            )}
                            {alerts.pendingRestocks.length > 0 && (
                                <OperationalAlertCard
                                    href="/owner/restocks?status=requested"
                                    icon={<AlertRestockIcon />}
                                    title={`${alerts.pendingRestocks.length} Restock Pending`}
                                    subtitle="Awaiting approval"
                                    count={alerts.pendingRestocks.length}
                                    severity="info"
                                />
                            )}
                        </div>
                    </section>
                )}

                {/* KPI Grid */}
                <section className={hasAlerts ? 'mt-6' : ''}>
                    <SectionLabel>Performance Overview</SectionLabel>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                        <KpiCard label="Total Order" value={stats.todayOrders + stats.activeOrders} href="/owner/orders" color="emerald" progress={70} />
                        <KpiCard label="Aktif Delivery" value={stats.activeDeliveries} href="/owner/deliveries" color="blue" progress={stats.activeDeliveries > 0 ? 50 : 0} />
                        <KpiCard label="Restock Pending" value={stats.pendingRestocks} href="/owner/restocks?status=requested" color="amber" progress={stats.pendingRestocks > 0 ? 30 : 0} />
                        <KpiCard label="Stok Rendah" value={stats.lowStocks} href="/owner/inventories" color="red" progress={stats.lowStocks > 0 ? Math.min(100, stats.lowStocks * 15) : 0} />
                    </div>
                </section>

                {/* Delivery KPIs */}
                <section className="mt-6">
                    <div className="flex items-center justify-between">
                        <SectionLabel>Delivery Operations</SectionLabel>
                        <Link href="/owner/deliveries/board" className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Board</Link>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                        <KpiCard label="Menunggu Kurir" value={deliveryStats.waitingForCourier} href="/owner/deliveries/board" color="amber" progress={deliveryStats.waitingForCourier > 0 ? 40 : 0} />
                        <KpiCard label="Dalam Perjalanan" value={deliveryStats.inTransit} href="/owner/deliveries/board" color="blue" progress={deliveryStats.inTransit > 0 ? 50 : 0} />
                        <KpiCard label="Terlambat" value={deliveryStats.late} href="/owner/deliveries/board" color="red" progress={deliveryStats.late > 0 ? 80 : 0} />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        <KpiCard label="Gagal" value={deliveryStats.failed} href="/owner/deliveries?status=failed" color="red" progress={deliveryStats.failed > 0 ? 60 : 0} />
                        <KpiCard label="Selesai Hari Ini" value={deliveryStats.completedToday} href="/owner/deliveries/board" color="emerald" progress={deliveryStats.completedToday > 0 ? 70 : 0} />
                    </div>
                </section>

                {/* Recent Activity */}
                {activityItems.length > 0 && (
                    <section className="mt-6">
                        <div className="flex items-center justify-between">
                            <SectionLabel>Recent Activity</SectionLabel>
                            <Link href="/owner/stock-movements" className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Lihat Semua</Link>
                        </div>
                        <div className="mt-3">
                            <ActivityFeed items={activityItems} />
                        </div>
                    </section>
                )}

                {/* Outlet Health */}
                {outletHealth.length > 0 && (
                    <section className="mt-6">
                        <SectionLabel>Outlet Health</SectionLabel>
                        <div className="mt-2 flex gap-3 overflow-x-auto scrollbar-none pb-1">
                            {outletHealth.map((outlet) => (
                                <OutletHealthCard key={outlet.id} outlet={outlet} />
                            ))}
                        </div>
                    </section>
                )}

                {/* Quick Actions */}
                <section className="mt-6">
                    <SectionLabel>Quick Actions</SectionLabel>
                    <div className="mt-2 grid grid-cols-3 gap-3">
                        <QuickActionCard href="/owner/orders" label="Manage Orders" icon={<OrdersIcon />} />
                        <QuickActionCard href="/owner/stock-movements" label="Inventory Audit" icon={<AuditIcon />} />
                        <QuickActionCard href="/owner/restocks?status=requested" label="Restock Requests" icon={<RestockIcon />} />
                    </div>
                </section>
            </main>

            <OwnerBottomNav />
        </div>
    );
}

function DesktopDashboard({ stats, deliveryStats, alerts, recentActivity }: any) {
    return (
        <>
            <Head title="Owner Dashboard" />
            <h1 className="text-xl font-semibold">Dashboard</h1>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard label="Order Hari Ini" value={stats.todayOrders} href="/owner/orders" color="emerald" />
                <KpiCard label="Active Delivery" value={stats.activeDeliveries} href="/owner/deliveries" color="blue" />
                <KpiCard label="Restock Pending" value={stats.pendingRestocks} href="/owner/restocks?status=requested" color="amber" />
                <KpiCard label="Stok Rendah" value={stats.lowStocks} href="/owner/inventories" color="red" />
            </div>

            {/* Delivery KPIs */}
            <div className="mt-5">
                <h2 className="text-sm font-semibold text-slate-700">Delivery Operations</h2>
                <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
                    <KpiCard label="Menunggu Kurir" value={deliveryStats.waitingForCourier} href="/owner/deliveries/board" color="amber" />
                    <KpiCard label="Dalam Perjalanan" value={deliveryStats.inTransit} href="/owner/deliveries/board" color="blue" />
                    <KpiCard label="Terlambat" value={deliveryStats.late} href="/owner/deliveries/board" color="red" />
                    <KpiCard label="Gagal" value={deliveryStats.failed} href="/owner/deliveries?status=failed" color="red" />
                    <KpiCard label="Selesai Hari Ini" value={deliveryStats.completedToday} href="/owner/deliveries/board" color="emerald" />
                </div>
            </div>

            {alerts.failedDeliveries.length > 0 && (
                <Link href="/owner/deliveries/board" className="mt-4 block rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
                    {alerts.failedDeliveries.length} delivery gagal perlu ditindak
                </Link>
            )}
        </>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{children}</h2>;
}

// Helpers
function activityVerb(type: string): string {
    const verbs: Record<string, string> = { order_completed: 'Selesai', order_reserved: 'Reserved', order_cancelled: 'Dibatalkan', restock_in: 'Diterima', stock_adjustment: 'Diupdate', initial_stock: 'Diinisialisasi' };
    return verbs[type] ?? 'Diproses';
}

function activityColor(type: string): 'emerald' | 'blue' | 'red' | 'amber' | 'slate' {
    const colors: Record<string, any> = { order_completed: 'emerald', order_reserved: 'blue', order_cancelled: 'red', restock_in: 'emerald', stock_adjustment: 'amber', initial_stock: 'slate' };
    return colors[type] ?? 'slate';
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Baru saja';
    if (mins < 60) return `${mins} menit lalu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} jam lalu`;
    return `${Math.floor(hours / 24)} hari lalu`;
}

function buildOutletHealth(lowStockItems: any[], totalOutlets: number) {
    const outletMap = new Map<number, { id: number; name: string; lowCount: number }>();
    for (const item of lowStockItems) {
        if (!item.outlet) continue;
        const existing = outletMap.get(item.outlet.id);
        if (existing) { existing.lowCount++; } else { outletMap.set(item.outlet.id, { id: item.outlet.id, name: item.outlet.name, lowCount: 1 }); }
    }
    return Array.from(outletMap.values()).map((o) => ({
        id: o.id,
        name: o.name,
        status: (o.lowCount >= 3 ? 'critical' : o.lowCount >= 1 ? 'low_stock' : 'stable') as 'stable' | 'low_stock' | 'critical',
        stockPercent: Math.max(10, 100 - o.lowCount * 25),
        updatedAgo: 'Baru saja',
    }));
}

function OrdersIcon() { return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>; }
function AuditIcon() { return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>; }
function RestockIcon() { return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>; }


function DashboardGreeting() {
    const { auth } = usePage<any>().props;
    const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

    return (
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)]">
            <div className="flex min-h-14 items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-sm font-bold text-white">
                        {auth?.user?.name?.charAt(0)?.toUpperCase() ?? 'O'}
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-slate-900">Halo, {auth?.user?.name?.split(' ')[0] ?? 'Owner'}</div>
                        <div className="text-[11px] text-slate-500">{today}</div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    </div>
                    <button onClick={() => confirmLogout()} aria-label="Logout" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-all duration-150 active:scale-[0.98] active:bg-slate-50 active:text-red-600">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </button>
                </div>
            </div>
        </header>
    );
}
