import { router, usePage } from '@inertiajs/react';
import { ChevronDown, ChevronUp, Copy, Minus, Plus, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import PricingEditModal from '@/components/owner/pricing-edit-modal';
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
return <ChevronDown className="h-3 w-3 text-slate-300" />;
}

        return sortDir === 'asc' ? <ChevronUp className="h-3 w-3 text-emerald-600" /> : <ChevronDown className="h-3 w-3 text-emerald-600" />;
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
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => {
 setSearch(e.target.value); setPage(1); 
}}
                        placeholder="Cari produk..."
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                    />
                </div>
                <select
                    value={marginFilter}
                    onChange={(e) => {
 setMarginFilter(e.target.value as MarginFilter); setPage(1); 
}}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                >
                    <option value="all">Semua Margin</option>
                    <option value="high">Margin Tinggi (&gt;20rb)</option>
                    <option value="low">Margin Rendah (&lt;5rb)</option>
                    <option value="negative">Margin Negatif</option>
                </select>
                <button
                    type="button"
                    onClick={() => setBulkOpen(!bulkOpen)}
                    className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 active:bg-slate-50"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Atur Massal
                </button>
                {otherOutlets.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setCopyOpen(!copyOpen)}
                        className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 active:bg-slate-50"
                    >
                        <Copy className="h-3.5 w-3.5" />
                        Salin Dari
                    </button>
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
                                    <button type="button" onClick={() => setBulkAmount(String(amt))} className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${bulkAmount === String(amt) ? 'bg-amber-600 text-white' : 'bg-white text-amber-700 border border-amber-200'}`}>+{amt.toLocaleString('id-ID')}</button>
                                    <button type="button" onClick={() => setBulkAmount(String(-amt))} className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${bulkAmount === String(-amt) ? 'bg-slate-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>-{amt.toLocaleString('id-ID')}</button>
                                </div>
                            ))}
                        </div>
                        <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">Rp</span>
                            <input type="number" value={bulkAmount} onChange={(e) => setBulkAmount(e.target.value)} placeholder="Custom" className="w-24 rounded-lg border border-amber-200 bg-white py-1 pl-7 pr-2 text-xs" />
                        </div>
                        <button type="button" onClick={handleBulkUpdate} disabled={saving || !bulkAmount} className="rounded-lg bg-amber-600 px-3 py-1 text-[10px] font-bold text-white disabled:opacity-50">Terapkan</button>
                        <button type="button" onClick={() => {
 setBulkOpen(false); setBulkAmount(''); 
}} className="text-[10px] font-semibold text-amber-700">Batal</button>
                        <span className="text-[10px] text-amber-600">{sorted.length} produk</span>
                    </div>
                </div>
            )}

            {/* Copy Panel */}
            {copyOpen && (
                <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-blue-600">Salin Harga Dari Outlet Lain</div>
                    <div className="mt-2 flex items-center gap-2">
                        <select value={copySource} onChange={(e) => setCopySource(e.target.value)} className="flex-1 rounded-lg border border-blue-200 bg-white py-1.5 px-3 text-sm">
                            <option value="">Pilih outlet sumber...</option>
                            {otherOutlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                        <button type="button" onClick={handleCopy} disabled={saving || !copySource} className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50">Salin</button>
                        <button type="button" onClick={() => {
 setCopyOpen(false); setCopySource(''); 
}} className="text-xs font-semibold text-blue-700">Batal</button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="rounded-xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-white">
                            <tr className="border-b border-slate-100">
                                <th className="px-4 py-3 text-left">
                                    <button type="button" onClick={() => toggleSort('name')} className="flex items-center gap-1 font-medium text-slate-500">Produk <SortIcon column="name" /></button>
                                </th>
                                <th className="px-4 py-3 text-right">
                                    <button type="button" onClick={() => toggleSort('center_price')} className="flex items-center gap-1 font-medium text-slate-500 ml-auto">Harga Pusat <SortIcon column="center_price" /></button>
                                </th>
                                <th className="px-4 py-3 text-right">
                                    <button type="button" onClick={() => toggleSort('selling_price')} className="flex items-center gap-1 font-medium text-slate-500 ml-auto">Harga Jual <SortIcon column="selling_price" /></button>
                                </th>
                                <th className="px-4 py-3 text-right">
                                    <button type="button" onClick={() => toggleSort('margin')} className="flex items-center gap-1 font-medium text-slate-500 ml-auto">Margin <SortIcon column="margin" /></button>
                                </th>
                                <th className="px-4 py-3 text-right font-medium text-slate-500">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.map((row) => (
                                <tr key={row.variant_id} className="border-b border-slate-50 last:border-0">
                                    <td className="px-4 py-3">
                                        <div className="font-semibold text-slate-900">{row.name}</div>
                                        {row.has_override && (
                                            <span className="mt-0.5 inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">Custom</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{formatCurrency(row.center_price)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">{formatCurrency(row.selling_price)}</td>
                                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${marginColor(row.margin, row.selling_price)}`}>
                                        {formatCurrency(row.margin)} {formatMarginPercent(row.margin, row.selling_price)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button type="button" onClick={() => handleOpenModal(row)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-700 active:bg-emerald-50">Ubah</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {paginated.length === 0 && (
                    <div className="p-8 text-center text-sm text-slate-500">
                        {search || marginFilter !== 'all' ? 'Produk tidak ditemukan.' : 'Belum ada produk aktif.'}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-slate-500">{sorted.length} produk · Halaman {page} dari {totalPages}</span>
                    <div className="flex gap-1">
                        <button type="button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40">Prev</button>
                        <button type="button" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40">Next</button>
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
