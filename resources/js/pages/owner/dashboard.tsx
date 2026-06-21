import { Head, Link } from '@inertiajs/react';
import { Wallet, ClipboardList, AlertTriangle, Package, RotateCcw, ArrowLeftRight, CreditCard, ChevronRight } from 'lucide-react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import OwnerKpiCard from '@/components/owner/owner-kpi-card';
import { ExpandableSection, ExpandableItem } from '@/components/ui/expandable-section';
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
                <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-hover px-6 py-5 text-white">
                    <div className="text-xs font-medium uppercase tracking-wider opacity-70">
                        Tagihan Tertunggak
                    </div>
                    <div className="mt-1 text-3xl font-bold tabular-nums">
                        {formatCurrency(hero.outstandingAmount)}
                    </div>
                    <div className="mt-1 text-sm opacity-80">
                        {hero.subtitle}
                    </div>
                    <Link
                        href={hero.ctaHref}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur-sm transition-colors hover:bg-white/25"
                    >
                        {hero.ctaLabel} →
                    </Link>
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
                            trend={`${actionRequired.restocks} restock · ${actionRequired.returns} return · ${actionRequired.pendingSettlementVerifications} pembayaran`}
                        />
                    </Link>
                    <Link href="/owner/inventories?filter=critical" className="block">
                        <OwnerKpiCard
                            icon={<AlertTriangle className="h-5 w-5" />}
                            label="Stok Kritis"
                            value={kpis.criticalStock}
                            color={kpis.criticalStock > 0 ? 'danger' : 'success'}
                            trend="SKU perlu restock segera"
                        />
                    </Link>
                </div>

                {/* Expandable Sections */}
                <div className="mt-4 space-y-3">
                    {/* Butuh Tindakan */}
                    <ExpandableSection
                        title="Butuh Tindakan"
                        count={totalPendingActions}
                        countColor="blue"
                    >
                        <div className="space-y-2">
                            {actionRequired.restocks > 0 && (
                                <Link
                                    href="/owner/restocks?status=requested"
                                    className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-surface-muted"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                            <Package className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-text">Restock</div>
                                            <div className="text-xs text-text-muted">{actionRequired.restocks} menunggu persetujuan</div>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-text-subtle" />
                                </Link>
                            )}
                            {actionRequired.returns > 0 && (
                                <Link
                                    href="/owner/returns?status=submitted"
                                    className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-surface-muted"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                                            <RotateCcw className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-text">Return</div>
                                            <div className="text-xs text-text-muted">{actionRequired.returns} menunggu persetujuan</div>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-text-subtle" />
                                </Link>
                            )}
                            {actionRequired.exchanges > 0 && (
                                <Link
                                    href="/owner/exchanges?status=submitted"
                                    className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-surface-muted"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                                            <ArrowLeftRight className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-text">Tukar Produk</div>
                                            <div className="text-xs text-text-muted">{actionRequired.exchanges} menunggu persetujuan</div>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-text-subtle" />
                                </Link>
                            )}
                            {actionRequired.pendingSettlementVerifications > 0 && (
                                <Link
                                    href="/owner/settlement-payments"
                                    className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-surface-muted"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                                            <CreditCard className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-text">Pembayaran</div>
                                            <div className="text-xs text-text-muted">{actionRequired.pendingSettlementVerifications} menunggu verifikasi</div>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-text-subtle" />
                                </Link>
                            )}
                            {totalPendingActions === 0 && (
                                <div className="py-6 text-center">
                                    <div className="text-sm text-text-muted">Tidak ada tindakan yang diperlukan</div>
                                    <div className="mt-1 text-xs text-text-subtle">Semua sudah ditangani</div>
                                </div>
                            )}
                        </div>
                    </ExpandableSection>

                    {/* Stok Kritis */}
                    <ExpandableSection
                        title="Stok Kritis"
                        count={inventoryRisks.length}
                        countColor="red"
                    >
                        <div className="space-y-2">
                            {inventoryRisks.map((risk) => (
                                <Link
                                    key={risk.variant.id}
                                    href={risk.detailHref}
                                    className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-surface-muted"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
                                            <AlertTriangle className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-text">{risk.variant.full_name}</div>
                                            <div className="text-xs text-text-muted">
                                                Stok: {risk.centerStock} · Min: {risk.threshold} · Kurang: {risk.shortage}
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-text-subtle" />
                                </Link>
                            ))}
                            {inventoryRisks.length === 0 && (
                                <div className="py-6 text-center">
                                    <div className="text-sm text-text-muted">Stok pusat masih aman</div>
                                    <div className="mt-1 text-xs text-text-subtle">Semua SKU di atas threshold</div>
                                </div>
                            )}
                        </div>
                    </ExpandableSection>
                </div>
            </OwnerPageShell>
        </>
    );
}
