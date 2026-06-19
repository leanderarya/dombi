import { Link } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowRight,
    Box,
    CheckCircle2,
    Package,
    RefreshCw,
    Wallet,
} from 'lucide-react';
import OutletAttentionList from '@/components/owner/outlet-attention-list';
import OwnerActionCard from '@/components/owner/owner-action-card';
import OwnerKpiCard from '@/components/owner/owner-kpi-card';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import EmptyState from '@/components/ui/empty-state';
import SectionCard from '@/components/ui/section-card';
import { formatCurrency } from '@/lib/format';
import { stockSeverity, pendingSeverity } from '@/lib/severity';
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
        approvalsNeeded: number;
        outletsNeedingAttention: number;
        criticalCenterSkus: number;
    };
    actionRequired: {
        restocks: number;
        returns: number;
        exchanges: number;
        pendingSettlementVerifications: number;
    };
    outletAttention: Array<{
        outlet: { id: number; name: string };
        outstandingAmount: number;
        pendingRestocks: number;
        pendingReturns: number;
        pendingExchanges: number;
        pendingIssues: number;
        criticalStocks: number;
        daysOverdue: number;
        severityScore: number;
        detailHref: string;
    }>;
    settlementAlerts: Array<{
        outlet: { id: number; name: string };
        outstandingAmount: number;
        daysOverdue: number;
        detailHref: string;
    }>;
    inventoryRisks: Array<{
        variant: { id: number; name: string; full_name: string; family_name?: string | null };
        centerStock: number;
        threshold: number;
        shortage: number;
        detailHref: string;
    }>;
}

export default function Dashboard({ hero, kpis, actionRequired, outletAttention, settlementAlerts, inventoryRisks }: DashboardProps) {
    usePolling(30000);

    const attentionOutlets = outletAttention.map((row) => ({
        outletId: row.outlet.id,
        outletName: row.outlet.name,
        outstanding: row.outstandingAmount,
        pendingRestocks: row.pendingRestocks,
        pendingReturns: row.pendingReturns,
        pendingExchanges: row.pendingExchanges,
        criticalStocks: row.criticalStocks,
        daysOverdue: row.daysOverdue,
        href: row.detailHref,
    }));

    return (
        <OwnerPageShell title="Dasbor Keputusan" subtitle="Prioritas owner: menyetujui, menagih, dan mengelola risiko stok pusat">
            {/* Hero */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex items-start justify-between gap-6">
                    <div>
                        <div className="text-sm text-zinc-500">Total Belum Masuk</div>
                        <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
                            {formatCurrency(hero.outstandingAmount)}
                        </div>
                        <p className="mt-1 max-w-xl text-sm text-zinc-400">{hero.subtitle}</p>
                    </div>
                    <Link
                        href={hero.ctaHref}
                        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
                    >
                        {hero.ctaLabel}
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            </section>

            {/* KPI Strip */}
            <section className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
                <OwnerKpiCard
                    label="Belum Masuk"
                    value={formatCurrency(kpis.outstandingAmount)}
                    icon={<Wallet className="h-5 w-5" />}
                />
                <OwnerKpiCard
                    label="Menunggu Persetujuan"
                    value={kpis.approvalsNeeded}
                    icon={<CheckCircle2 className="h-5 w-5" />}
                />
                <OwnerKpiCard
                    label="Outlet Perlu Perhatian"
                    value={kpis.outletsNeedingAttention}
                    icon={<AlertCircle className="h-5 w-5" />}
                />
                <OwnerKpiCard
                    label="Stok Pusat Kritis"
                    value={kpis.criticalCenterSkus}
                    icon={<Box className="h-5 w-5" />}
                />
            </section>

            {/* Two-column: Actions + Outlet Attention */}
            <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <SectionCard label="Perlu Tindakan">
                    <div className="space-y-3">
                        <OwnerActionCard
                            href="/owner/restocks?status=requested"
                            title="Restock Menunggu Persetujuan"
                            subtitle={`${actionRequired.restocks} permintaan`}
                            count={actionRequired.restocks}
                            severity={pendingSeverity(actionRequired.restocks)}
                            icon={<RefreshCw className="h-5 w-5" />}
                            ctaLabel="Tinjau"
                        />
                        <OwnerActionCard
                            href="/owner/returns?status=submitted"
                            title="Return Menunggu Persetujuan"
                            subtitle={`${actionRequired.returns} permintaan`}
                            count={actionRequired.returns}
                            severity={pendingSeverity(actionRequired.returns)}
                            icon={<Package className="h-5 w-5" />}
                            ctaLabel="Tinjau"
                        />
                        <OwnerActionCard
                            href="/owner/exchanges?status=submitted"
                            title="Tukar Produk Menunggu Persetujuan"
                            subtitle={`${actionRequired.exchanges} permintaan`}
                            count={actionRequired.exchanges}
                            severity={pendingSeverity(actionRequired.exchanges)}
                            icon={<RefreshCw className="h-5 w-5" />}
                            ctaLabel="Tinjau"
                        />
                        <OwnerActionCard
                            href="/owner/settlement-payments"
                            title="Pembayaran Menunggu Verifikasi"
                            subtitle={`${actionRequired.pendingSettlementVerifications} pembayaran`}
                            count={actionRequired.pendingSettlementVerifications}
                            severity={pendingSeverity(actionRequired.pendingSettlementVerifications)}
                            icon={<Wallet className="h-5 w-5" />}
                            ctaLabel="Tinjau"
                        />
                    </div>
                </SectionCard>

                <SectionCard label="Outlet Perlu Perhatian" labelRight={<Link href="/owner/outlets" className="text-xs font-semibold text-zinc-500 hover:text-zinc-700">Lihat Semua</Link>}>
                    <div id="outlet-attention">
                        <OutletAttentionList outlets={attentionOutlets} />
                    </div>
                </SectionCard>
            </section>

            {/* Two-column: Settlement Preview + Inventory Risks */}
            <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <SectionCard
                    label="Belum Masuk"
                    labelRight={<Link href="/owner/finance" className="text-xs font-semibold text-zinc-500 hover:text-zinc-700">Lihat Semua</Link>}
                >
                    <div className="space-y-3">
                        {settlementAlerts.length > 0 ? settlementAlerts.map((item) => (
                            <Link
                                key={item.outlet.id}
                                href={item.detailHref}
                                className="flex items-center justify-between rounded-xl border border-zinc-100 px-4 py-3 transition-colors hover:bg-zinc-50"
                            >
                                <div>
                                    <div className="text-sm font-semibold text-zinc-900">{item.outlet.name}</div>
                                    <div className="mt-1 text-xs text-zinc-400">
                                        {item.daysOverdue > 0 ? `${item.daysOverdue} hari terlambat` : 'Belum terselesaikan'}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-semibold tabular-nums text-red-600">
                                        {formatCurrency(item.outstandingAmount)}
                                    </div>
                                    {item.daysOverdue > 14 && (
                                        <div className="mt-0.5 text-[10px] font-bold text-red-500">Kritis</div>
                                    )}
                                </div>
                            </Link>
                        )) : (
                            <EmptyState title="Tidak ada kewajiban tertunggak" description="Semua outlet sudah menyelesaikan kewajibannya." />
                        )}
                    </div>
                </SectionCard>

                <SectionCard
                    label="Stok Pusat Kritis"
                    labelRight={<Link href="/owner/inventories" className="text-xs font-semibold text-zinc-500 hover:text-zinc-700">Lihat Inventaris</Link>}
                >
                    <div className="space-y-3">
                        {inventoryRisks.length > 0 ? inventoryRisks.map((risk) => {
                            const severity = stockSeverity(risk.centerStock, risk.threshold);

                            return (
                                <Link
                                    key={risk.variant.id}
                                    href={risk.detailHref}
className="flex items-center justify-between rounded-xl border border-zinc-100 px-4 py-3 transition-colors hover:bg-zinc-50"
                                    >
                                        <div>
                                            <div className="text-sm font-semibold text-zinc-900">{risk.variant.name}</div>
                                            <div className="mt-1 text-xs text-zinc-400">
                                                Threshold {risk.threshold} · Kurang {risk.shortage}
                                            </div>
                                        </div>
                                    <div className="text-right">
                                        <div className={`text-sm font-semibold tabular-nums ${severity === 'critical' ? 'text-red-600' : severity === 'warning' ? 'text-amber-600' : 'text-slate-900'}`}>
                                            {risk.centerStock}
                                        </div>
                                        <div className="text-[11px] text-zinc-400">stok pusat</div>
                                    </div>
                                </Link>
                            );
                        }) : (
                            <EmptyState title="Stok pusat masih aman" description="Belum ada SKU pusat yang melewati batas kritis." />
                        )}
                    </div>
                </SectionCard>
            </section>
        </OwnerPageShell>
    );
}
