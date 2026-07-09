import { Link } from '@inertiajs/react';
import { AlertTriangle, Package, RotateCcw, ArrowLeftRight, CreditCard, ChevronRight, TrendingDown, CheckCircle2, X, ChevronDown } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
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

function useDismissedAlerts() {
    const key = 'dombi:dismissed-settlement-alerts';
    const [dismissed, setDismissed] = useState<Set<number>>(() => {
        try {
            const raw = localStorage.getItem(key);

            return raw ? new Set(JSON.parse(raw)) : new Set();
        } catch {
            return new Set();
        }
    });

    const persist = useCallback((ids: Set<number>) => {
        localStorage.setItem(key, JSON.stringify([...ids]));
    }, []);

    const dismiss = useCallback((outletId: number, outletName: string) => {
        setDismissed((prev) => {
            const next = new Set(prev);
            next.add(outletId);
            persist(next);

            return next;
        });

        toast(`Alert ${outletName} ditutup`, {
            action: {
                label: 'Urungkan',
                onClick: () => {
                    setDismissed((prev) => {
                        const next = new Set(prev);
                        next.delete(outletId);
                        persist(next);

                        return next;
                    });
                },
            },
            duration: 5000,
        });
    }, [persist]);

    return { dismissed, dismiss };
}

function getStockSeverity(shortage: number): { bg: string; border: string; text: string } {
    if (shortage >= 8) {
return { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-800' };
}

    if (shortage >= 4) {
return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' };
}

    return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' };
}

interface ActionItem {
    key: string;
    href: string;
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
    label: string;
    count: number;
    suffix: string;
    urgency: number;
    badge?: { text: string; className: string };
}

export default function Dashboard({
    hero,
    kpis,
    actionRequired,
    settlementAlerts,
    inventoryRisks,
}: DashboardProps) {
    usePolling(30000, ['hero', 'kpis', 'actionRequired', 'settlementAlerts', 'inventoryRisks']);
    const { dismissed, dismiss } = useDismissedAlerts();

    if (!hero || !kpis || !actionRequired) {
        return (
            <OwnerPageShell title="Dasbor" subtitle="Ringkasan operasional hari ini">
                <OwnerDashboardSkeleton />
            </OwnerPageShell>
        );
    }

    const totalPendingActions = actionRequired.restocks + actionRequired.returns + actionRequired.exchanges + actionRequired.pendingSettlementVerifications;

    const activeSettlementAlerts = (settlementAlerts ?? []).filter((a) => !dismissed.has(a.outlet.id));

    const actionItems: ActionItem[] = [];

    if (actionRequired.restocks > 0) {
        actionItems.push({
            key: 'restocks',
            href: '/owner/restocks?status=requested',
            icon: <Package className="h-4 w-4" />,
            iconBg: 'bg-amber-100',
            iconColor: 'text-amber-600',
            label: 'Restock',
            count: actionRequired.restocks,
            suffix: 'menunggu',
            urgency: 1,
            badge: { text: 'Segera', className: 'bg-amber-100 text-amber-700' },
        });
    }

    if (actionRequired.returns > 0) {
        actionItems.push({
            key: 'returns',
            href: '/owner/returns?status=submitted',
            icon: <RotateCcw className="h-4 w-4" />,
            iconBg: 'bg-rose-100',
            iconColor: 'text-rose-600',
            label: 'Return',
            count: actionRequired.returns,
            suffix: 'menunggu',
            urgency: 2,
        });
    }

    if (actionRequired.exchanges > 0) {
        actionItems.push({
            key: 'exchanges',
            href: '/owner/exchanges?status=submitted',
            icon: <ArrowLeftRight className="h-4 w-4" />,
            iconBg: 'bg-violet-100',
            iconColor: 'text-violet-600',
            label: 'Tukar Produk',
            count: actionRequired.exchanges,
            suffix: 'menunggu',
            urgency: 3,
        });
    }

    if (actionRequired.pendingSettlementVerifications > 0) {
        actionItems.push({
            key: 'settlements',
            href: '/owner/settlement-payments',
            icon: <CreditCard className="h-4 w-4" />,
            iconBg: 'bg-blue-100',
            iconColor: 'text-blue-600',
            label: 'Pembayaran',
            count: actionRequired.pendingSettlementVerifications,
            suffix: 'menunggu verifikasi',
            urgency: 4,
        });
    }

    actionItems.sort((a, b) => a.urgency - b.urgency);

    return (
        <OwnerPageShell
            title="Dasbor"
            subtitle="Ringkasan operasional hari ini"
        >
            {/* Hero Bar — only when there is outstanding debt */}
            {hero.outstandingAmount > 0 && (
                <Link
                    href={hero.ctaHref}
                    className="group relative mb-4 block overflow-hidden rounded-lg bg-primary px-5 py-4 text-white transition-all duration-200 hover:bg-primary-hover"
                    aria-label={`Tagihan tertunggak ${formatCurrency(hero.outstandingAmount)}. ${hero.subtitle}. ${hero.ctaLabel}`}
                >
                    <div className="relative">
                        <div className="flex items-center gap-2 text-xs font-medium opacity-70">
                            <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
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
                </Link>
            )}

            {/* KPI horizontal strip */}
            <OwnerKpiStrip items={[
                { label: 'Tagihan', value: formatCurrency(kpis.outstandingAmount), sublabel: `${(settlementAlerts ?? []).length} outlet`, sublabelColor: 'text-blue-600', href: '/owner/finance' },
                { label: 'Tindakan', value: totalPendingActions, sublabel: `${actionRequired.restocks} restock`, sublabelColor: 'text-amber-600', href: '#actions' },
                { label: 'Stok Kritis', value: kpis.criticalStock, valueClassName: kpis.criticalStock > 0 ? 'text-red-600' : 'text-text', sublabel: kpis.criticalStock > 0 ? 'SKU perlu restock' : 'Semua aman', sublabelColor: kpis.criticalStock > 0 ? 'text-red-600' : 'text-emerald-600', href: '/owner/inventories?filter=critical' },
            ]} />

            {/* 2-column grid for Actions + Stok Kritis */}
            <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Butuh Tindakan */}
                <section aria-label="Butuh Tindakan">
                    <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Butuh Tindakan</span>
                        {totalPendingActions > 0 && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{totalPendingActions}</span>
                        )}
                    </div>
                    <div className="space-y-2">
                        {actionItems.map((item) => (
                            <Link
                                key={item.key}
                                href={item.href}
                                className="group flex items-center justify-between rounded-md bg-surface px-3 py-3 transition-colors hover:bg-surface-muted"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`flex h-8 w-8 items-center justify-center rounded ${item.iconBg} ${item.iconColor}`}>{item.icon}</div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-text">{item.label}</span>
                                            {item.badge && (
                                                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${item.badge.className}`}>{item.badge.text}</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-text-muted">{item.count} {item.suffix}</div>
                                    </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-text-subtle" aria-hidden="true" />
                            </Link>
                        ))}
                        {totalPendingActions === 0 && (
                            <div className="flex flex-col items-center justify-center py-6">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                                <div className="mt-2 text-sm font-medium text-text">Semua sudah ditangani</div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Stok Kritis */}
                <section aria-label="Stok Kritis">
                    <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Stok Kritis</span>
                        {(inventoryRisks ?? []).length > 0 && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{inventoryRisks.length}</span>
                        )}
                    </div>
                    <div className="space-y-2">
                        {(inventoryRisks ?? []).slice(0, 5).map((risk) => {
                            const sev = getStockSeverity(risk.shortage);

                            return (
                                <div key={risk.variant.id} className={`group flex items-center justify-between rounded-md border ${sev.border} ${sev.bg} px-3 py-3`}>
                                    <Link href={risk.detailHref} className="flex min-w-0 flex-1 items-center gap-3">
                                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded ${sev.bg} ${sev.text}`}>
                                            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-medium text-text">{risk.variant.full_name}</div>
                                            <div className="text-xs text-text-muted">
                                                Stok: <span className={`font-bold ${sev.text}`}>{risk.centerStock}</span>
                                                {' '}&middot;{' '}
                                                Min {risk.threshold}
                                                {' '}&middot;{' '}
                                                Kurang <span className={`font-bold ${sev.text}`}>{risk.shortage}</span>
                                            </div>
                                        </div>
                                    </Link>
                                    <Link
                                        href={`/owner/restocks/create?variant_id=${risk.variant.id}`}
                                        className="ml-2 shrink-0 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-text transition-colors hover:bg-primary hover:text-white"
                                    >
                                        Restock
                                    </Link>
                                </div>
                            );
                        })}
                        {(inventoryRisks ?? []).length > 5 && (
                            <Link
                                href="/owner/inventories?filter=critical"
                                className="flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
                            >
                                <ChevronDown className="h-3.5 w-3.5" />
                                Lihat semua {(inventoryRisks ?? []).length} item
                            </Link>
                        )}
                        {(inventoryRisks ?? []).length === 0 && (
                            <div className="flex flex-col items-center justify-center py-6">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                                <div className="mt-2 text-sm font-medium text-text">Stok pusat aman</div>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {/* Overdue Outlets — settlement alerts */}
            {activeSettlementAlerts.length > 0 && (
                <section aria-label="Outlet Tertunggak" className="mb-4">
                    <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Outlet Tertunggak</span>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">{activeSettlementAlerts.length}</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {activeSettlementAlerts.map((alert) => (
                            <div
                                key={alert.outlet.id}
                                className="group relative flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 transition-colors hover:bg-amber-100"
                            >
                                <Link href={alert.detailHref} className="flex min-w-0 flex-1 items-center gap-2">
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold text-text">{alert.outlet.name}</div>
                                        <div className="text-xs text-text-muted">Terlambat {alert.daysOverdue} hari</div>
                                    </div>
                                </Link>
                                <div className="flex items-center gap-1.5">
                                    <div className="text-right">
                                        <div className="text-sm font-bold tabular-nums text-amber-700">{formatCurrency(alert.outstandingAmount)}</div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            dismiss(alert.outlet.id, alert.outlet.name);
                                        }}
                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-subtle transition-colors hover:bg-amber-200 hover:text-text"
                                        aria-label={`Tutup alert ${alert.outlet.name}`}
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </OwnerPageShell>
    );
}
