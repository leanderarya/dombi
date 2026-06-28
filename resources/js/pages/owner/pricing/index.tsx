import { Link, router } from '@inertiajs/react';
import { ChevronDown, ChevronUp, Copy, DollarSign, Minus, Package, Plus, Search, Store, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import CenterPriceEditModal from '@/components/owner/center-price-edit-modal';
import OwnerKpiCard from '@/components/owner/owner-kpi-card';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import PricingEditModal from '@/components/owner/pricing-edit-modal';
import Pagination from '@/components/pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency, formatDate, formatMarginPercent } from '@/lib/format';
import { marginColor } from '@/lib/pricing-utils';

// ─── Tab Config ───────────────────────────────────────────────

const TABS = [
    { key: 'pusat', label: 'Pusat' },
    { key: 'outlet', label: 'Outlet' },
    { key: 'riwayat', label: 'Riwayat' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// ─── Props ────────────────────────────────────────────────────

interface OutletData {
    id: number;
    name: string;
    variant_prices_count?: number;
}

interface Kpis {
    total_variants: number;
    total_outlets: number;
    total_overrides: number;
    lowest_margin: number;
}

interface VariantRow {
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

interface ImpactData {
    total_outlets: number;
    affected_outlets: number;
    negative_margin_outlets: number;
    low_margin_outlets: number;
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

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginatedLogs {
    data: AuditLog[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: PaginationLink[];
}

interface Props {
    // Pusat tab
    outlets: OutletData[];
    kpis: Kpis;
    // Outlet tab (when viewing a specific outlet)
    outlet?: OutletData;
    prices?: VariantRow[];
    otherOutlets?: OtherOutlet[];
    // Riwayat tab
    logs?: PaginatedLogs;
}

// ─── Main Page ────────────────────────────────────────────────

export default function PricingIndex({ ...props }: Props) {
    const [activeTab, setActiveTab] = useState<TabKey>('pusat');

    // Sync tab with URL on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab && TABS.some((t) => t.key === tab)) {
            setActiveTab(tab as TabKey);
        }
    }, []);

    const handleTabChange = (tab: TabKey) => {
        setActiveTab(tab);
        router.get('/owner/pricing', { tab }, { preserveState: true, replace: true });
    };

    return (
        <OwnerPageShell title="Harga" subtitle="Kelola harga jual produk">
            {/* Tab Pills */}
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => handleTabChange(tab.key)}
                        className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                            activeTab === tab.key
                                ? 'bg-primary text-white shadow-sm shadow-primary/20'
                                : 'bg-surface-muted text-text-muted hover:bg-zinc-200'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'pusat' && <PusatTab kpis={props.kpis} outlets={props.outlets} />}
            {activeTab === 'outlet' && <OutletTab outlet={props.outlet} prices={props.prices} otherOutlets={props.otherOutlets} outlets={props.outlets} />}
            {activeTab === 'riwayat' && <RiwayatTab logs={props.logs} />}
        </OwnerPageShell>
    );
}

// ─── Pusat Tab ────────────────────────────────────────────────

function PusatTab({ kpis, outlets }: { kpis?: Kpis; outlets?: OutletData[] }) {
    if (!kpis || !outlets) {
        return (
            <div className="rounded-xl border border-border bg-white p-8 text-center text-sm text-text-muted">
                Memuat data harga pusat...
            </div>
        );
    }

    return (
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
            {/* Left: Outlet Card Grid */}
            <div>
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Pilih Outlet</h2>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {outlets.map((outlet) => (
                        <Link
                            key={outlet.id}
                            href={`/owner/pricing/outlets/${outlet.id}`}
                            className="flex items-center gap-4 rounded-xl border border-border bg-white p-4 transition-colors hover:border-primary/20 hover:bg-primary-light/30 active:opacity-80"
                        >
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-light">
                                <Store className="h-6 w-6 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-bold text-text">{outlet.name}</div>
                                <div className="mt-0.5 text-xs text-text-muted">
                                    {outlet.variant_prices_count ?? 0} Produk
                                </div>
                            </div>
                            <svg className="h-4 w-4 shrink-0 text-text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </Link>
                    ))}
                    {outlets.length === 0 && (
                        <div className="col-span-full rounded-xl border border-border bg-white p-8 text-center">
                            <Store className="mx-auto h-10 w-10 text-text-subtle" />
                            <p className="mt-2 text-sm font-semibold text-text">Belum ada outlet aktif</p>
                            <p className="mt-1 text-xs text-text-muted">Tambahkan outlet terlebih dahulu untuk mengelola harga.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right: KPI Sidebar */}
            <aside className="hidden lg:block">
                <div className="sticky top-4 space-y-3">
                    <OwnerKpiCard
                        label="Total Produk"
                        value={kpis.total_variants}
                        icon={<Package className="h-5 w-5" />}
                    />
                    <OwnerKpiCard
                        label="Total Outlet"
                        value={kpis.total_outlets}
                        icon={<Store className="h-5 w-5" />}
                    />
                    <OwnerKpiCard
                        label="Harga Bervariasi"
                        value={kpis.total_overrides}
                        icon={<DollarSign className="h-5 w-5" />}
                    />
                    <OwnerKpiCard
                        label="Margin Terendah"
                        value={formatCurrency(kpis.lowest_margin)}
                        icon={<TrendingUp className="h-5 w-5" />}
                    />
                </div>
            </aside>
        </div>
    );
}

// ─── Outlet Tab ───────────────────────────────────────────────

type SortKey = 'name' | 'center_price' | 'selling_price' | 'margin';
type SortDir = 'asc' | 'desc';
type MarginFilter = 'all' | 'high' | 'low' | 'negative';

const ITEMS_PER_PAGE = 20;

function OutletTab({ outlet, prices, otherOutlets, outlets }: {
    outlet?: OutletData;
    prices?: VariantRow[];
    otherOutlets?: OtherOutlet[];
    outlets?: OutletData[];
}) {
    const { flash } = (window as any).__inertiaPageProps ?? {};
    const [search, setSearch] = useState('');
    const [marginFilter, setMarginFilter] = useState<MarginFilter>('all');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [page, setPage] = useState(1);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedRow, setSelectedRow] = useState<VariantRow | null>(null);

    useEffect(() => {
        if (flash?.warning) {
            toast.warning(flash.warning);
        }
    }, [flash?.warning]);

    const [saving, setSaving] = useState(false);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkAmount, setBulkAmount] = useState('');
    const [copyOpen, setCopyOpen] = useState(false);
    const [copySource, setCopySource] = useState('');

    // If no outlet is selected, show outlet selector
    if (!outlet || !prices) {
        if (!outlets || outlets.length === 0) {
            return (
                <div className="rounded-xl border border-border bg-white p-8 text-center">
                    <Store className="mx-auto h-10 w-10 text-text-subtle" />
                    <p className="mt-2 text-sm font-semibold text-text">Belum ada outlet aktif</p>
                    <p className="mt-1 text-xs text-text-muted">Tambahkan outlet terlebih dahulu untuk mengelola harga.</p>
                </div>
            );
        }

        return (
            <div>
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Pilih Outlet</h2>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {outlets.map((o) => (
                        <Link
                            key={o.id}
                            href={`/owner/pricing/outlets/${o.id}`}
                            className="flex items-center gap-4 rounded-xl border border-border bg-white p-4 transition-colors hover:border-primary/20 hover:bg-primary-light/30 active:opacity-80"
                        >
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-light">
                                <Store className="h-6 w-6 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-bold text-text">{o.name}</div>
                                <div className="mt-0.5 text-xs text-text-muted">{o.variant_prices_count ?? 0} Produk</div>
                            </div>
                            <svg className="h-4 w-4 shrink-0 text-text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </Link>
                    ))}
                </div>
            </div>
        );
    }

    // Filter
    const filtered = useMemo(() => {
        return prices.filter((p) => {
            if (search) {
                const q = search.toLowerCase();
                const match =
                    p.name.toLowerCase().includes(q) ||
                    (p.family_name ?? '').toLowerCase().includes(q) ||
                    (p.flavor ?? '').toLowerCase().includes(q) ||
                    (p.size ?? '').toLowerCase().includes(q);
                if (!match) return false;
            }
            if (marginFilter === 'high' && p.margin <= 20000) return false;
            if (marginFilter === 'low' && (p.margin < 5000 || p.margin > 20000)) return false;
            if (marginFilter === 'negative' && p.margin >= 0) return false;
            return true;
        });
    }, [prices, search, marginFilter]);

    // Sort
    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            const aVal = a[sortKey];
            const bVal = b[sortKey];
            const cmp = typeof aVal === 'string' ? aVal.localeCompare(String(bVal)) : Number(aVal) - Number(bVal);
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [filtered, sortKey, sortDir]);

    // Paginate
    const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
    const paginated = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const toggleSort = useCallback(
        (key: SortKey) => {
            if (sortKey === key) {
                setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
            } else {
                setSortKey(key);
                setSortDir('asc');
            }
            setPage(1);
        },
        [sortKey],
    );

    const SortIcon = ({ column }: { column: SortKey }) => {
        if (sortKey !== column) return <ChevronDown className="h-3 w-3 text-text-subtle" />;
        return sortDir === 'asc' ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />;
    };

    const handleOpenModal = useCallback((row: VariantRow) => {
        setSelectedRow(row);
        setModalOpen(true);
    }, []);

    const handleSave = useCallback(
        (newPrice: number) => {
            if (!selectedRow) return;
            setSaving(true);
            router.patch(
                `/owner/pricing/outlets/${outlet.id}/variants/${selectedRow.variant_id}`,
                { selling_price: newPrice },
                {
                    onFinish: () => {
                        setSaving(false);
                        setModalOpen(false);
                        setSelectedRow(null);
                    },
                },
            );
        },
        [selectedRow, outlet.id],
    );

    const handleBulkUpdate = useCallback(() => {
        const amount = parseFloat(bulkAmount);
        if (isNaN(amount)) return;
        if (!confirm(`${sorted.length} produk akan diperbarui. Lanjutkan?`)) return;
        setSaving(true);
        router.post(
            `/owner/pricing/outlets/${outlet.id}/bulk-update`,
            { adjustment: amount },
            {
                onFinish: () => {
                    setSaving(false);
                    setBulkOpen(false);
                    setBulkAmount('');
                },
            },
        );
    }, [bulkAmount, outlet.id, sorted.length]);

    const handleCopy = useCallback(() => {
        if (!copySource) return;
        if (!confirm('Ini akan menimpa semua harga outlet ini. Lanjutkan?')) return;
        setSaving(true);
        router.post(
            `/owner/pricing/outlets/${outlet.id}/copy`,
            { source_outlet_id: parseInt(copySource) },
            {
                onFinish: () => {
                    setSaving(false);
                    setCopyOpen(false);
                    setCopySource('');
                },
            },
        );
    }, [copySource, outlet.id]);

    return (
        <div>
            {/* Toolbar */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-35">
                    <Input
                        icon={Search}
                        type="text"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        placeholder="Cari produk..."
                        aria-label="Cari produk"
                    />
                </div>
                <Select
                    value={marginFilter}
                    onChange={(e) => {
                        setMarginFilter(e.target.value as MarginFilter);
                        setPage(1);
                    }}
                    options={[
                        { value: 'all', label: 'Semua Margin' },
                        { value: 'high', label: 'Margin Tinggi (>20rb)' },
                        { value: 'low', label: 'Margin Rendah (<5rb)' },
                        { value: 'negative', label: 'Margin Negatif' },
                    ]}
                    aria-label="Filter margin"
                    className="text-xs font-semibold"
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
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-600">Atur Semua Harga</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <div className="flex flex-wrap gap-1">
                            {[1000, 2000, 5000, 10000].map((amt) => (
                                <div key={amt} className="flex gap-0.5">
                                    <Button type="button" size="sm" variant={bulkAmount === String(amt) ? 'primary' : 'secondary'} onClick={() => setBulkAmount(String(amt))} className="px-2 py-1 text-[11px]">
                                        +{amt.toLocaleString('id-ID')}
                                    </Button>
                                    <Button type="button" size="sm" variant={bulkAmount === String(-amt) ? 'primary' : 'secondary'} onClick={() => setBulkAmount(String(-amt))} className="px-2 py-1 text-[11px]">
                                        -{amt.toLocaleString('id-ID')}
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-text-subtle">Rp</span>
                            <Input type="number" value={bulkAmount} onChange={(e) => setBulkAmount(e.target.value)} placeholder="Custom" aria-label="Jumlah kustom" className="w-24 pl-7 text-xs" />
                        </div>
                        <Button type="button" size="sm" onClick={handleBulkUpdate} disabled={saving || !bulkAmount}>
                            Terapkan
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => { setBulkOpen(false); setBulkAmount(''); }} className="text-amber-700">
                            Batal
                        </Button>
                        <span className="text-[11px] text-amber-600">{sorted.length} produk</span>
                    </div>
                </div>
            )}

            {/* Copy Panel */}
            {copyOpen && otherOutlets && (
                <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-blue-600">Salin Harga Dari Outlet Lain</div>
                    <div className="mt-2 flex items-center gap-2">
                        <Select
                            value={copySource}
                            onChange={(e) => setCopySource(e.target.value)}
                            options={otherOutlets.map((o) => ({ value: String(o.id), label: o.name }))}
                            placeholder="Pilih outlet sumber..."
                            aria-label="Outlet sumber"
                            className="flex-1"
                        />
                        <Button type="button" size="sm" onClick={handleCopy} disabled={saving || !copySource}>
                            Salin
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => { setCopyOpen(false); setCopySource(''); }} className="text-blue-700">
                            Batal
                        </Button>
                    </div>
                </div>
            )}

            {/* Sort Bar */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-text-muted">Urutkan:</span>
                {[
                    { key: 'name' as SortKey, label: 'Produk' },
                    { key: 'center_price' as SortKey, label: 'Harga Pusat' },
                    { key: 'selling_price' as SortKey, label: 'Harga Jual' },
                    { key: 'margin' as SortKey, label: 'Margin' },
                ].map((col) => (
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

            {/* Card List */}
            <div className="space-y-2">
                {paginated.map((row) => (
                    <div key={row.variant_id} className="rounded-xl border border-border bg-surface p-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="font-semibold text-text">{row.name}</div>
                                {row.has_override && (
                                    <span className="mt-0.5 inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold text-blue-600">Custom</span>
                                )}
                            </div>
                            <Button type="button" size="sm" variant="ghost" onClick={() => handleOpenModal(row)} className="shrink-0 text-primary">
                                Ubah
                            </Button>
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
                    <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-text-muted">
                        {search || marginFilter !== 'all' ? 'Produk tidak ditemukan.' : 'Belum ada produk aktif.'}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-text-muted">
                        {sorted.length} produk &middot; Halaman {page} dari {totalPages}
                    </span>
                    <div className="flex gap-1">
                        <Button type="button" size="sm" variant="secondary" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
                            Prev
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
                            Next
                        </Button>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {selectedRow && (
                <PricingEditModal
                    open={modalOpen}
                    onClose={() => { setModalOpen(false); setSelectedRow(null); }}
                    productName={selectedRow.name}
                    centerPrice={selectedRow.center_price}
                    sellingPrice={selectedRow.selling_price}
                    onSave={handleSave}
                    saving={saving}
                />
            )}
        </div>
    );
}

// ─── Riwayat Tab ──────────────────────────────────────────────

const actionLabels: Record<string, string> = {
    update: 'Ubah',
    bulk_update: 'Ubah Massal',
    copy: 'Salin',
    master_update: 'Harga Pusat',
};

const actionVariants: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
    update: 'info',
    bulk_update: 'warning',
    copy: 'neutral',
    master_update: 'success',
};

function RiwayatTab({ logs }: { logs?: PaginatedLogs }) {
    if (!logs) {
        return (
            <div className="rounded-xl border border-border bg-white p-8 text-center text-sm text-text-muted">
                Memuat riwayat harga...
            </div>
        );
    }

    if (logs.data.length === 0) {
        return (
            <div className="rounded-xl border border-border bg-white p-10 text-center">
                <p className="text-sm text-text-muted">Belum ada riwayat perubahan harga.</p>
            </div>
        );
    }

    return (
        <div>
            <div className="space-y-3">
                {logs.data.map((log) => (
                    <div key={log.id} className="rounded-xl border border-border bg-white p-5 transition-all duration-200 hover:shadow-md">
                        {/* Top row: product + action badge + new price */}
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="text-lg font-bold text-text">{log.product}</div>
                                <div className="mt-1">
                                    <StatusBadge variant={actionVariants[log.action] ?? 'neutral'} size="sm">
                                        {actionLabels[log.action] ?? log.action}
                                    </StatusBadge>
                                </div>
                            </div>
                            <span className="text-lg font-bold tabular-nums text-primary">{formatCurrency(log.new_price)}</span>
                        </div>

                        {/* Middle row: metadata */}
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
                            <span>{log.outlet}</span>
                            <span className="text-text-subtle">&middot;</span>
                            <span>{formatDate(log.created_at)}</span>
                            <span className="text-text-subtle">&middot;</span>
                            <span>{log.changed_by}</span>
                            {log.old_price != null && (
                                <>
                                    <span className="text-text-subtle">&middot;</span>
                                    <span>
                                        Lama: <span className="line-through">{formatCurrency(log.old_price)}</span>
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {logs.links && logs.links.length > 3 && <Pagination links={logs.links} />}
        </div>
    );
}
