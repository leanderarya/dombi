import { Link } from '@inertiajs/react';
import { AlertTriangle, Package, RotateCcw, ArrowLeftRight, CreditCard, ChevronRight, TrendingDown, CheckCircle2 } from 'lucide-react';
import OwnerDashboardSkeleton from '@/components/owner/owner-dashboard-skeleton';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { formatCurrency } from '@/lib/format';
import { usePolling } from '@/lib/use-polling';

interface DashboardProps {
    hero: {
        outstandingAmount: number;
        subtitle: string;
        ctaLabel: string;
        ctaHref: string;
    };
    kpis: {
        outstandingAmount: number;
        pendingActions: number;
        criticalStock: number;
    };
    actionRequired: {
        restocks: number;
        returns: number;
        exchanges: number;
        pendingSettlementVerifications: number;
    };
    settlementAlerts: Array<{
        outlet: {
            id: number;
            name: string;
        };
        outstandingAmount: number;
        daysOverdue: number;
        detailHref: string;
    }>;
    inventoryRisks: Array<{
        variant: {
            id: number;
            name: string;
            full_name: string;
            family_name: string | null;
        };
        centerStock: number;
        threshold: number;
        shortage: number;
        detailHref: string;
    }>;
}

export default function Dashboard({
    hero,
    kpis,
    actionRequired,
    settlementAlerts,
    inventoryRisks,
}: DashboardProps) {
    usePolling(30000, ['hero', 'kpis', 'actionRequired', 'settlementAlerts', 'inventoryRisks']);

    if (!hero || !kpis || !actionRequired) {
        return (
            <OwnerPageShell title="Dasbor" subtitle="Ringkasan operasional hari ini">
                <OwnerDashboardSkeleton />
            </OwnerPageShell>
        );
    }

    const totalPendingActions = actionRequired.restocks + actionRequired.returns + actionRequired.exchanges + actionRequired.pendingSettlementVerifications;

    return (
        <OwnerPageShell
            title="Dasbor"
            subtitle="Ringkasan operasional hari ini"
        >
            {/* Hero Bar — only when there is outstanding debt */}
            {hero.outstandingAmount > 0 && (
                <Link
                    href={hero.ctaHref}
                    className="group relative mb-4 block overflow-hidden rounded-lg bg-linear-to-br from-primary to-primary-hover px-4 py-3 text-white transition-all duration-200"
                >
                    <div className="relative">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider opacity-70">
                            <TrendingDown className="h-3.5 w-3.5" />
                            Tagihan Tertunggak
                        </div>
                        <div className="mt-1 text-xl font-bold tabular-nums tracking-tight">
                            {formatCurrency(hero.outstandingAmount)}
                        </div>
                        <div className="mt-1 text-sm opacity-80">
                            {hero.subtitle}
                        </div>
                        <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold transition-transform duration-200 group-hover:translate-x-1">
                            {hero.ctaLabel}
                            <span aria-hidden="true">&rarr;</span>
                        </div>
                    </div>
                    <div className="pointer-events-none absolute inset-0 bg-white/0 transition-colors duration-300 group-hover:bg-white/4" />
                </Link>
            )}

            {/* KPI horizontal strip */}
            <OwnerKpiStrip items={[
                { label: 'Tagihan', value: formatCurrency(kpis.outstandingAmount), sublabel: `${settlementAlerts.length} outlet`, sublabelColor: 'text-blue-600', href: '/owner/finance' },
                { label: 'Tindakan', value: totalPendingActions, sublabel: `${actionRequired.restocks} restock`, sublabelColor: 'text-amber-600', href: '#actions' },
                { label: 'Stok Kritis', value: kpis.criticalStock, valueClassName: kpis.criticalStock > 0 ? 'text-red-600' : 'text-text', sublabel: kpis.criticalStock > 0 ? 'SKU perlu restock' : 'Semua aman', sublabelColor: kpis.criticalStock > 0 ? 'text-red-600' : 'text-emerald-600', href: '/owner/inventories?filter=critical' },
            ]} />

            {/* 2-column grid for Actions + Stok Kritis */}
            <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Butuh Tindakan */}
                <div>
                    <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-text-muted">Butuh Tindakan</span>
                        {totalPendingActions > 0 && (
                            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-bold text-text-muted">{totalPendingActions}</span>
                        )}
                    </div>
                    <div className="space-y-2">
                        {actionRequired.restocks > 0 && (
                            <Link href="/owner/restocks?status=requested" className="group flex items-center justify-between rounded-md bg-surface px-3 py-2 transition-colors hover:bg-surface-muted">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex h-6 w-6 items-center justify-center rounded bg-amber-100 text-amber-600"><Package className="h-3.5 w-3.5" /></div>
                                    <div>
                                        <div className="text-sm font-medium text-text">Restock</div>
                                        <div className="text-xs text-text-muted">{actionRequired.restocks} menunggu</div>
                                    </div>
                                </div>
                                <ChevronRight className="h-3.5 w-3.5 text-text-subtle" />
                            </Link>
                        )}
                        {actionRequired.returns > 0 && (
                            <Link href="/owner/returns?status=submitted" className="group flex items-center justify-between rounded-md bg-surface px-3 py-2 transition-colors hover:bg-surface-muted">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex h-6 w-6 items-center justify-center rounded bg-amber-100 text-amber-600"><RotateCcw className="h-3.5 w-3.5" /></div>
                                    <div>
                                        <div className="text-sm font-medium text-text">Return</div>
                                        <div className="text-xs text-text-muted">{actionRequired.returns} menunggu</div>
                                    </div>
                                </div>
                                <ChevronRight className="h-3.5 w-3.5 text-text-subtle" />
                            </Link>
                        )}
                        {actionRequired.exchanges > 0 && (
                            <Link href="/owner/exchanges?status=submitted" className="group flex items-center justify-between rounded-md bg-surface px-3 py-2 transition-colors hover:bg-surface-muted">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex h-6 w-6 items-center justify-center rounded bg-amber-100 text-amber-600"><ArrowLeftRight className="h-3.5 w-3.5" /></div>
                                    <div>
                                        <div className="text-sm font-medium text-text">Tukar Produk</div>
                                        <div className="text-xs text-text-muted">{actionRequired.exchanges} menunggu</div>
                                    </div>
                                </div>
                                <ChevronRight className="h-3.5 w-3.5 text-text-subtle" />
                            </Link>
                        )}
                        {actionRequired.pendingSettlementVerifications > 0 && (
                            <Link href="/owner/settlement-payments" className="group flex items-center justify-between rounded-md bg-surface px-3 py-2 transition-colors hover:bg-surface-muted">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-blue-600"><CreditCard className="h-3.5 w-3.5" /></div>
                                    <div>
                                        <div className="text-sm font-medium text-text">Pembayaran</div>
                                        <div className="text-xs text-text-muted">{actionRequired.pendingSettlementVerifications} menunggu verifikasi</div>
                                    </div>
                                </div>
                                <ChevronRight className="h-3.5 w-3.5 text-text-subtle" />
                            </Link>
                        )}
                        {totalPendingActions === 0 && (
                            <div className="flex flex-col items-center justify-center py-6">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></div>
                                <div className="mt-2 text-sm font-medium text-text">Semua sudah ditangani</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Stok Kritis */}
                <div>
                    <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-text-muted">Stok Kritis</span>
                        {inventoryRisks.length > 0 && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{inventoryRisks.length}</span>
                        )}
                    </div>
                    <div className="space-y-2">
                        {inventoryRisks.map((risk) => (
                            <div key={risk.variant.id} className="group flex items-center justify-between rounded-md bg-red-50 px-3 py-2">
                                <Link href={risk.detailHref} className="flex min-w-0 flex-1 items-center gap-2.5">
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-red-100 text-red-500"><AlertTriangle className="h-3.5 w-3.5" /></div>
                                    <div className="min-w-0">
                                        <div className="truncate text-xs font-medium text-text">{risk.variant.full_name}</div>
                                        <div className="text-xs text-text-muted">Stok: <span className="font-semibold text-red-600">{risk.centerStock}</span> · Min {risk.threshold} · Kurang {risk.shortage}</div>
                                    </div>
                                </Link>
                                <Link href="/owner/restocks/create" className="ml-2 shrink-0 rounded-md border border-border bg-surface px-2 py-0.5 text-xs font-semibold text-text transition-colors hover:bg-primary hover:text-white">Restock</Link>
                            </div>
                        ))}
                        {inventoryRisks.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-6">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></div>
                                <div className="mt-2 text-sm font-medium text-text">Stok pusat aman</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Overdue Outlets — settlement alerts */}
            {settlementAlerts.length > 0 && (
                <div className="mb-4">
                    <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-text-muted">Outlet Tertunggak</span>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">{settlementAlerts.length}</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {settlementAlerts.map((alert) => (
                            <Link
                                key={alert.outlet.id}
                                href={alert.detailHref}
                                className="group flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 transition-colors hover:bg-amber-100"
                            >
                                <div>
                                    <div className="text-sm font-semibold text-text">{alert.outlet.name}</div>
                                    <div className="text-xs text-text-muted">Terlambat {alert.daysOverdue} hari</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-bold tabular-nums text-amber-700">{formatCurrency(alert.outstandingAmount)}</div>
                                    <ChevronRight className="ml-auto h-3.5 w-3.5 text-text-subtle transition-transform group-hover:translate-x-0.5" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </OwnerPageShell>
    );
}
