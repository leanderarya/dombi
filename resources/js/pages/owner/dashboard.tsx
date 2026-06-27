import { Head, Link } from '@inertiajs/react';
import { Wallet, ClipboardList, AlertTriangle, Package, RotateCcw, ArrowLeftRight, CreditCard, ChevronRight, TrendingDown, CheckCircle2 } from 'lucide-react';
import OwnerKpiCard from '@/components/owner/owner-kpi-card';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { ExpandableSection } from '@/components/ui/expandable-section';
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

    const totalPendingActions = actionRequired.restocks + actionRequired.returns + actionRequired.exchanges + actionRequired.pendingSettlementVerifications;

    return (
        <>
            <Head title="Dasbor" />
            <OwnerPageShell
                title="Dasbor"
                subtitle="Ringkasan operasional hari ini"
            >
                {/* 2-column desktop layout */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

                    {/* LEFT COLUMN — Actions + Hero */}
                    <div className="space-y-4">
                        {/* Butuh Tindakan — Primary Section */}
                        <ExpandableSection
                            title="Butuh Tindakan"
                            icon={<ClipboardList className="h-4 w-4" />}
                            count={totalPendingActions}
                            countColor="blue"
                            defaultExpanded={totalPendingActions > 0}
                            className="border-l-4 border-l-primary bg-primary/2"
                        >
                            <div className="space-y-2">
                                {actionRequired.restocks > 0 && (
                                    <Link
                                        href="/owner/restocks?status=requested"
                                        className="group flex items-center justify-between rounded-lg border border-border p-3 transition-all duration-200 hover:bg-surface-muted hover:border-border-strong"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted text-text-muted transition-transform duration-200 group-hover:scale-105">
                                                <Package className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-text">Restock</div>
                                                <div className="text-xs text-text-muted">{actionRequired.restocks} menunggu persetujuan</div>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-text-subtle transition-transform duration-200 group-hover:translate-x-0.5" />
                                    </Link>
                                )}
                                {actionRequired.returns > 0 && (
                                    <Link
                                        href="/owner/returns?status=submitted"
                                        className="group flex items-center justify-between rounded-lg border border-border p-3 transition-all duration-200 hover:bg-surface-muted hover:border-border-strong"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted text-text-muted transition-transform duration-200 group-hover:scale-105">
                                                <RotateCcw className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-text">Return</div>
                                                <div className="text-xs text-text-muted">{actionRequired.returns} menunggu persetujuan</div>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-text-subtle transition-transform duration-200 group-hover:translate-x-0.5" />
                                    </Link>
                                )}
                                {actionRequired.exchanges > 0 && (
                                    <Link
                                        href="/owner/exchanges?status=submitted"
                                        className="group flex items-center justify-between rounded-lg border border-border p-3 transition-all duration-200 hover:bg-surface-muted hover:border-border-strong"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted text-text-muted transition-transform duration-200 group-hover:scale-105">
                                                <ArrowLeftRight className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-text">Tukar Produk</div>
                                                <div className="text-xs text-text-muted">{actionRequired.exchanges} menunggu persetujuan</div>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-text-subtle transition-transform duration-200 group-hover:translate-x-0.5" />
                                    </Link>
                                )}
                                {actionRequired.pendingSettlementVerifications > 0 && (
                                    <Link
                                        href="/owner/settlement-payments"
                                        className="group flex items-center justify-between rounded-lg border border-border p-3 transition-all duration-200 hover:bg-surface-muted hover:border-border-strong"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted text-text-muted transition-transform duration-200 group-hover:scale-105">
                                                <CreditCard className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-text">Pembayaran</div>
                                                <div className="text-xs text-text-muted">{actionRequired.pendingSettlementVerifications} menunggu verifikasi</div>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-text-subtle transition-transform duration-200 group-hover:translate-x-0.5" />
                                    </Link>
                                )}
                                {totalPendingActions === 0 && (
                                    <div className="flex flex-col items-center justify-center py-8">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                                            <CheckCircle2 className="h-6 w-6" />
                                        </div>
                                        <div className="mt-3 text-sm font-medium text-text">Semua sudah ditangani</div>
                                        <div className="mt-1 text-xs text-text-muted">Tidak ada tindakan yang diperlukan hari ini</div>
                                    </div>
                                )}
                            </div>
                        </ExpandableSection>

                        {/* Hero Bar — only when there is outstanding debt */}
                        {hero.outstandingAmount > 0 && (
                            <Link
                                href={hero.ctaHref}
                                className="group relative block overflow-hidden rounded-xl bg-linear-to-br from-primary to-primary-hover px-5 py-4 text-white transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 lg:px-6 lg:py-5"
                            >
                                <div className="relative">
                                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider opacity-70">
                                        <TrendingDown className="h-3.5 w-3.5" />
                                        Tagihan Tertunggak
                                    </div>
                                    <div className="mt-2 text-2xl font-bold tabular-nums tracking-tight lg:text-3xl">
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
                                {/* Subtle hover shimmer */}
                                <div className="pointer-events-none absolute inset-0 bg-white/0 transition-colors duration-300 group-hover:bg-white/4" />
                            </Link>
                        )}
                    </div>

                    {/* RIGHT COLUMN — KPI Cards + Stok Kritis */}
                    <div className="space-y-4">
                        {/* KPI Cards — stacked vertically, compact */}
                        <div className="space-y-2">
                            <Link href="/owner/finance" className="block">
                                <OwnerKpiCard
                                    icon={<Wallet className="h-5 w-5" />}
                                    label="Tagihan"
                                    value={formatCurrency(kpis.outstandingAmount)}
                                    trend={`${settlementAlerts.length} outlet belum bayar`}
                                    className="p-3 lg:p-4"
                                />
                            </Link>
                            <Link href="#actions" className="block">
                                <OwnerKpiCard
                                    icon={<ClipboardList className="h-5 w-5" />}
                                    label="Butuh Tindakan"
                                    value={totalPendingActions}
                                    trend={`${actionRequired.restocks} restock · ${actionRequired.returns} return · ${actionRequired.pendingSettlementVerifications} bayar`}
                                    className="p-3 lg:p-4"
                                />
                            </Link>
                            <Link href="/owner/inventories?filter=critical" className="block">
                                <OwnerKpiCard
                                    icon={<AlertTriangle className="h-5 w-5" />}
                                    label="Stok Kritis"
                                    value={kpis.criticalStock}
                                    color={kpis.criticalStock > 0 ? 'danger' : 'success'}
                                    trend={kpis.criticalStock > 0 ? 'SKU perlu restock segera' : 'Semua stok aman'}
                                    className="p-3 lg:p-4"
                                />
                            </Link>
                        </div>

                        {/* Stok Kritis */}
                        <ExpandableSection
                            title="Stok Kritis"
                            icon={<AlertTriangle className="h-4 w-4" />}
                            count={inventoryRisks.length}
                            countColor="red"
                            defaultExpanded={inventoryRisks.length > 0}
                        >
                            <div className="space-y-2">
                                {inventoryRisks.map((risk) => (
                                    <div
                                        key={risk.variant.id}
                                        className="group flex items-center justify-between rounded-lg border border-border p-3 transition-all duration-200 hover:bg-surface-muted hover:border-border-strong"
                                    >
                                        <Link
                                            href={risk.detailHref}
                                            className="flex min-w-0 flex-1 items-center gap-3"
                                        >
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500 transition-transform duration-200 group-hover:scale-105">
                                                <AlertTriangle className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-medium text-text">{risk.variant.full_name}</div>
                                                <div className="text-xs text-text-muted">
                                                    Stok: <span className="font-semibold text-red-600">{risk.centerStock}</span> · Min: {risk.threshold} · Kurang: {risk.shortage}
                                                </div>
                                            </div>
                                        </Link>
                                        <Link
                                            href="/owner/restocks/create"
                                            className="ml-2 shrink-0 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-text transition-all duration-200 hover:bg-primary hover:text-white hover:border-primary"
                                        >
                                            Restock
                                        </Link>
                                    </div>
                                ))}
                                {inventoryRisks.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-8">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                                            <CheckCircle2 className="h-6 w-6" />
                                        </div>
                                        <div className="mt-3 text-sm font-medium text-text">Stok pusat aman</div>
                                        <div className="mt-1 text-xs text-text-muted">Semua SKU di atas threshold</div>
                                    </div>
                                )}
                            </div>
                        </ExpandableSection>
                    </div>
                </div>
            </OwnerPageShell>
        </>
    );
}
