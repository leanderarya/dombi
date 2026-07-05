import { Link, router } from '@inertiajs/react';
import { ArrowDownRight, ArrowLeftRight, Package, RotateCcw, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/pagination';
import { Select } from '@/components/ui/select';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency, formatDate } from '@/lib/format';
import { getExchangeStatus, getReturnStatus } from '@/lib/status-labels';

/* ------------------------------------------------------------------ */
/*  Tab configuration                                                  */
/* ------------------------------------------------------------------ */

const TABS = [
    { key: 'pengembalian', label: 'Pengembalian' },
    { key: 'penukaran', label: 'Penukaran' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function OwnerReturnsIndex(props: any) {
    const { tab: initialTab, returns, exchanges, filters, dashboard, exchangeDashboard, outlets, reasons } = props;
    const [activeTab, setActiveTab] = useState<TabKey>((initialTab as TabKey) ?? 'pengembalian');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('tab');

        if (t && TABS.some((tab) => tab.key === t)) {
            setActiveTab(t as TabKey);
        }
    }, []);

    const handleTabChange = (t: TabKey) => {
        setActiveTab(t);
        router.get('/owner/returns', { tab: t }, { preserveState: true, replace: true });
    };

    return (
        <OwnerPageShell title="Return & Tukar" subtitle="Kelola pengembalian dan penukaran barang">
            {/* Segmented Control */}
            <div className="mb-5 inline-flex rounded-xl bg-surface-muted p-1">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => handleTabChange(t.key)}
                        className={`relative rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200 ${
                            activeTab === t.key ? 'bg-white text-text shadow-sm' : 'text-text-muted hover:text-text'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {activeTab === 'pengembalian' && (
                <PengembalianTab
                    returns={returns}
                    filters={filters}
                    dashboard={dashboard}
                    outlets={outlets}
                    reasons={reasons}
                />
            )}
            {activeTab === 'penukaran' && (
                <PenukaranTab
                    exchanges={exchanges}
                    filters={filters}
                    dashboard={exchangeDashboard}
                    outlets={outlets}
                />
            )}
        </OwnerPageShell>
    );
}

/* ================================================================== */
/*  Tab 1: Pengembalian                                                */
/* ================================================================== */

const RETURN_STATUS_FILTERS = [
    { key: 'all', label: 'Semua' },
    { key: 'submitted', label: 'Diajukan' },
    { key: 'approved', label: 'Disetujui' },
    { key: 'received_at_center', label: 'Diterima' },
    { key: 'completed', label: 'Selesai' },
    { key: 'rejected', label: 'Ditolak' },
];

function PengembalianTab({ returns, filters, dashboard, outlets, reasons }: any) {
    if (!returns || !dashboard) {
        return <div className="h-20 animate-pulse rounded-xl border border-border bg-white" />;
    }

    const handleApprove = (id: number, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        router.post(`/owner/returns/${id}/approve`, {}, { preserveScroll: true });
    };

    const navigate = (params: Record<string, string | undefined>) => {
        router.get('/owner/returns', { tab: 'pengembalian', ...filters, ...params }, { preserveState: true, replace: true });
    };

    return (
        <div className="space-y-6 lg:grid lg:grid-cols-[1fr_320px] lg:gap-6 lg:space-y-0">
            <div className="space-y-4">
                {/* Filters */}
                <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-4">
                        <Select
                            value={filters.outlet_id ?? ''}
                            onChange={(e) => navigate({ outlet_id: e.target.value || undefined })}
                            options={outlets.map((o: any) => ({ value: String(o.id), label: o.name }))}
                            placeholder="Semua Outlet"
                        />
                        <Select
                            value={filters.reason ?? ''}
                            onChange={(e) => navigate({ reason: e.target.value || undefined })}
                            options={Object.entries(reasons).map(([v, l]) => ({ value: v, label: String(l) }))}
                            placeholder="Semua Alasan"
                        />
                        <input type="date" value={filters.date_from ?? ''} onChange={(e) => navigate({ date_from: e.target.value || undefined })} className="rounded-lg border border-border bg-white px-3 py-2 text-sm" />
                        <input type="date" value={filters.date_to ?? ''} onChange={(e) => navigate({ date_to: e.target.value || undefined })} className="rounded-lg border border-border bg-white px-3 py-2 text-sm" />
                    </div>
                    <StatusFilterPills
                        filters={RETURN_STATUS_FILTERS}
                        active={filters.status ?? 'all'}
                        onChange={(key) => navigate({ status: key === 'all' ? undefined : key })}
                        getStatus={getReturnStatus}
                    />
                </div>

                {/* List */}
                <div className="space-y-2">
                    {returns.data.length === 0 ? (
                        <EmptyState icon={<RotateCcw className="h-10 w-10" />} title="Tidak ada permintaan return" desc="Return akan muncul di sini saat outlet mengajukan" />
                    ) : (
                        returns.data.map((ret: any) => {
                            const status = getReturnStatus(ret.status);

                            return (
                                <Link key={ret.id} href={`/owner/returns/${ret.id}`} className="block rounded-xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-md">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-text">Return #{ret.id}</span>
                                            <StatusBadge variant={status.variant} size="sm">{status.label}</StatusBadge>
                                        </div>
                                        <span className="text-sm font-bold text-primary tabular-nums">{formatCurrency(ret.total_value)}</span>
                                    </div>
                                    <div className="mt-1.5 flex items-center justify-between">
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
                                            <span>{ret.outlet?.name ?? '-'}</span>
                                            <span className="text-text-subtle">&middot;</span>
                                            <span className="text-text-subtle">{ret.reason?.replaceAll('_', ' ')}</span>
                                            <span className="text-text-subtle">&middot;</span>
                                            <span>{ret.items?.length ?? 0} item</span>
                                            <span className="text-text-subtle">&middot;</span>
                                            <span>{formatDate(ret.created_at)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {ret.status === 'submitted' && (
                                                <span onClick={(e) => handleApprove(ret.id, e)} className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-white active:opacity-90">
                                                    Setujui
                                                </span>
                                            )}
                                            <span className="text-xs font-semibold text-primary">Tinjau</span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })
                    )}
                </div>
                <Pagination links={returns.links} />
            </div>

            {/* KPI Sidebar */}
            <aside className="hidden lg:block">
                <div className="sticky top-24 space-y-3">
                    <KpiCard icon={<Package className="h-4 w-4 text-amber-500" />} label="Return Tertunda" value={dashboard.pending_returns} trend={dashboard.pending_returns > 0 ? 'Perlu ditinjau' : undefined} trendColor="text-amber-600" />
                    <KpiCard icon={<TrendingUp className="h-4 w-4 text-primary" />} label="Nilai Return" value={formatCurrency(dashboard.returned_value)} valueColor="text-primary" />
                    {dashboard.total_returns !== undefined && (
                        <KpiCard icon={<RotateCcw className="h-4 w-4 text-text-subtle" />} label="Total Return" value={dashboard.total_returns} />
                    )}
                </div>
            </aside>
        </div>
    );
}

/* ================================================================== */
/*  Tab 2: Penukaran                                                   */
/* ================================================================== */

const EXCHANGE_STATUS_FILTERS = [
    { key: 'all', label: 'Semua' },
    { key: 'submitted', label: 'Diajukan' },
    { key: 'approved', label: 'Disetujui' },
    { key: 'preparing', label: 'Disiapkan' },
    { key: 'shipped', label: 'Dikirim' },
    { key: 'received', label: 'Diterima' },
    { key: 'completed', label: 'Selesai' },
    { key: 'rejected', label: 'Ditolak' },
];

function PenukaranTab({ exchanges, filters, dashboard, outlets }: any) {
    if (!exchanges || !dashboard) {
        return <div className="h-20 animate-pulse rounded-xl border border-border bg-white" />;
    }

    const handleApprove = (id: number, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        router.post(`/owner/exchanges/${id}/approve`, {}, { preserveScroll: true });
    };

    const navigate = (params: Record<string, string | undefined>) => {
        router.get('/owner/returns', { tab: 'penukaran', ...filters, ...params }, { preserveState: true, replace: true });
    };

    return (
        <div className="space-y-6 lg:grid lg:grid-cols-[1fr_320px] lg:gap-6 lg:space-y-0">
            <div className="space-y-4">
                {/* Filters */}
                <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-3">
                        <Select
                            value={filters.outlet_id ?? ''}
                            onChange={(e) => navigate({ outlet_id: e.target.value || undefined })}
                            options={outlets.map((o: any) => ({ value: String(o.id), label: o.name }))}
                            placeholder="Semua Outlet"
                        />
                        <input type="date" value={filters.date_from ?? ''} onChange={(e) => navigate({ date_from: e.target.value || undefined })} className="rounded-lg border border-border bg-white px-3 py-2 text-sm" />
                        <input type="date" value={filters.date_to ?? ''} onChange={(e) => navigate({ date_to: e.target.value || undefined })} className="rounded-lg border border-border bg-white px-3 py-2 text-sm" />
                    </div>
                    <StatusFilterPills
                        filters={EXCHANGE_STATUS_FILTERS}
                        active={filters.status ?? 'all'}
                        onChange={(key) => navigate({ status: key === 'all' ? undefined : key })}
                        getStatus={getExchangeStatus}
                    />
                </div>

                {/* List */}
                <div className="space-y-2">
                    {exchanges.data.length === 0 ? (
                        <EmptyState icon={<ArrowLeftRight className="h-10 w-10" />} title="Tidak ada permintaan tukar produk" desc="Tukar produk akan muncul di sini saat outlet mengajukan" />
                    ) : (
                        exchanges.data.map((ex: any) => {
                            const status = getExchangeStatus(ex.status);

                            return (
                                <Link key={ex.id} href={`/owner/exchanges/${ex.id}`} className="block rounded-xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-md">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-text">Exchange #{ex.id}</span>
                                            <StatusBadge variant={status.variant} size="sm">{status.label}</StatusBadge>
                                        </div>
                                        <span className="text-sm font-bold text-primary tabular-nums">{formatCurrency(ex.exchange_value)}</span>
                                    </div>
                                    <div className="mt-1.5 flex items-center justify-between">
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
                                            <span>{ex.outlet?.name ?? '-'}</span>
                                            <span className="text-text-subtle">&middot;</span>
                                            <span className="text-text-subtle">{ex.return_request_id ? `Return #${ex.return_request_id}` : 'Tanpa return'}</span>
                                            <span className="text-text-subtle">&middot;</span>
                                            <span>{ex.items?.length ?? 0} item</span>
                                            <span className="text-text-subtle">&middot;</span>
                                            <span>{formatDate(ex.created_at)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {ex.status === 'submitted' && (
                                                <span onClick={(e) => handleApprove(ex.id, e)} className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-white active:opacity-90">
                                                    Setujui
                                                </span>
                                            )}
                                            <span className="text-xs font-semibold text-primary">Tinjau</span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })
                    )}
                </div>
                <Pagination links={exchanges.links} />
            </div>

            {/* KPI Sidebar */}
            <aside className="hidden lg:block">
                <div className="sticky top-24 space-y-3">
                    <KpiCard icon={<ArrowLeftRight className="h-4 w-4 text-amber-500" />} label="Tukar Produk Tertunda" value={dashboard.pending_exchanges} trend={dashboard.pending_exchanges > 0 ? 'Perlu ditinjau' : undefined} trendColor="text-amber-600" />
                    <KpiCard icon={<TrendingUp className="h-4 w-4 text-primary" />} label="Nilai Tukar" value={formatCurrency(dashboard.exchange_value)} valueColor="text-primary" />
                    {dashboard.total_exchanges !== undefined && (
                        <KpiCard icon={<Package className="h-4 w-4 text-text-subtle" />} label="Total Tukar Produk" value={dashboard.total_exchanges} />
                    )}
                </div>
            </aside>
        </div>
    );
}

/* ================================================================== */
/*  Shared components                                                  */
/* ================================================================== */

function StatusFilterPills({ filters, active, onChange, getStatus }: {
    filters: { key: string; label: string }[];
    active: string;
    onChange: (key: string) => void;
    getStatus: (status: string) => { variant: string; label: string };
}) {
    const colorMap: Record<string, string> = {
        submitted: 'text-amber-600 bg-amber-50 ring-amber-200',
        approved: 'text-blue-600 bg-blue-50 ring-blue-200',
        preparing: 'text-indigo-600 bg-indigo-50 ring-indigo-200',
        shipped: 'text-purple-600 bg-purple-50 ring-purple-200',
        received: 'text-cyan-600 bg-cyan-50 ring-cyan-200',
        received_at_center: 'text-indigo-600 bg-indigo-50 ring-indigo-200',
        completed: 'text-emerald-600 bg-emerald-50 ring-emerald-200',
        rejected: 'text-red-600 bg-red-50 ring-red-200',
    };

    return (
        <div className="flex flex-wrap gap-2 overflow-x-auto scrollbar-none">
            {filters.map((f) => {
                const isActive = active === f.key;

                return (
                    <button
                        key={f.key}
                        onClick={() => onChange(f.key)}
                        className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-all ${
                            isActive
                                ? colorMap[f.key] ?? 'bg-primary/10 text-primary ring-primary/20'
                                : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                        }`}
                    >
                        {f.label}
                    </button>
                );
            })}
        </div>
    );
}

function KpiCard({ icon, label, value, trend, trendColor, valueColor }: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    trend?: string;
    trendColor?: string;
    valueColor?: string;
}) {
    return (
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-text-muted">
                {icon}
                {label}
            </div>
            <div className={`mt-2 text-3xl font-bold tabular-nums ${valueColor ?? 'text-text'}`}>{value}</div>
            {trend && (
                <div className={`mt-1 flex items-center gap-1 text-[11px] font-medium ${trendColor ?? 'text-text-subtle'}`}>
                    <ArrowDownRight className="h-3 w-3" />
                    {trend}
                </div>
            )}
        </div>
    );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
            <div className="mb-3 text-text-subtle">{icon}</div>
            <div className="text-sm font-medium text-text-muted">{title}</div>
            <div className="mt-1 text-xs text-text-subtle">{desc}</div>
        </div>
    );
}
