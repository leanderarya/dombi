import { Head, Link } from '@inertiajs/react';
import { Wallet, ClipboardList, AlertTriangle, Package, RotateCcw, ArrowLeftRight, CreditCard, ChevronRight, TrendingDown, CheckCircle2 } from 'lucide-react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import OwnerKpiCard from '@/components/owner/owner-kpi-card';
import { ExpandableSection } from '@/components/ui/expandable-section';
import { usePolling } from '@/lib/use-polling';
import { formatCurrency } from '@/lib/format';

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
                {/* Hero Bar */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-hover px-6 py-5 text-white">
                    {/* Subtle noise texture */}
                    <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />
                    <div className="relative">
                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider opacity-70">
                            <TrendingDown className="h-3.5 w-3.5" />
                            Tagihan Tertunggak
                        </div>
                        <div className="mt-2 text-3xl font-bold tabular-nums tracking-tight">
                            {formatCurrency(hero.outstandingAmount)}
                        </div>
                        <div className="mt-1 text-sm opacity-80">
                            {hero.subtitle}
                        </div>
                        <Link
                            href={hero.ctaHref}
                            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur-sm transition-all duration-200 hover:bg-white/25 hover:translate-x-0.5 active:translate-x-0"
                        >
                            {hero.ctaLabel} →
                        </Link>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Link href="/owner/finance" className="block">
                        <OwnerKpiCard
                            icon={<Wallet className="h-5 w-5" />}
                            label="Tagihan"
                            value={formatCurrency(kpis.outstandingAmount)}
                            trend={`${settlementAlerts.length} outlet belum bayar`}
                        />
                    </Link>
                    <Link href="#actions" className="block">
                        <OwnerKpiCard
                            icon={<ClipboardList className="h-5 w-5" />}
                            label="Butuh Tindakan"
                            value={totalPendingActions}
                            trend={`${actionRequired.restocks} restock · ${actionRequired.returns} return · ${actionRequired.pendingSettlementVerifications} bayar`}
                        />
                    </Link>
                    <Link href="/owner/inventories?filter=critical" className="block">
                        <OwnerKpiCard
                            icon={<AlertTriangle className="h-5 w-5" />}
                            label="Stok Kritis"
                            value={kpis.criticalStock}
                            color={kpis.criticalStock > 0 ? 'danger' : 'success'}
                            trend={kpis.criticalStock > 0 ? 'SKU perlu restock segera' : 'Semua stok aman'}
                        />
                    </Link>
                </div>

                {/* Expandable Sections */}
                <div className="mt-4 space-y-3">
                    {/* Butuh Tindakan */}
                    <ExpandableSection
                        title="Butuh Tindakan"
                        icon={<ClipboardList className="h-4 w-4" />}
                        count={totalPendingActions}
                        countColor="blue"
                        defaultExpanded={totalPendingActions > 0}
                    >
                        <div className="space-y-2">
                            {actionRequired.restocks > 0 && (
                                <Link
                                    href="/owner/restocks?status=requested"
                                    className="group flex items-center justify-between rounded-lg border border-border p-3 transition-all duration-200 hover:bg-surface-muted hover:border-border-strong"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-transform duration-200 group-hover:scale-105">
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
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 transition-transform duration-200 group-hover:scale-105">
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
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600 transition-transform duration-200 group-hover:scale-105">
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
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition-transform duration-200 group-hover:scale-105">
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
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                        <CheckCircle2 className="h-6 w-6" />
                                    </div>
                                    <div className="mt-3 text-sm font-medium text-text">Semua sudah ditangani</div>
                                    <div className="mt-1 text-xs text-text-muted">Tidak ada tindakan yang diperlukan</div>
                                </div>
                            )}
                        </div>
                    </ExpandableSection>

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
                                <Link
                                    key={risk.variant.id}
                                    href={risk.detailHref}
                                    className="group flex items-center justify-between rounded-lg border border-border p-3 transition-all duration-200 hover:bg-surface-muted hover:border-border-strong"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600 transition-transform duration-200 group-hover:scale-105">
                                            <AlertTriangle className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-text">{risk.variant.full_name}</div>
                                            <div className="text-xs text-text-muted">
                                                Stok: <span className="font-semibold text-red-600">{risk.centerStock}</span> · Min: {risk.threshold} · Kurang: {risk.shortage}
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-text-subtle transition-transform duration-200 group-hover:translate-x-0.5" />
                                </Link>
                            ))}
                            {inventoryRisks.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-8">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                        <CheckCircle2 className="h-6 w-6" />
                                    </div>
                                    <div className="mt-3 text-sm font-medium text-text">Stok pusat aman</div>
                                    <div className="mt-1 text-xs text-text-muted">Semua SKU di atas threshold</div>
                                </div>
                            )}
                        </div>
                    </ExpandableSection>
                </div>
            </OwnerPageShell>
        </>
    );
}
