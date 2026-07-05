import { Head, Link } from '@inertiajs/react';
import { Package, QrCode, DollarSign } from 'lucide-react';
import OutletDashboardSkeleton from '@/components/outlet/outlet-dashboard-skeleton';
import OutletPageShell from '@/components/outlet/outlet-page-shell';
import EmptyState from '@/components/ui/empty-state';
import StatusBadge from '@/components/ui/status-badge';
import { useInertiaLoading } from '@/hooks/use-inertia-loading';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency } from '@/lib/format';
import { usePolling } from '@/lib/use-polling';

function getGreeting(): string {
    const hour = new Date().getHours();

    if (hour < 11) {
return 'Selamat pagi';
}

    if (hour < 15) {
return 'Selamat siang';
}

    if (hour < 18) {
return 'Selamat sore';
}

    return 'Selamat malam';
}

export default function OutletDashboard({ outlet, stats, deliveryStats, lowStockItems, settlementStats }: any) {
    usePolling(20000);
    const { loading } = useInertiaLoading();

    const todayOrders = stats.pendingOrders + stats.preparingOrders + stats.readyForCustomerPickup;
    const pendingTasks = stats.pendingOrders + deliveryStats.failed + deliveryStats.needsDispatch + lowStockItems.length;
    const hasActions = pendingTasks > 0;
    const hasActivity = todayOrders > 0 || pendingTasks > 0 || deliveryStats.completedToday > 0 || deliveryStats.inTransit > 0 || lowStockItems.length > 0;

    return (
        <OutletLayout title={outlet.name} subtitle={getGreeting()}>
            <Head title="Dashboard" />

            {loading ? (
                <div className="mt-4">
                    <OutletDashboardSkeleton />
                </div>
            ) : (
            <OutletPageShell>
            {/* Hero — stats + alerts */}
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex items-center justify-center">
                    <div className="flex items-center gap-3 text-center">
                        <div>
                            <div className="text-lg font-bold tabular-nums text-text">{todayOrders}</div>
                            <div className="text-[10px] text-text-subtle">Pesanan</div>
                        </div>
                        <div className="h-6 w-px bg-emerald-200" />
                        <div>
                            <div className="flex items-center justify-center gap-1">
                                {pendingTasks > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                                <div className={`text-lg font-bold tabular-nums ${pendingTasks > 0 ? 'text-text' : 'text-text-muted'}`}>{pendingTasks}</div>
                            </div>
                            <div className="text-[10px] text-text-subtle">Tugas</div>
                        </div>
                    </div>
                </div>

                {/* Inline alerts — only when urgent */}
                {hasActions && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {stats.pendingOrders > 0 && (
                            <Link href="/outlet/orders?status=pending_confirmation" className="inline-flex items-center gap-1.5 rounded-lg bg-white/70 px-2.5 py-1.5 text-[11px] font-semibold text-text active:opacity-80">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                {stats.pendingOrders} Baru
                            </Link>
                        )}
                        {deliveryStats.needsDispatch > 0 && (
                            <Link href="/outlet/deliveries" className="inline-flex items-center gap-1.5 rounded-lg bg-white/70 px-2.5 py-1.5 text-[11px] font-semibold text-text active:opacity-80">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                                {deliveryStats.needsDispatch} Dikirim
                            </Link>
                        )}
                        {deliveryStats.failed > 0 && (
                            <Link href="/outlet/deliveries?status=failed" className="inline-flex items-center gap-1.5 rounded-lg bg-white/70 px-2.5 py-1.5 text-[11px] font-semibold text-text active:opacity-80">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                                {deliveryStats.failed} Gagal
                            </Link>
                        )}
                        {lowStockItems.length > 0 && (
                            <Link href="/outlet/inventory" className="inline-flex items-center gap-1.5 rounded-lg bg-white/70 px-2.5 py-1.5 text-[11px] font-semibold text-text active:opacity-80">
                                <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                                {lowStockItems.length} Stok Rendah
                            </Link>
                        )}
                    </div>
                )}
            </div>

            {/* QR Scan — one big button */}
            <Link
                href="/outlet/scan"
                className="mb-4 flex items-center justify-center gap-3 rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-white transition-all active:opacity-80"
            >
                <QrCode className="h-5 w-5" />
                Scan QR Ambil Pesanan
            </Link>

            {/* Settlement Summary — financial obligation at a glance */}
            {settlementStats && (settlementStats.outstanding > 0 || settlementStats.margin > 0) && (
                <Link
                    href="/outlet/settlement"
                    className="mb-4 block rounded-xl border border-border bg-white"
                >
                    {settlementStats.outstanding > 0 ? (
                        /* Outstanding — urgent red card */
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Belum Disetor</div>
                                    <div className="mt-1 text-2xl font-bold tabular-nums text-red-600">
                                        {formatCurrency(settlementStats.outstanding)}
                                    </div>
                                </div>
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                                    <DollarSign className="h-5 w-5 text-red-600" />
                                </div>
                            </div>
                            <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-red-700">
                                <span>Ketuk untuk lihat detail & bayar</span>
                                <span>→</span>
                            </div>
                        </div>
                    ) : (
                        /* All paid — subtle green indicator */
                        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                            <div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Settlement</div>
                                <div className="mt-0.5 text-sm font-semibold text-emerald-700">Semua lunas</div>
                            </div>
                            <div className="flex items-center gap-3">
                                {settlementStats.margin > 0 && (
                                    <div className="text-right">
                                        <div className="text-[11px] text-text-subtle">Margin</div>
                                        <div className="text-sm font-bold tabular-nums text-emerald-700">{formatCurrency(settlementStats.margin)}</div>
                                    </div>
                                )}
                                <svg className="h-5 w-5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </div>
                    )}
                </Link>
            )}

            {/* Stats — compact grid */}
            <div className="rounded-xl border border-border bg-white p-4">
                <div className="grid grid-cols-4 gap-2">
                    <StatCell label="Baru" value={stats.pendingOrders} alert={stats.pendingOrders > 0} />
                    <StatCell label="Proses" value={stats.preparingOrders} />
                    <StatCell label="Siap" value={stats.readyForCustomerPickup} />
                    <StatCell label="Selesai" value={deliveryStats.completedToday} />
                </div>
                <div className="my-2.5 h-px bg-border" />
                <div className="grid grid-cols-3 gap-2">
                    <StatCell label="Dikirim" value={deliveryStats.inTransit} />
                    <StatCell label="Kurir" value={deliveryStats.waitingPickup} />
                    <StatCell label="Gagal" value={deliveryStats.failed} alert={deliveryStats.failed > 0} />
                </div>
                <Link href="/outlet/orders" className="mt-2.5 flex min-h-11 items-center justify-center text-xs font-semibold text-primary">
                    Lihat Semua Pesanan →
                </Link>
            </div>

            {/* Low Stock — flat list, not cards */}
            {lowStockItems.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-subtle">Stok Rendah</h2>
                        <Link href="/outlet/inventory" className="flex min-h-11 items-center text-[11px] font-semibold text-primary">Lihat Semua</Link>
                    </div>
                    <div className="divide-y divide-border rounded-xl border border-border bg-white">
                        {lowStockItems.slice(0, 3).map((item: any) => (
                            <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                                <div className="min-w-0">
                                    <div className="text-sm font-medium text-text truncate">{item.product?.name}</div>
                                    <div className="text-[11px] text-text-subtle">Tersedia: {item.current_stock - item.reserved_stock} / Min: {item.minimum_stock}</div>
                                </div>
                                <StatusBadge variant={item.current_stock - item.reserved_stock <= 0 ? 'danger' : 'warning'} size="sm">
                                    {item.current_stock - item.reserved_stock <= 0 ? 'Kritis' : 'Rendah'}
                                </StatusBadge>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!hasActivity && (
                <EmptyState
                    icon={<Package className="h-8 w-8 text-text-subtle" />}
                    title="Tidak ada aktivitas"
                    description="Belum ada pesanan atau tugas hari ini."
                />
            )}
            </OutletPageShell>
            )}
        </OutletLayout>
    );
}

function StatCell({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
    return (
        <div className="text-center">
            <div className="flex items-center justify-center gap-1">
                {alert && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                <div className={`text-lg font-bold tabular-nums ${alert ? 'text-text' : 'text-text-muted'}`}>{value}</div>
            </div>
            <div className="text-[10px] font-medium text-text-subtle">{label}</div>
        </div>
    );
}
