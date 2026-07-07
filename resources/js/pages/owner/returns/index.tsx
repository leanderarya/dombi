import { router } from '@inertiajs/react';
import { RotateCcw, ArrowLeftRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency, formatDate } from '@/lib/format';
import { getExchangeStatus, getReturnStatus } from '@/lib/status-labels';

const TABS = [
    { key: 'pengembalian', label: 'Pengembalian' },
    { key: 'penukaran', label: 'Penukaran' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

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

const statusColorMap: Record<string, string> = {
    submitted: 'text-amber-600 bg-amber-50 ring-amber-200',
    approved: 'text-blue-600 bg-blue-50 ring-blue-200',
    preparing: 'text-indigo-600 bg-indigo-50 ring-indigo-200',
    shipped: 'text-purple-600 bg-purple-50 ring-purple-200',
    received: 'text-cyan-600 bg-cyan-50 ring-cyan-200',
    received_at_center: 'text-indigo-600 bg-indigo-50 ring-indigo-200',
    completed: 'text-emerald-600 bg-emerald-50 ring-emerald-200',
    rejected: 'text-red-600 bg-red-50 ring-red-200',
};

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
        <>
            {/* Filter controls */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                {RETURN_STATUS_FILTERS.filter((f) => f.key !== 'all').map((f) => {
                    const isActive = (filters.status ?? '') === f.key;
                    return (
                        <button key={f.key} type="button" onClick={() => navigate({ status: f.key === 'all' ? undefined : f.key })}
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 transition-all ${
                                isActive ? statusColorMap[f.key] ?? 'bg-primary/10 text-primary ring-primary/20' : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                            }`}>
                            {f.label}
                        </button>
                    );
                })}
                <span className="flex-1" />
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
            </div>

            {/* KPI Strip */}
            <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Return Tertunda</div>
                    <div className="mt-1 text-base font-bold tabular-nums">{dashboard.pending_returns}</div>
                    {dashboard.pending_returns > 0 && <div className="text-[10px] font-medium text-amber-600">Perlu ditinjau</div>}
                </div>
                <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Nilai Return</div>
                    <div className="mt-1 text-base font-bold tabular-nums">{formatCurrency(dashboard.returned_value)}</div>
                </div>
                {dashboard.total_returns !== undefined && (
                    <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                        <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Total Return</div>
                        <div className="mt-1 text-base font-bold tabular-nums">{dashboard.total_returns}</div>
                    </div>
                )}
            </div>

            {/* Table */}
            {returns.data.length === 0 ? (
                <div className="rounded-lg border border-border bg-white py-10 text-center text-xs text-text-muted">
                    Tidak ada permintaan return
                </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                    <div className="grid grid-cols-[90px_1fr_120px_100px_90px] items-center gap-3 bg-[#fafafa] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                        <span>Kode</span><span>Outlet / Alasan</span><span>Status</span><span className="text-right">Nilai</span><span />
                    </div>
                    {returns.data.map((ret: any) => {
                        const status = getReturnStatus(ret.status);
                        return (
                            <div key={ret.id}
                                className="grid grid-cols-[90px_1fr_120px_100px_90px] items-center gap-3 border-t border-[#f0f0f0] px-3 py-2 text-xs transition-colors last:border-t-0 hover:bg-surface-muted">
                                <span className="font-bold tabular-nums text-text">#{ret.id}</span>
                                <span className="truncate text-text-muted">{ret.outlet?.name ?? '-'} · {(ret.reason ?? '').replaceAll('_', ' ')}</span>
                                <span><StatusBadge variant={status.variant} size="sm">{status.label}</StatusBadge></span>
                                <span className="text-right font-semibold tabular-nums text-primary">{formatCurrency(ret.total_value)}</span>
                                <div className="flex items-center gap-1 justify-end">
                                    {ret.status === 'submitted' && (
                                        <button type="button" onClick={(e) => handleApprove(ret.id, e)}
                                            className="rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-primary-hover">
                                            Setujui
                                        </button>
                                    )}
                                    <button type="button" onClick={() => router.visit(`/owner/returns/${ret.id}`)}
                                        className="rounded-md px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary-light">
                                        Tinjau
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <Pagination links={returns.links} />
        </>
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
        <>
            {/* Filter controls */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                {EXCHANGE_STATUS_FILTERS.filter((f) => f.key !== 'all').map((f) => {
                    const isActive = (filters.status ?? '') === f.key;
                    return (
                        <button key={f.key} type="button" onClick={() => navigate({ status: f.key === 'all' ? undefined : f.key })}
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 transition-all ${
                                isActive ? statusColorMap[f.key] ?? 'bg-primary/10 text-primary ring-primary/20' : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                            }`}>
                            {f.label}
                        </button>
                    );
                })}
                <span className="flex-1" />
                <Select
                    value={filters.outlet_id ?? ''}
                    onChange={(e) => navigate({ outlet_id: e.target.value || undefined })}
                    options={outlets.map((o: any) => ({ value: String(o.id), label: o.name }))}
                    placeholder="Semua Outlet"
                />
            </div>

            {/* KPI Strip */}
            <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Tertunda</div>
                    <div className="mt-1 text-base font-bold tabular-nums">{dashboard.pending_exchanges}</div>
                    {dashboard.pending_exchanges > 0 && <div className="text-[10px] font-medium text-amber-600">Perlu ditinjau</div>}
                </div>
                <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Nilai Tukar</div>
                    <div className="mt-1 text-base font-bold tabular-nums">{formatCurrency(dashboard.exchange_value)}</div>
                </div>
                {dashboard.total_exchanges !== undefined && (
                    <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                        <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Total Tukar</div>
                        <div className="mt-1 text-base font-bold tabular-nums">{dashboard.total_exchanges}</div>
                    </div>
                )}
            </div>

            {/* Table */}
            {exchanges.data.length === 0 ? (
                <div className="rounded-lg border border-border bg-white py-10 text-center text-xs text-text-muted">
                    Tidak ada permintaan tukar produk
                </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                    <div className="grid grid-cols-[90px_1fr_120px_100px_90px] items-center gap-3 bg-[#fafafa] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                        <span>Kode</span><span>Outlet / Info</span><span>Status</span><span className="text-right">Nilai</span><span />
                    </div>
                    {exchanges.data.map((ex: any) => {
                        const status = getExchangeStatus(ex.status);
                        return (
                            <div key={ex.id}
                                className="grid grid-cols-[90px_1fr_120px_100px_90px] items-center gap-3 border-t border-[#f0f0f0] px-3 py-2 text-xs transition-colors last:border-t-0 hover:bg-surface-muted">
                                <span className="font-bold tabular-nums text-text">#{ex.id}</span>
                                <span className="truncate text-text-muted">{ex.outlet?.name ?? '-'} · {ex.return_request_id ? `Return #${ex.return_request_id}` : 'Tanpa return'}</span>
                                <span><StatusBadge variant={status.variant} size="sm">{status.label}</StatusBadge></span>
                                <span className="text-right font-semibold tabular-nums text-primary">{formatCurrency(ex.exchange_value)}</span>
                                <div className="flex items-center gap-1 justify-end">
                                    {ex.status === 'submitted' && (
                                        <button type="button" onClick={(e) => handleApprove(ex.id, e)}
                                            className="rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-primary-hover">
                                            Setujui
                                        </button>
                                    )}
                                    <button type="button" onClick={() => router.visit(`/owner/exchanges/${ex.id}`)}
                                        className="rounded-md px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary-light">
                                        Tinjau
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <Pagination links={exchanges.links} />
        </>
    );
}
