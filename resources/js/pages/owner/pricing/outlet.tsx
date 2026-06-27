import { router, usePage } from '@inertiajs/react';
import { ChevronDown, ChevronUp, Copy, Minus, Plus, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import PricingEditModal from '@/components/owner/pricing-edit-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatCurrency, formatMarginPercent } from '@/lib/format';
import { marginColor } from '@/lib/pricing-utils';

interface PriceRow {
    variant_id: number;
    name: string;
    family_name: string | null;
    flavor: string | null;
    size: string | null;
    center_price: number;
    selling_price: number;
    margin: number;
    has_override: boolean;
}

interface OutletData {
    id: number;
    name: string;
}

interface OtherOutlet {
    id: number;
    name: string;
}

interface Props {
    outlet: OutletData;
    prices: PriceRow[];
    otherOutlets: OtherOutlet[];
}

type SortKey = 'name' | 'center_price' | 'selling_price' | 'margin';
type SortDir = 'asc' | 'desc';
type MarginFilter = 'all' | 'high' | 'low' | 'negative';

const ITEMS_PER_PAGE = 20;

export default function OutletPricing({ outlet, prices, otherOutlets }: Props) {
    const { flash } = usePage<any>().props;
    const [search, setSearch] = useState('');
    const [marginFilter, setMarginFilter] = useState<MarginFilter>('all');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [page, setPage] = useState(1);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedRow, setSelectedRow] = useState<PriceRow | null>(null);

    // Show warning flash as toast
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

    // Filter
    const filtered = useMemo(() => {
        return prices.filter((p) => {
            // Text search
            if (search) {
                const q = search.toLowerCase();
                const match = p.name.toLowerCase().includes(q)
                    || (p.family_name ?? '').toLowerCase().includes(q)
                    || (p.flavor ?? '').toLowerCase().includes(q)
                    || (p.size ?? '').toLowerCase().includes(q);

                if (!match) {
return false;
}
            }

            // Margin filter
            if (marginFilter === 'high' && p.margin <= 20000) {
return false;
}

            if (marginFilter === 'low' && (p.margin < 5000 || p.margin > 20000)) {
return false;
}

            if (marginFilter === 'negative' && p.margin >= 0) {
return false;
}

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

    const toggleSort = useCallback((key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }

        setPage(1);
    }, [sortKey]);

    const SortIcon = ({ column }: { column: SortKey }) => {
        if (sortKey !== column) {
return <ChevronDown className="h-3 w-3 text-text-subtle" />;
}

        return sortDir === 'asc' ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />;
    };

    const handleOpenModal = useCallback((row: PriceRow) => {
        setSelectedRow(row);
        setModalOpen(true);
    }, []);

    const handleSave = useCallback((newPrice: number) => {
        if (!selectedRow) {
return;
}

        setSaving(true);
        router.patch(`/owner/pricing/outlets/${outlet.id}/variants/${selectedRow.variant_id}`, {
            selling_price: newPrice,
        }, {
            onFinish: () => {
                setSaving(false);
                setModalOpen(false);
                setSelectedRow(null);
            },
        });
    }, [selectedRow, outlet.id]);

    const handleBulkUpdate = useCallback(() => {
        const amount = parseFloat(bulkAmount);

        if (isNaN(amount)) {
return;
}

        if (!confirm(`${sorted.length} produk akan diperbarui. Lanjutkan?`)) {
return;
}

        setSaving(true);
        router.post(`/owner/pricing/outlets/${outlet.id}/bulk-update`, {
            adjustment: amount,
        }, {
            onFinish: () => {
                setSaving(false);
                setBulkOpen(false);
                setBulkAmount('');
            },
        });
    }, [bulkAmount, outlet.id, sorted.length]);

    const handleCopy = useCallback(() => {
        if (!copySource) {
return;
}

        if (!confirm('Ini akan menimpa semua harga outlet ini. Lanjutkan?')) {
return;
}

        setSaving(true);
        router.post(`/owner/pricing/outlets/${outlet.id}/copy`, {
            source_outlet_id: parseInt(copySource),
        }, {
            onFinish: () => {
                setSaving(false);
                setCopyOpen(false);
                setCopySource('');
            },
        });
    }, [copySource, outlet.id]);

    return (
        <OwnerPageShell
            title={`Harga · ${outlet.name}`}
            subtitle="Atur harga jual produk untuk outlet ini"
            backHref="/owner/pricing"
        >
            {/* Toolbar */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[140px]">
                    <Input
                        icon={Search}
                        type="text"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value); setPage(1);
                        }}
                        placeholder="Cari produk..."
                        aria-label="Cari produk"
                    />
                </div>
                <Select
                    value={marginFilter}
                    onChange={(e) => {
                        setMarginFilter(e.target.value as MarginFilter); setPage(1);
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
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={Plus}
                    onClick={() => setBulkOpen(!bulkOpen)}
                >
                    Atur Massal
                </Button>
                {otherOutlets.length > 0 && (
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={Copy}
                        onClick={() => setCopyOpen(!copyOpen)}
                    >
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
                                    <Button type="button" size="sm" variant={bulkAmount === String(amt) ? 'primary' : 'secondary'} onClick={() => setBulkAmount(String(amt))} className="text-[11px] px-2 py-1">+{amt.toLocaleString('id-ID')}</Button>
                                    <Button type="button" size="sm" variant={bulkAmount === String(-amt) ? 'primary' : 'secondary'} onClick={() => setBulkAmount(String(-amt))} className="text-[11px] px-2 py-1">-{amt.toLocaleString('id-ID')}</Button>
                                </div>
                            ))}
                        </div>
                        <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-text-subtle">Rp</span>
                            <Input type="number" value={bulkAmount} onChange={(e) => setBulkAmount(e.target.value)} placeholder="Custom" aria-label="Jumlah kustom" className="w-24 pl-7 text-xs" />
                        </div>
                        <Button type="button" size="sm" onClick={handleBulkUpdate} disabled={saving || !bulkAmount}>Terapkan</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => {
                            setBulkOpen(false); setBulkAmount('');
                        }} className="text-amber-700">Batal</Button>
                        <span className="text-[11px] text-amber-600">{sorted.length} produk</span>
                    </div>
                </div>
            )}

            {/* Copy Panel */}
            {copyOpen && (
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
                        <Button type="button" size="sm" onClick={handleCopy} disabled={saving || !copySource}>Salin</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => {
                            setCopyOpen(false); setCopySource('');
                        }} className="text-blue-700">Batal</Button>
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
                            sortKey === col.key
                                ? 'bg-primary-light text-primary'
                                : 'bg-surface text-text-muted hover:bg-surface-muted'
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
                            <Button type="button" size="sm" variant="ghost" onClick={() => handleOpenModal(row)} className="shrink-0 text-primary">Ubah</Button>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                            <span className="text-text-muted">Pusat: <span className="tabular-nums text-text-muted">{formatCurrency(row.center_price)}</span></span>
                            <span className="text-text-muted">Jual: <span className="font-semibold tabular-nums text-text">{formatCurrency(row.selling_price)}</span></span>
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
                    <span className="text-xs text-text-muted">{sorted.length} produk · Halaman {page} dari {totalPages}</span>
                    <div className="flex gap-1">
                        <Button type="button" size="sm" variant="secondary" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Prev</Button>
                        <Button type="button" size="sm" variant="secondary" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>Next</Button>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {selectedRow && (
                <PricingEditModal
                    open={modalOpen}
                    onClose={() => {
 setModalOpen(false); setSelectedRow(null); 
}}
                    productName={selectedRow.name}
                    centerPrice={selectedRow.center_price}
                    sellingPrice={selectedRow.selling_price}
                    onSave={handleSave}
                    saving={saving}
                />
            )}
        </OwnerPageShell>
    );
}
