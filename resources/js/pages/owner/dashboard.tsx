import { Head, Link } from '@inertiajs/react';
import { Wallet, ClipboardList, AlertTriangle, Package, RotateCcw, ArrowLeftRight, CreditCard } from 'lucide-react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import OwnerKpiCard from '@/components/owner/owner-kpi-card';
import { ExpandableSection, ExpandableItem } from '@/components/ui/expandable-section';
import { usePolling } from '@/lib/use-polling';
import { formatCurrency } from '@/lib/format';

interface DashboardProps {
    hero: {
        total_outstanding: number;
        subtitle: string;
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
        id: number;
        outlet_name: string;
        days_overdue: number;
        outstanding: number;
    }>;
    inventoryRisks: Array<{
        id: number;
        variant_name: string;
        current_stock: number;
        threshold: number;
    }>;
}

export default function Dashboard({
    hero,
    kpis,
    actionRequired,
    settlementAlerts,
    inventoryRisks,
}: DashboardProps) {
    usePolling(30000);

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
                        {formatCurrency(hero.total_outstanding)}
                    </div>
                    <div className="mt-1 text-sm opacity-80">
                        {hero.subtitle}
                    </div>
                    <Link
                        href="/owner/finance"
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur-sm transition-colors hover:bg-white/25"
                    >
                        Lihat Penagihan →
                    </Link>
                </div>

                {/* KPI Cards */}
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Link href="/owner/finance">
                        <OwnerKpiCard
                            icon={<Wallet className="h-5 w-5" />}
                            label="Tagihan"
                            value={formatCurrency(kpis.outstandingAmount)}
                            trend={`${settlementAlerts.length} outlet belum bayar`}
                        />
                    </Link>
                    <Link href="#actions">
                        <OwnerKpiCard
                            icon={<ClipboardList className="h-5 w-5" />}
                            label="Butuh Tindakan"
                            value={totalPendingActions}
                            trend={`${actionRequired.restocks} restock · ${actionRequired.returns} return · ${actionRequired.pendingSettlementVerifications} pembayaran`}
                        />
                    </Link>
                    <Link href="/owner/inventories?filter=critical">
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
                    <ExpandableSection
                        title="Butuh Tindakan"
                        count={totalPendingActions}
                        countColor="blue"
                        action={{
                            label: 'Lihat Semua',
                            href: '/owner/restocks?status=requested',
                        }}
                    >
                        {actionRequired.restocks > 0 && (
                            <ExpandableItem
                                icon={<Package className="h-4 w-4" />}
                                action={{ label: 'Tinjau', href: '/owner/restocks?status=requested' }}
                            >
                                {actionRequired.restocks} restock menunggu persetujuan
                            </ExpandableItem>
                        )}
                        {actionRequired.returns > 0 && (
                            <ExpandableItem
                                icon={<RotateCcw className="h-4 w-4" />}
                                action={{ label: 'Tinjau', href: '/owner/returns?status=submitted' }}
                            >
                                {actionRequired.returns} return menunggu persetujuan
                            </ExpandableItem>
                        )}
                        {actionRequired.exchanges > 0 && (
                            <ExpandableItem
                                icon={<ArrowLeftRight className="h-4 w-4" />}
                                action={{ label: 'Tinjau', href: '/owner/exchanges?status=submitted' }}
                            >
                                {actionRequired.exchanges} tukar produk menunggu persetujuan
                            </ExpandableItem>
                        )}
                        {actionRequired.pendingSettlementVerifications > 0 && (
                            <ExpandableItem
                                icon={<CreditCard className="h-4 w-4" />}
                                action={{ label: 'Verifikasi', href: '/owner/settlement-payments' }}
                            >
                                {actionRequired.pendingSettlementVerifications} pembayaran menunggu verifikasi
                            </ExpandableItem>
                        )}
                        {totalPendingActions === 0 && (
                            <div className="py-4 text-center text-sm text-text-muted">
                                Tidak ada tindakan yang diperlukan
                            </div>
                        )}
                    </ExpandableSection>

                    <ExpandableSection
                        title="Stok Kritis"
                        count={inventoryRisks.length}
                        countColor="red"
                        action={{
                            label: 'Lihat Semua',
                            href: '/owner/inventories?filter=critical',
                        }}
                    >
                        {inventoryRisks.map((risk) => (
                            <ExpandableItem
                                key={risk.id}
                                action={{ label: 'Restock', href: `/owner/restocks/create?variant=${risk.id}` }}
                            >
                                {risk.variant_name} — Stok: {risk.current_stock} (min: {risk.threshold})
                            </ExpandableItem>
                        ))}
                        {inventoryRisks.length === 0 && (
                            <div className="py-4 text-center text-sm text-text-muted">
                                Stok pusat masih aman
                            </div>
                        )}
                    </ExpandableSection>
                </div>
            </OwnerPageShell>
        </>
    );
}
