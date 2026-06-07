import { Head, Link, usePage } from '@inertiajs/react';
import ActivityFeed from '@/components/owner/activity-feed-card';
import CourierLeaderboardCard from '@/components/owner/courier-leaderboard-card';
import DeliveryHealthScoreCard from '@/components/owner/delivery-health-score-card';
import FailureReasonsCard from '@/components/owner/failure-reasons-card';
import KpiCard from '@/components/owner/kpi-card';
import OldestDeliveriesCard from '@/components/owner/oldest-deliveries-card';
import OperationalAlertCard, { AlertTruckIcon, AlertInventoryIcon, AlertRestockIcon, AlertReturnIcon, AlertExchangeIcon } from '@/components/owner/operational-alert-card';
import OutletHealthCard from '@/components/owner/outlet-health-card';
import OwnerBottomNav from '@/components/owner/owner-bottom-nav';
import QuickActionCard from '@/components/owner/quick-action-card';
import SlaViolationsCard from '@/components/owner/sla-violations-card';
import SectionCard from '@/components/ui/section-card';
import EmptyState from '@/components/ui/empty-state';
import OfflineBanner from '@/components/offline-banner';
import OwnerLayout from '@/layouts/owner-layout';
import { confirmLogout } from '@/lib/confirm-logout';
import { usePolling } from '@/lib/use-polling';

export default function Dashboard({ stats, deliveryStats, intelligence, alerts, recentActivity }: any) {
    usePolling(30000);

    return (
        <>
            <div className="hidden lg:block">
                <OwnerLayout>
                    <DesktopDashboard stats={stats} deliveryStats={deliveryStats} intelligence={intelligence} alerts={alerts} recentActivity={recentActivity} />
                </OwnerLayout>
            </div>
            <div className="lg:hidden">
                <MobileDashboard stats={stats} deliveryStats={deliveryStats} intelligence={intelligence} alerts={alerts} recentActivity={recentActivity} />
            </div>
        </>
    );
}

function MobileDashboard({ stats, deliveryStats, intelligence, alerts, recentActivity }: any) {
    const hasAlerts = alerts.failedDeliveries.length > 0 || alerts.lowStockItems.length > 0 || alerts.pendingRestocks.length > 0 || alerts.pendingReturns.length > 0 || alerts.pendingExchanges.length > 0;

    const activityItems = recentActivity.slice(0, 5).map((m: any) => ({
        id: m.id,
        title: `${m.product?.name ?? 'Produk'} ${activityVerb(m.type)}`,
        subtitle: `${timeAgo(m.created_at)} · ${m.outlet?.name ?? ''}`,
        color: activityColor(m.type),
    }));

    const outletHealth = buildOutletHealth(alerts.lowStockItems, stats.activeOutlets);

    return (
        <div className="min-h-dvh bg-slate-50 text-slate-900">
            <Head title="Owner Dashboard" />
            <OfflineBanner />
            <DashboardGreeting />

            <main className="px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
                {intelligence?.healthScore && (
                    <section>
                        <DeliveryHealthScoreCard health={intelligence.healthScore} />
                    </section>
                )}

                {hasAlerts && (
                    <section className="mt-4">
                        <SectionLabel>Operational Alerts</SectionLabel>
                        <div className="mt-2 space-y-2">
                            {alerts.failedDeliveries.length > 0 && (
                                <OperationalAlertCard href="/owner/deliveries?status=failed" icon={<AlertTruckIcon />} title={`${alerts.failedDeliveries.length} Failed Deliveries`} subtitle="Immediate operational action required" count={alerts.failedDeliveries.length} severity="critical" />
                            )}
                            {alerts.lowStockItems.length > 0 && (
                                <OperationalAlertCard href="/owner/inventories" icon={<AlertInventoryIcon />} title={`${alerts.lowStockItems.length} Low Stock Outlets`} subtitle="Available stock below minimum threshold" count={alerts.lowStockItems.length} severity="warning" />
                            )}
                            {alerts.pendingRestocks.length > 0 && (
                                <OperationalAlertCard href="/owner/restocks?status=requested" icon={<AlertRestockIcon />} title={`${alerts.pendingRestocks.length} Restock Pending`} subtitle="Awaiting approval" count={alerts.pendingRestocks.length} severity="info" />
                            )}
                            {alerts.pendingReturns.map((item: any) => (
                                <OperationalAlertCard
                                    key={`return-${item.id}`}
                                    href={`/owner/returns/${item.id}`}
                                    icon={<AlertReturnIcon />}
                                    title={`${item.outlet?.name} Return Request`}
                                    subtitle={`${firstVariantLabel(item.items)} · ${formatCompactQuantity(item.items)}`}
                                    severity="warning"
                                />
                            ))}
                            {alerts.pendingExchanges.map((item: any) => (
                                <OperationalAlertCard
                                    key={`exchange-${item.id}`}
                                    href={`/owner/exchanges/${item.id}`}
                                    icon={<AlertExchangeIcon />}
                                    title={`${item.outlet?.name} Exchange Request`}
                                    subtitle={`${firstVariantLabel(item.items)} · ${formatCompactQuantity(item.items)}`}
                                    severity="info"
                                />
                            ))}
                        </div>
                    </section>
                )}

                <section className={hasAlerts ? 'mt-6' : 'mt-4'}>
                    <SectionLabel>Performance Overview</SectionLabel>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                        <KpiCard label="Total Order" value={stats.todayOrders + stats.activeOrders} href="/owner/orders" color="emerald" progress={70} />
                        <KpiCard label="Aktif Delivery" value={stats.activeDeliveries} href="/owner/deliveries" color="blue" progress={stats.activeDeliveries > 0 ? 50 : 0} />
                        <KpiCard label="Restock Pending" value={stats.pendingRestocks} href="/owner/restocks?status=requested" color="amber" progress={stats.pendingRestocks > 0 ? 30 : 0} />
                        <KpiCard label="Pending Returns" value={stats.pendingReturns} href="/owner/returns?status=submitted" color="amber" progress={stats.pendingReturns > 0 ? 45 : 0} />
                        <KpiCard label="Pending Exchanges" value={stats.pendingExchanges} href="/owner/exchanges?status=submitted" color="blue" progress={stats.pendingExchanges > 0 ? 45 : 0} />
                        <KpiCard label="Stok Rendah" value={stats.lowStocks} href="/owner/inventories" color="red" progress={stats.lowStocks > 0 ? Math.min(100, stats.lowStocks * 15) : 0} />
                    </div>
                </section>

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

                {intelligence?.slaViolations && (
                    <section className="mt-6">
                        <SlaViolationsCard violations={intelligence.slaViolations} />
                    </section>
                )}

                {intelligence?.oldestDeliveries && intelligence.oldestDeliveries.length > 0 && (
                    <section className="mt-6">
                        <OldestDeliveriesCard deliveries={intelligence.oldestDeliveries} />
                    </section>
                )}

                {intelligence?.failureReasons && intelligence.failureReasons.length > 0 && (
                    <section className="mt-6">
                        <FailureReasonsCard reasons={intelligence.failureReasons} />
                    </section>
                )}

                {intelligence?.courierLeaderboard && intelligence.courierLeaderboard.length > 0 && (
                    <section className="mt-6">
                        <CourierLeaderboardCard couriers={intelligence.courierLeaderboard} />
                    </section>
                )}

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

                <section className="mt-6">
                    <SectionLabel>Quick Actions</SectionLabel>
                    <div className="mt-2 grid grid-cols-3 gap-3">
                        <QuickActionCard href="/owner/orders" label="Manage Orders" icon={<OrdersIcon />} />
                        <QuickActionCard href="/owner/stock-movements" label="Inventory Audit" icon={<AuditIcon />} />
                        <QuickActionCard href="/owner/restocks?status=requested" label="Restock Requests" icon={<RestockIcon />} />
                        <QuickActionCard href="/owner/returns?status=submitted" label="Review Returns" icon={<ReturnsIcon />} />
                        <QuickActionCard href="/owner/exchanges?status=submitted" label="Review Exchanges" icon={<ExchangeIcon />} />
                    </div>
                </section>
            </main>

            <OwnerBottomNav />
        </div>
    );
}

function DesktopDashboard({ stats, deliveryStats, intelligence, alerts, recentActivity }: any) {
    const hasAlerts = alerts.failedDeliveries.length > 0 || alerts.lowStockItems.length > 0 || alerts.pendingRestocks.length > 0 || alerts.pendingReturns.length > 0 || alerts.pendingExchanges.length > 0;

    const activityItems = recentActivity.slice(0, 8).map((m: any) => ({
        id: m.id,
        title: `${m.product?.name ?? 'Produk'} ${activityVerb(m.type)}`,
        subtitle: `${timeAgo(m.created_at)} · ${m.outlet?.name ?? ''}`,
        color: activityColor(m.type),
    }));

    const outletHealth = buildOutletHealth(alerts.lowStockItems, stats.activeOutlets);

    return (
        <>
            <Head title="Owner Dashboard" />

            {/* Row 1: Business KPIs */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
                <KpiCard label="Order Hari Ini" value={stats.todayOrders} href="/owner/orders" color="emerald" />
                <KpiCard label="Active Delivery" value={stats.activeDeliveries} href="/owner/deliveries" color="blue" />
                <KpiCard label="Restock Pending" value={stats.pendingRestocks} href="/owner/restocks?status=requested" color="amber" />
                <KpiCard label="Pending Returns" value={stats.pendingReturns} href="/owner/returns?status=submitted" color="amber" />
                <KpiCard label="Pending Exchanges" value={stats.pendingExchanges} href="/owner/exchanges?status=submitted" color="blue" />
                <KpiCard label="Stok Rendah" value={stats.lowStocks} href="/owner/inventories" color="red" />
            </div>
            {intelligence?.healthScore && (
                <div className="mt-4">
                    <DeliveryHealthScoreCard health={intelligence.healthScore} />
                </div>
            )}

            {/* Row 2: Operational Alerts + Delivery Health */}
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Operational Alerts */}
                <SectionCard label="Operational Alerts">
                    {hasAlerts ? (
                        <div className="mt-2 space-y-2">
                            {alerts.failedDeliveries.length > 0 && (
                                <OperationalAlertCard href="/owner/deliveries?status=failed" icon={<AlertTruckIcon />} title={`${alerts.failedDeliveries.length} Failed Deliveries`} subtitle="Immediate action required" count={alerts.failedDeliveries.length} severity="critical" />
                            )}
                            {alerts.lowStockItems.length > 0 && (
                                <OperationalAlertCard href="/owner/inventories" icon={<AlertInventoryIcon />} title={`${alerts.lowStockItems.length} Low Stock`} subtitle="Below minimum threshold" count={alerts.lowStockItems.length} severity="warning" />
                            )}
                            {alerts.pendingRestocks.length > 0 && (
                                <OperationalAlertCard href="/owner/restocks?status=requested" icon={<AlertRestockIcon />} title={`${alerts.pendingRestocks.length} Restock Pending`} subtitle="Awaiting approval" count={alerts.pendingRestocks.length} severity="info" />
                            )}
                            {alerts.pendingReturns.map((item: any) => (
                                <OperationalAlertCard
                                    key={`desktop-return-${item.id}`}
                                    href={`/owner/returns/${item.id}`}
                                    icon={<AlertReturnIcon />}
                                    title={`${item.outlet?.name} Return Request`}
                                    subtitle={`${firstVariantLabel(item.items)} · ${formatCompactQuantity(item.items)}`}
                                    severity="warning"
                                />
                            ))}
                            {alerts.pendingExchanges.map((item: any) => (
                                <OperationalAlertCard
                                    key={`desktop-exchange-${item.id}`}
                                    href={`/owner/exchanges/${item.id}`}
                                    icon={<AlertExchangeIcon />}
                                    title={`${item.outlet?.name} Exchange Request`}
                                    subtitle={`${firstVariantLabel(item.items)} · ${formatCompactQuantity(item.items)}`}
                                    severity="info"
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="mt-2 text-xs text-slate-400">No alerts</div>
                    )}
                </SectionCard>

                {/* Delivery KPIs */}
                <SectionCard label="Delivery Operations" labelRight={<Link href="/owner/deliveries/board" className="text-[11px] font-bold text-emerald-700">Board</Link>}>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                        <MiniKpi label="Menunggu" value={deliveryStats.waitingForCourier} color="amber" />
                        <MiniKpi label="Dalam Perjalanan" value={deliveryStats.inTransit} color="blue" />
                        <MiniKpi label="Terlambat" value={deliveryStats.late} color="red" />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        <MiniKpi label="Gagal" value={deliveryStats.failed} color="red" />
                        <MiniKpi label="Selesai Hari Ini" value={deliveryStats.completedToday} color="emerald" />
                    </div>
                </SectionCard>

                {/* Inventory Health */}
                <SectionCard label="Inventory Health">
                    {outletHealth.length > 0 ? (
                        <div className="mt-2 flex gap-2 overflow-x-auto scrollbar-none pb-1">
                            {outletHealth.map((outlet) => (
                                <OutletHealthCard key={outlet.id} outlet={outlet} />
                            ))}
                        </div>
                    ) : (
                        <div className="mt-2 text-xs text-slate-400">All outlets healthy</div>
                    )}
                </SectionCard>
            </div>

            {/* Row 3: Intelligence + Activity */}
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Left: Intelligence */}
                <div className="space-y-4">
                    {intelligence?.slaViolations && <SlaViolationsCard violations={intelligence.slaViolations} />}
                    {intelligence?.oldestDeliveries && intelligence.oldestDeliveries.length > 0 && <OldestDeliveriesCard deliveries={intelligence.oldestDeliveries} />}
                    {intelligence?.failureReasons && intelligence.failureReasons.length > 0 && <FailureReasonsCard reasons={intelligence.failureReasons} />}
                </div>

                {/* Right: Activity + Leaderboard */}
                <div className="space-y-4">
                    {intelligence?.courierLeaderboard && intelligence.courierLeaderboard.length > 0 && <CourierLeaderboardCard couriers={intelligence.courierLeaderboard} />}
                    {activityItems.length > 0 && (
                        <SectionCard label="Recent Activity" labelRight={<Link href="/owner/stock-movements" className="text-[11px] font-bold text-emerald-700">Lihat Semua</Link>}>
                            <div className="mt-2">
                                <ActivityFeed items={activityItems} />
                            </div>
                        </SectionCard>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-4 flex gap-3">
                <Link href="/owner/orders" className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-zinc-50">
                    <OrdersIcon /> Manage Orders
                </Link>
                <Link href="/owner/deliveries/board" className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-zinc-50">
                    <TruckIcon /> Delivery Board
                </Link>
                <Link href="/owner/inventories" className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-zinc-50">
                    <InventoryIcon /> Inventory
                </Link>
                <Link href="/owner/reports" className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-zinc-50">
                    <ReportsIcon /> Reports
                </Link>
                <Link href="/owner/returns?status=submitted" className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-zinc-50">
                    <ReturnsIcon /> Returns
                </Link>
                <Link href="/owner/exchanges?status=submitted" className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-zinc-50">
                    <ExchangeIcon /> Exchanges
                </Link>
            </div>
        </>
    );
}

// ─── Helpers ──────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
    return <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{children}</h2>;
}

function MiniKpi({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-2 text-center">
            <div className={`text-lg font-bold ${color === 'red' && value > 0 ? 'text-red-600' : 'text-slate-900'}`}>{value}</div>
            <div className="text-[10px] font-medium text-slate-500">{label}</div>
        </div>
    );
}

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

function firstVariantLabel(items: any[] = []): string {
    const first = items[0];
    return first?.variant?.full_name ?? first?.variant?.name ?? 'Produk';
}

function formatCompactQuantity(items: any[] = []): string {
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
    return `x${totalQuantity}`;
}

function buildOutletHealth(lowStockItems: any[], _totalOutlets: number) {
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

function ReturnsIcon() {
    return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10M7 12h10M7 17h6M7 3v4m0 0l-3-3m3 3l3-3M5 21h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
}

function ExchangeIcon() {
    return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7h11m0 0l-3-3m3 3l-3 3M20 17H9m0 0l3-3m-3 3l3 3" /></svg>;
}

function OrdersIcon() { return <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>; }
function AuditIcon() { return <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>; }
function RestockIcon() { return <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>; }
function TruckIcon() { return <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>; }
function InventoryIcon() { return <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>; }
function ReportsIcon() { return <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>; }

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
