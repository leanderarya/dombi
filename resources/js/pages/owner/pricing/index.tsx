import { Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    ChevronDown,
    ChevronUp,
    Copy,
    DollarSign,
    Minus,
    Package,
    Plus,
    RotateCcw,
    Search,
    Store,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import OwnerKpiCard from '@/components/owner/owner-kpi-card';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency, formatDate, formatMarginPercent } from '@/lib/format';
import { marginColor } from '@/lib/pricing-utils';

/* ------------------------------------------------------------------ */
/*  Tab configuration                                                  */
/* ------------------------------------------------------------------ */

const TABS = [
    { key: 'pusat', label: 'Pusat' },
    { key: 'outlet', label: 'Outlet' },
    { key: 'riwayat', label: 'Riwayat' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/* ------------------------------------------------------------------ */
/*  Shared types                                                       */
/* ------------------------------------------------------------------ */

interface PusatVariant {
    variant_id: number;
    name: string;
    family_name: string | null;
    flavor: string | null;
    size: string | null;
    center_price: number;
    selling_price: number;
    margin: number;
    outlet_override_count: number;
}

interface PusatKpis {
    total_variants: number;
    avg_hpp: number;
    avg_margin: number;
    negative_margin_count: number;
}

interface OutletData {
    id: number;
    name: string;
    override_count: number;
    total_variants: number;
    all_standard: boolean;
}

interface OutletPriceRow {
    variant_id: number;
    name: string;
    family_name: string | null;
    flavor: string | null;
    size: string | null;
    center_price: number;
    selling_price: number;
    margin: number;
    has_override?: boolean;
}

interface OtherOutlet {
    id: number;
    name: string;
}

interface AuditLog {
    id: number;
    outlet: string;
    product: string;
    old_price: number;
    new_price: number;
    action: string;
    changed_by: string;
    created_at: string;
}

interface PaginatedLogs {
    data: AuditLog[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: { url: string | null; label: string; active: boolean }[];
}

interface Props {
    tab?: string;
    // Pusat
    pusatVariants?: PusatVariant[];
    pusatKpis?: PusatKpis;
    // Outlet
    outlets?: OutletData[];
    selectedOutlet?: { id: number; name: string };
    outletPrices?: OutletPriceRow[];
    otherOutlets?: OtherOutlet[];
    // Riwayat
    logs?: PaginatedLogs;
    actionFilter?: string;
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function PricingIndex(props: Props) {
    const [activeTab, setActiveTab] = useState<TabKey>((props.tab as TabKey) ?? 'pusat');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab && TABS.some((t) => t.key === tab)) {
            setActiveTab(tab as TabKey);
        }
    }, []);

    const handleTabChange = (tab: TabKey) => {
        setActiveTab(tab);
        const params: Record<string, string> = { tab };
        if (tab === 'outlet' && props.selectedOutlet) {
            params.outlet_id = String(props.selectedOutlet.id);
        }
        router.get('/owner/pricing', params, { preserveState: true, replace: true });
    };

    return (
        <OwnerPageShell title="Harga" subtitle="Kelola harga jual produk">
            {/* Segmented Control */}
            <div className="mb-5 inline-flex rounded-xl bg-surface-muted p-1">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => handleTabChange(tab.key)}
                        className={`relative rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200 ${
                            activeTab === tab.key ? 'bg-white text-text shadow-sm' : 'text-text-muted hover:text-text'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'pusat' && <PusatTab variants={props.pusatVariants} kpis={props.pusatKpis} />}
            {activeTab === 'outlet' && (
                <OutletTab
                    outlets={props.outlets}
                    selectedOutlet={props.selectedOutlet}
                    outletPrices={props.outletPrices}
                    otherOutlets={props.otherOutlets}
                />
            )}
            {activeTab === 'riwayat' && <RiwayatTab logs={props.logs} actionFilter={props.actionFilter} />}
        </OwnerPageShell>
    );
}

/* ================================================================== */
/*  TAB 1: Pusat — Kelola Harga Global                                 */
/* ================================================================== */

type SortKey = 'name' | 'center_price' | 'selling_price' | 'margin';
type SortDir = 'asc' | 'desc';
type MarginFilter = 'all' | 'high' | 'low' | 'negative';

function PusatTab({ variants, kpis }: { variants?: PusatVariant[]; kpis?: PusatKpis }) {
    const [search, setSearch] = useState('');
    const [marginFilter, setMarginFilter] = useState<MarginFilter>('all');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [page, setPage] = useState(1);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedVariant, setSelectedVariant] = useState<PusatVariant | null>(null);

    if (!variants || !kpis) {
        return <LoadingSkeleton />;
    }

    const filtered = useMemo(() => {
        return variants.filter((v) => {
            if (search) {
                const q = search.toLowerCase();
                if (!v.name.toLowerCase().includes(q) && !(v.family_name ?? '').toLowerCase().includes(q)) return false;
            }
            if (marginFilter === 'high' && v.margin <= 20000) return false;
            if (marginFilter === 'low' && (v.margin < 5000 || v.margin > 20000)) return false;
            if (marginFilter === 'negative' && v.margin >= 0) return false;
            return true;
        });
    }, [variants, search, marginFilter]);

    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            const aVal = a[sortKey];
            const bVal = b[sortKey];
            const cmp = typeof aVal === 'string' ? aVal.localeCompare(String(bVal)) : Number(aVal) - Number(bVal);
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [filtered, sortKey, sortDir]);

    const perPage = 20;
    const totalPages = Math.ceil(sorted.length / perPage);
    const paginated = sorted.slice((page - 1) * perPage, page * perPage);

    const toggleSort = useCallback(
        (key: SortKey) => {
            if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
            else { setSortKey(key); setSortDir('asc'); }
            setPage(1);
        },
        [sortKey],
    );

    return (
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
            <div>
                {/* Toolbar */}
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative flex-1 min-w-40">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
                        <Input
                            type="text"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Cari produk..."
                            className="pl-9"
                        />
                    </div>
                    <Select
                        value={marginFilter}
                        onChange={(e) => { setMarginFilter(e.target.value as MarginFilter); setPage(1); }}
                        options={[
                            { value: 'all', label: 'Semua Margin' },
                            { value: 'high', label: 'Margin Tinggi (>20rb)' },
                            { value: 'low', label: 'Margin Rendah (<5rb)' },
                            { value: 'negative', label: 'Margin Negatif' },
                        ]}
                    />
                </div>

                {/* Sort */}
                <SortBar sortKey={sortKey} toggleSort={toggleSort} />

                {/* Product cards */}
                <div className="space-y-2">
                    {paginated.map((v) => (
                        <div key={v.variant_id} className="rounded-xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-lg font-bold text-text">{v.name}</div>
                                    {v.outlet_override_count > 0 && (
                                        <span className="mt-0.5 inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold text-blue-600">
                                            {v.outlet_override_count} outlet override
                                        </span>
                                    )}
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => { setSelectedVariant(v); setModalOpen(true); }}
                                    className="shrink-0 text-primary"
                                >
                                    Ubah
                                </Button>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                                <span className="text-text-muted">
                                    HPP: <span className="tabular-nums text-text">{formatCurrency(v.center_price)}</span>
                                </span>
                                <span className="text-text-muted">
                                    Jual: <span className="font-semibold tabular-nums text-text">{formatCurrency(v.selling_price)}</span>
                                </span>
                                <span className={`font-bold tabular-nums ${marginColor(v.margin, v.selling_price)}`}>
                                    {formatCurrency(v.margin)} {formatMarginPercent(v.margin, v.selling_price)}
                                </span>
                            </div>
                        </div>
                    ))}
                    {paginated.length === 0 && (
                        <EmptyState message={search || marginFilter !== 'all' ? 'Produk tidak ditemukan.' : 'Belum ada produk aktif.'} />
                    )}
                </div>

                {totalPages > 1 && <PaginationBar page={page} totalPages={totalPages} total={sorted.length} onPageChange={setPage} />}
            </div>

            {/* KPI Sidebar */}
            <aside className="hidden lg:block">
                <div className="sticky top-4 space-y-3">
                    <OwnerKpiCard label="Total Produk" value={kpis.total_variants} icon={<Package className="h-5 w-5" />} />
                    <OwnerKpiCard label="Rata-rata HPP" value={formatCurrency(kpis.avg_hpp)} icon={<DollarSign className="h-5 w-5" />} />
                    <OwnerKpiCard label="Rata-rata Margin" value={formatCurrency(kpis.avg_margin)} icon={<TrendingUp className="h-5 w-5" />} />
                    <OwnerKpiCard
                        label="Margin Negatif"
                        value={kpis.negative_margin_count}
                        icon={<TrendingDown className="h-5 w-5" />}
                        highlight={kpis.negative_margin_count > 0}
                    />
                </div>
            </aside>

            {/* Edit Modal */}
            {selectedVariant && (
                <GlobalPriceModal
                    open={modalOpen}
                    variant={selectedVariant}
                    onClose={() => { setModalOpen(false); setSelectedVariant(null); }}
                />
            )}
        </div>
    );
}

/* ================================================================== */
/*  TAB 2: Outlet — Grid → Detail                                      */
/* ================================================================== */

function OutletTab({ outlets, selectedOutlet, outletPrices, otherOutlets }: {
    outlets?: OutletData[];
    selectedOutlet?: { id: number; name: string };
    outletPrices?: OutletPriceRow[];
    otherOutlets?: OtherOutlet[];
}) {
    // Grid view — no outlet selected
    if (!selectedOutlet) {
        return <OutletGrid outlets={outlets} />;
    }

    // Detail view — outlet selected
    return (
        <OutletDetail
            outlet={selectedOutlet}
            prices={outletPrices}
            otherOutlets={otherOutlets}
            allOutlets={outlets}
        />
    );
}

function OutletGrid({ outlets }: { outlets?: OutletData[] }) {
    if (!outlets || outlets.length === 0) {
        return (
            <EmptyState icon={<Store className="h-10 w-10" />} message="Belum ada outlet aktif." />
        );
    }

    return (
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {outlets.map((o) => (
                    <Link
                        key={o.id}
                        href={`/owner/pricing?tab=outlet&outlet_id=${o.id}`}
                        className="flex items-center gap-4 rounded-xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm hover:border-primary/20 active:opacity-80"
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light">
                            <Store className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold text-text">{o.name}</div>
                            <div className="mt-0.5 text-xs text-text-muted">
                                {o.override_count > 0
                                    ? `${o.override_count} dari ${o.total_variants} produk custom`
                                    : 'Semua standar'}
                            </div>
                        </div>
                        {o.all_standard ? (
                            <StatusBadge variant="success" size="sm">Standar</StatusBadge>
                        ) : (
                            <StatusBadge variant="info" size="sm">Custom</StatusBadge>
                        )}
                    </Link>
                ))}
            </div>

            <aside className="hidden lg:block">
                <div className="sticky top-4 space-y-3">
                    <OwnerKpiCard label="Total Outlet" value={outlets.length} icon={<Store className="h-5 w-5" />} />
                    <OwnerKpiCard
                        label="Outlet dengan Override"
                        value={outlets.filter((o) => !o.all_standard).length}
                        icon={<DollarSign className="h-5 w-5" />}
                    />
                </div>
            </aside>
        </div>
    );
}

function OutletDetail({ outlet, prices, otherOutlets, allOutlets }: {
    outlet: { id: number; name: string };
    prices?: OutletPriceRow[];
    otherOutlets?: OtherOutlet[];
    allOutlets?: OutletData[];
}) {
    const [search, setSearch] = useState('');
    const [marginFilter, setMarginFilter] = useState<MarginFilter>('all');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [page, setPage] = useState(1);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedRow, setSelectedRow] = useState<OutletPriceRow | null>(null);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkAmount, setBulkAmount] = useState('');
    const [copyOpen, setCopyOpen] = useState(false);
    const [copySource, setCopySource] = useState('');
    const [saving, setSaving] = useState(false);

    const handleOutletChange = (outletId: string) => {
        if (outletId) {
            router.get('/owner/pricing', { tab: 'outlet', outlet_id: outletId }, { preserveState: true, replace: true });
        }
    };

    if (!prices) {
        return <LoadingSkeleton />;
    }

    const filtered = useMemo(() => {
        return prices.filter((p) => {
            if (search) {
                const q = search.toLowerCase();
                if (!p.name.toLowerCase().includes(q) && !(p.family_name ?? '').toLowerCase().includes(q)) return false;
            }
            if (marginFilter === 'high' && p.margin <= 20000) return false;
            if (marginFilter === 'low' && (p.margin < 5000 || p.margin > 20000)) return false;
            if (marginFilter === 'negative' && p.margin >= 0) return false;
            return true;
        });
    }, [prices, search, marginFilter]);

    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            const aVal = a[sortKey];
            const bVal = b[sortKey];
            const cmp = typeof aVal === 'string' ? aVal.localeCompare(String(bVal)) : Number(aVal) - Number(bVal);
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [filtered, sortKey, sortDir]);

    const perPage = 20;
    const totalPages = Math.ceil(sorted.length / perPage);
    const paginated = sorted.slice((page - 1) * perPage, page * perPage);

    const toggleSort = useCallback(
        (key: SortKey) => {
            if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
            else { setSortKey(key); setSortDir('asc'); }
            setPage(1);
        },
        [sortKey],
    );

    const handleBulkUpdate = useCallback(() => {
        const amount = parseFloat(bulkAmount);
        if (isNaN(amount)) return;
        if (!confirm(`${sorted.length} produk akan diperbarui. Lanjutkan?`)) return;
        setSaving(true);
        router.post(`/owner/pricing/outlets/${outlet.id}/bulk-update`, { adjustment: amount }, {
            onFinish: () => { setSaving(false); setBulkOpen(false); setBulkAmount(''); },
        });
    }, [bulkAmount, outlet.id, sorted.length]);

    const handleCopy = useCallback(() => {
        if (!copySource) return;
        if (!confirm('Ini akan menimpa semua harga outlet ini. Lanjutkan?')) return;
        setSaving(true);
        router.post(`/owner/pricing/outlets/${outlet.id}/copy`, { source_outlet_id: parseInt(copySource) }, {
            onFinish: () => { setSaving(false); setCopyOpen(false); setCopySource(''); },
        });
    }, [copySource, outlet.id]);

    const handleReset = useCallback((variantId: number, productName: string) => {
        if (!confirm(`Reset ${productName} ke Harga Pusat?`)) return;
        router.delete(`/owner/pricing/outlets/${outlet.id}/variants/${variantId}`);
    }, [outlet.id]);

    const handleSave = useCallback((newPrice: number) => {
        if (!selectedRow) return;
        setSaving(true);
        router.patch(`/owner/pricing/outlets/${outlet.id}/variants/${selectedRow.variant_id}`, { selling_price: newPrice }, {
            onFinish: () => { setSaving(false); setModalOpen(false); setSelectedRow(null); },
        });
    }, [selectedRow, outlet.id]);

    return (
        <div>
            {/* Top bar */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/owner/pricing?tab=outlet" className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-muted text-text-muted hover:text-text">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <span className="text-lg font-bold text-text">{outlet.name}</span>
                </div>
                {allOutlets && allOutlets.length > 1 && (
                    <Select
                        value={String(outlet.id)}
                        onChange={(e) => handleOutletChange(e.target.value)}
                        options={allOutlets.map((o) => ({ value: String(o.id), label: o.name }))}
                    />
                )}
            </div>

            {/* Toolbar */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-40">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
                    <Input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Cari produk..."
                        className="pl-9"
                    />
                </div>
                <Select
                    value={marginFilter}
                    onChange={(e) => { setMarginFilter(e.target.value as MarginFilter); setPage(1); }}
                    options={[
                        { value: 'all', label: 'Semua Margin' },
                        { value: 'high', label: 'Margin Tinggi (>20rb)' },
                        { value: 'low', label: 'Margin Rendah (<5rb)' },
                        { value: 'negative', label: 'Margin Negatif' },
                    ]}
                />
                <Button type="button" variant="secondary" size="sm" icon={Plus} onClick={() => setBulkOpen(!bulkOpen)}>
                    Atur Massal
                </Button>
                {otherOutlets && otherOutlets.length > 0 && (
                    <Button type="button" variant="secondary" size="sm" icon={Copy} onClick={() => setCopyOpen(!copyOpen)}>
                        Salin Dari
                    </Button>
                )}
            </div>

            {/* Bulk Update Panel */}
            {bulkOpen && (
                <BulkPanel
                    amount={bulkAmount}
                    onChange={setBulkAmount}
                    onApply={handleBulkUpdate}
                    onCancel={() => { setBulkOpen(false); setBulkAmount(''); }}
                    saving={saving}
                    count={sorted.length}
                />
            )}

            {/* Copy Panel */}
            {copyOpen && otherOutlets && (
                <CopyPanel
                    outlets={otherOutlets}
                    source={copySource}
                    onChange={setCopySource}
                    onApply={handleCopy}
                    onCancel={() => { setCopyOpen(false); setCopySource(''); }}
                    saving={saving}
                />
            )}

            {/* Sort */}
            <SortBar sortKey={sortKey} toggleSort={toggleSort} />

            {/* Product cards */}
            <div className="space-y-2">
                {paginated.map((row) => (
                    <div key={row.variant_id} className="rounded-xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="text-lg font-bold text-text">{row.name}</div>
                                <div className="mt-0.5 flex items-center gap-2">
                                    {row.has_override ? (
                                        <StatusBadge variant="info" size="sm">Custom</StatusBadge>
                                    ) : (
                                        <StatusBadge variant="neutral" size="sm">Standar</StatusBadge>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {row.has_override && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleReset(row.variant_id, row.name)}
                                        className="shrink-0 text-text-muted hover:text-red-600"
                                        title="Reset ke harga pusat"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => { setSelectedRow(row); setModalOpen(true); }}
                                    className="shrink-0 text-primary"
                                >
                                    Ubah
                                </Button>
                            </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                            <span className="text-text-muted">
                                Pusat: <span className="tabular-nums text-text-muted">{formatCurrency(row.center_price)}</span>
                            </span>
                            <span className="text-text-muted">
                                Jual: <span className="font-semibold tabular-nums text-text">{formatCurrency(row.selling_price)}</span>
                            </span>
                            <span className={`font-bold tabular-nums ${marginColor(row.margin, row.selling_price)}`}>
                                {formatCurrency(row.margin)} {formatMarginPercent(row.margin, row.selling_price)}
                            </span>
                        </div>
                    </div>
                ))}
                {paginated.length === 0 && (
                    <EmptyState message={search || marginFilter !== 'all' ? 'Produk tidak ditemukan.' : 'Belum ada produk aktif.'} />
                )}
            </div>

            {totalPages > 1 && <PaginationBar page={page} totalPages={totalPages} total={sorted.length} onPageChange={setPage} />}

            {/* Edit Modal */}
            {selectedRow && (
                <OutletPriceModal
                    open={modalOpen}
                    row={selectedRow}
                    onClose={() => { setModalOpen(false); setSelectedRow(null); }}
                    onSave={handleSave}
                    saving={saving}
                />
            )}
        </div>
    );
}

/* ================================================================== */
/*  TAB 3: Riwayat — Audit Log                                         */
/* ================================================================== */

const ACTION_FILTERS = [
    { key: '', label: 'Semua' },
    { key: 'master_update', label: 'Harga Pusat' },
    { key: 'update', label: 'Harga Outlet' },
    { key: 'bulk_update', label: 'Bulk Update' },
    { key: 'copy', label: 'Salin' },
    { key: 'reset', label: 'Reset' },
];

const actionLabels: Record<string, string> = {
    update: 'Ubah',
    bulk_update: 'Ubah Massal',
    copy: 'Salin',
    master_update: 'Harga Pusat',
    reset: 'Reset',
};

const actionVariants: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
    update: 'info',
    bulk_update: 'warning',
    copy: 'neutral',
    master_update: 'success',
    reset: 'neutral',
};

function RiwayatTab({ logs, actionFilter }: { logs?: PaginatedLogs; actionFilter?: string }) {
    const handleFilterChange = (key: string) => {
        router.get('/owner/pricing', { tab: 'riwayat', ...(key ? { action: key } : {}) }, { preserveState: true, replace: true });
    };

    if (!logs) {
        return <LoadingSkeleton />;
    }

    return (
        <div>
            {/* Filter */}
            <div className="mb-4 flex flex-wrap gap-2 overflow-x-auto scrollbar-none">
                {ACTION_FILTERS.map((f) => (
                    <button
                        key={f.key}
                        onClick={() => handleFilterChange(f.key)}
                        className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-all ${
                            (actionFilter ?? '') === f.key
                                ? 'bg-primary/10 text-primary ring-primary/20'
                                : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Log cards */}
            <div className="space-y-3">
                {logs.data.length === 0 ? (
                    <EmptyState message="Belum ada riwayat perubahan harga." />
                ) : (
                    logs.data.map((log) => (
                        <div key={log.id} className="rounded-xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-sm font-bold text-text">{log.product}</div>
                                    <div className="mt-1">
                                        <StatusBadge variant={actionVariants[log.action] ?? 'neutral'} size="sm">
                                            {actionLabels[log.action] ?? log.action}
                                        </StatusBadge>
                                    </div>
                                </div>
                                <span className="text-sm font-bold tabular-nums text-primary">{formatCurrency(log.new_price)}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                                {log.outlet !== 'Global' && <span>{log.outlet}</span>}
                                {log.outlet !== 'Global' && <span className="text-text-subtle">&middot;</span>}
                                <span>{formatDate(log.created_at)}</span>
                                <span className="text-text-subtle">&middot;</span>
                                <span>{log.changed_by}</span>
                                {log.old_price != null && (
                                    <>
                                        <span className="text-text-subtle">&middot;</span>
                                        <span>Lama: <span className="line-through">{formatCurrency(log.old_price)}</span></span>
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {logs.links && logs.links.length > 3 && <Pagination links={logs.links} />}
        </div>
    );
}

/* ================================================================== */
/*  Shared Components                                                  */
/* ================================================================== */

function SortBar({ sortKey, toggleSort }: { sortKey: SortKey; toggleSort: (key: SortKey) => void }) {
    const SortIcon = ({ column }: { column: SortKey }) => {
        if (sortKey !== column) return <ChevronDown className="h-3 w-3 text-text-subtle" />;
        return sortKey === 'asc' ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />;
    };

    return (
        <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-muted">Urutkan:</span>
            {([
                { key: 'name' as SortKey, label: 'Produk' },
                { key: 'center_price' as SortKey, label: 'HPP' },
                { key: 'selling_price' as SortKey, label: 'Harga Jual' },
                { key: 'margin' as SortKey, label: 'Margin' },
            ]).map((col) => (
                <button
                    key={col.key}
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        sortKey === col.key ? 'bg-primary-light text-primary' : 'bg-surface text-text-muted hover:bg-surface-muted'
                    }`}
                >
                    {col.label}
                    <SortIcon column={col.key} />
                </button>
            ))}
        </div>
    );
}

function PaginationBar({ page, totalPages, total, onPageChange }: { page: number; totalPages: number; total: number; onPageChange: (p: number) => void }) {
    return (
        <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-text-muted">{total} produk &middot; Halaman {page} dari {totalPages}</span>
            <div className="flex gap-1">
                <Button type="button" size="sm" variant="secondary" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}>
                    Prev
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
                    Next
                </Button>
            </div>
        </div>
    );
}

function EmptyState({ icon, message }: { icon?: React.ReactNode; message: string }) {
    return (
        <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center">
            {icon && <div className="mx-auto mb-2 text-text-subtle">{icon}</div>}
            <p className="text-sm text-text-muted">{message}</p>
        </div>
    );
}

function LoadingSkeleton() {
    return (
        <div className="space-y-3">
            {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-white" />
            ))}
        </div>
    );
}

function BulkPanel({ amount, onChange, onApply, onCancel, saving, count }: {
    amount: string; onChange: (v: string) => void; onApply: () => void; onCancel: () => void; saving: boolean; count: number;
}) {
    return (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600">Atur Semua Harga</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1">
                    {[1000, 2000, 5000, 10000].map((amt) => (
                        <div key={amt} className="flex gap-0.5">
                            <Button type="button" size="sm" variant={amount === String(amt) ? 'primary' : 'secondary'} onClick={() => onChange(String(amt))} className="px-2 py-1 text-[11px]">
                                +{amt.toLocaleString('id-ID')}
                            </Button>
                            <Button type="button" size="sm" variant={amount === String(-amt) ? 'primary' : 'secondary'} onClick={() => onChange(String(-amt))} className="px-2 py-1 text-[11px]">
                                -{amt.toLocaleString('id-ID')}
                            </Button>
                        </div>
                    ))}
                </div>
                <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-text-subtle">Rp</span>
                    <Input type="number" value={amount} onChange={(e) => onChange(e.target.value)} placeholder="Custom" className="w-24 pl-7 text-xs" />
                </div>
                <Button type="button" size="sm" onClick={onApply} disabled={saving || !amount}>Terapkan</Button>
                <Button type="button" size="sm" variant="ghost" onClick={onCancel} className="text-amber-700">Batal</Button>
                <span className="text-[11px] text-amber-600">{count} produk</span>
            </div>
        </div>
    );
}

function CopyPanel({ outlets, source, onChange, onApply, onCancel, saving }: {
    outlets: OtherOutlet[]; source: string; onChange: (v: string) => void; onApply: () => void; onCancel: () => void; saving: boolean;
}) {
    return (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-600">Salin Harga Dari Outlet Lain</div>
            <div className="mt-2 flex items-center gap-2">
                <Select
                    value={source}
                    onChange={(e) => onChange(e.target.value)}
                    options={outlets.map((o) => ({ value: String(o.id), label: o.name }))}
                    placeholder="Pilih outlet sumber..."
                    className="flex-1"
                />
                <Button type="button" size="sm" onClick={onApply} disabled={saving || !source}>Salin</Button>
                <Button type="button" size="sm" variant="ghost" onClick={onCancel} className="text-blue-700">Batal</Button>
            </div>
        </div>
    );
}

/* ================================================================== */
/*  Modals                                                             */
/* ================================================================== */

function GlobalPriceModal({ open, variant, onClose }: {
    open: boolean; variant: PusatVariant; onClose: () => void;
}) {
    const [centerPrice, setCenterPrice] = useState(String(variant.center_price));
    const [sellingPrice, setSellingPrice] = useState(String(variant.selling_price));
    const [saving, setSaving] = useState(false);

    const margin = (parseFloat(sellingPrice) || 0) - (parseFloat(centerPrice) || 0);
    const isNegative = margin < 0;

    const handleSave = () => {
        const updates: Record<string, number> = {};
        const newCenter = parseFloat(centerPrice);
        const newSelling = parseFloat(sellingPrice);

        if (!isNaN(newCenter) && newCenter !== variant.center_price) updates.center_price = newCenter;
        if (!isNaN(newSelling) && newSelling !== variant.selling_price) updates.selling_price = newSelling;

        if (Object.keys(updates).length === 0) { onClose(); return; }

        setSaving(true);
        router.patch(`/owner/pricing/variants/${variant.variant_id}`, updates, {
            onFinish: () => { setSaving(false); onClose(); },
        });
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-text">Ubah Harga</h3>
                <p className="mt-1 text-sm text-text-muted">{variant.name}</p>

                <div className="mt-4 space-y-3">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-text-muted">HPP (Harga Pusat)</label>
                        <Input
                            type="number"
                            value={centerPrice}
                            onChange={(e) => setCenterPrice(e.target.value)}
                            prefix="Rp"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-text-muted">Harga Jual</label>
                        <Input
                            type="number"
                            value={sellingPrice}
                            onChange={(e) => setSellingPrice(e.target.value)}
                            prefix="Rp"
                        />
                    </div>

                    {/* Margin preview */}
                    <div className={`rounded-lg p-3 ${isNegative ? 'bg-red-50' : 'bg-surface-muted'}`}>
                        <div className="text-xs text-text-muted">Margin</div>
                        <div className={`text-lg font-bold tabular-nums ${isNegative ? 'text-red-600' : 'text-emerald-600'}`}>
                            {formatCurrency(margin)}
                        </div>
                        {isNegative && (
                            <p className="mt-1 text-xs text-red-600">Margin negatif — harga jual lebih rendah dari HPP</p>
                        )}
                    </div>

                    {variant.outlet_override_count > 0 && (
                        <p className="text-xs text-amber-600">
                            {variant.outlet_override_count} outlet memiliki override. Perubahan HPP dapat mempengaruhi margin outlet.
                        </p>
                    )}
                </div>

                <div className="mt-6 flex gap-2">
                    <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Batal</Button>
                    <Button type="button" onClick={handleSave} disabled={saving} className="flex-1">
                        {saving ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function OutletPriceModal({ open, row, onClose, onSave, saving }: {
    open: boolean; row: OutletPriceRow; onClose: () => void; onSave: (price: number) => void; saving: boolean;
}) {
    const [price, setPrice] = useState(String(row.selling_price));

    const margin = (parseFloat(price) || 0) - row.center_price;
    const isNegative = margin < 0;

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-text">Ubah Harga Outlet</h3>
                <p className="mt-1 text-sm text-text-muted">{row.name}</p>

                <div className="mt-4 space-y-3">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-text-muted">Harga Pusat (Global)</label>
                        <div className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-text-muted">
                            {formatCurrency(row.center_price)}
                        </div>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-text-muted">Harga Jual (Outlet)</label>
                        <Input
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            prefix="Rp"
                        />
                    </div>

                    <div className={`rounded-lg p-3 ${isNegative ? 'bg-red-50' : 'bg-surface-muted'}`}>
                        <div className="text-xs text-text-muted">Margin</div>
                        <div className={`text-lg font-bold tabular-nums ${isNegative ? 'text-red-600' : 'text-emerald-600'}`}>
                            {formatCurrency(margin)}
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex gap-2">
                    <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Batal</Button>
                    <Button type="button" onClick={() => onSave(parseFloat(price))} disabled={saving} className="flex-1">
                        {saving ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
