import { router } from '@inertiajs/react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import CenterPriceEditModal from '@/components/owner/center-price-edit-modal';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatMarginPercent } from '@/lib/format';
import { marginColor } from '@/lib/pricing-utils';

interface VariantRow {
    variant_id: number;
    name: string;
    family_name: string | null;
    flavor: string | null;
    size: string | null;
    center_price: number;
    selling_price: number;
    margin: number;
}

interface ImpactData {
    total_outlets: number;
    affected_outlets: number;
    negative_margin_outlets: number;
    low_margin_outlets: number;
}

interface Props {
    variants: VariantRow[];
}

export default function PricingMaster({ variants }: Props) {
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedVariant, setSelectedVariant] = useState<VariantRow | null>(null);
    const [impact, setImpact] = useState<ImpactData | null>(null);
    const [saving, setSaving] = useState(false);
    const [sortField, setSortField] = useState<'name' | 'center_price' | 'selling_price' | 'margin'>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [currentPage, setCurrentPage] = useState(1);

    const ITEMS_PER_PAGE = 20;

    const toggleSort = (field: typeof sortField) => {
        if (sortField === field) {
            setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDir('asc');
        }

        setCurrentPage(1);
    };

    const filtered = variants.filter((v) => {
        if (!search) {
return true;
}

        const q = search.toLowerCase();

        return v.name.toLowerCase().includes(q) || (v.family_name ?? '').toLowerCase().includes(q);
    });

    const handleOpenModal = useCallback(async (variant: VariantRow) => {
        setSelectedVariant(variant);
        setImpact(null);
        setModalOpen(true);

        // Fetch impact preview
        try {
            const res = await fetch(`/owner/pricing/master/${variant.variant_id}/impact?center_price=${variant.center_price}`);

            if (res.ok) {
                setImpact(await res.json());
            }
        } catch {
            // Non-critical
        }
    }, []);

    const handleSave = useCallback((newCenterPrice: number) => {
        if (!selectedVariant) {
return;
}

        setSaving(true);
        router.patch(`/owner/pricing/master/${selectedVariant.variant_id}`, {
            center_price: newCenterPrice,
        }, {
            onFinish: () => {
                setSaving(false);
                setModalOpen(false);
                setSelectedVariant(null);
                setImpact(null);
            },
        });
    }, [selectedVariant]);

    const sortedVariants = useMemo(() => {
        return [...filtered].sort((a, b) => {
            let cmp = 0;

            switch (sortField) {
                case 'name':
                    cmp = a.name.localeCompare(b.name);
                    break;
                case 'center_price':
                    cmp = a.center_price - b.center_price;
                    break;
                case 'selling_price':
                    cmp = a.selling_price - b.selling_price;
                    break;
                case 'margin':
                    cmp = a.margin - b.margin;
                    break;
            }

            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [filtered, sortField, sortDir]);

    const totalPages = Math.ceil(sortedVariants.length / ITEMS_PER_PAGE);
    const paginatedVariants = sortedVariants.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE,
    );

    return (
        <OwnerPageShell title="Harga Pusat" subtitle="Kelola harga pusat dan harga jual default">
            {/* Search */}
            <div className="mb-4">
                <Input
                    icon={Search}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari produk..."
                    aria-label="Cari produk"
                />
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-surface">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-100">
                                <th
                                    className="cursor-pointer px-4 py-3 text-left font-medium text-text-muted hover:bg-zinc-100"
                                    onClick={() => toggleSort('name')}
                                >
                                    <span className="inline-flex items-center gap-1">
                                        Produk
                                        {sortField === 'name' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                                    </span>
                                </th>
                                <th
                                    className="cursor-pointer px-4 py-3 text-right font-medium text-text-muted hover:bg-zinc-100"
                                    onClick={() => toggleSort('center_price')}
                                >
                                    <span className="inline-flex items-center gap-1 justify-end">
                                        Harga Pusat
                                        {sortField === 'center_price' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                                    </span>
                                </th>
                                <th
                                    className="cursor-pointer px-4 py-3 text-right font-medium text-text-muted hover:bg-zinc-100"
                                    onClick={() => toggleSort('selling_price')}
                                >
                                    <span className="inline-flex items-center gap-1 justify-end">
                                        Harga Default
                                        {sortField === 'selling_price' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                                    </span>
                                </th>
                                <th
                                    className="cursor-pointer px-4 py-3 text-right font-medium text-text-muted hover:bg-zinc-100"
                                    onClick={() => toggleSort('margin')}
                                >
                                    <span className="inline-flex items-center gap-1 justify-end">
                                        Margin
                                        {sortField === 'margin' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                                    </span>
                                </th>
                                <th className="px-4 py-3 text-right font-medium text-text-muted">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedVariants.map((v) => (
                                <tr key={v.variant_id} className="border-b border-slate-50 last:border-0">
                                    <td className="px-4 py-3">
                                        <div className="font-semibold text-text">{v.name}</div>
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-text">
                                        {formatCurrency(v.center_price)}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                                        {formatCurrency(v.selling_price)}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${marginColor(v.margin, v.selling_price)}`}>
                                        {formatCurrency(v.margin)} {formatMarginPercent(v.margin, v.selling_price)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleOpenModal(v)}
                                            className="text-emerald-700 hover:bg-emerald-50"
                                        >
                                            Ubah Harga Pusat
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {sortedVariants.length === 0 && (
                    <div className="p-8 text-center text-sm text-text-muted">
                        {search ? 'Produk tidak ditemukan.' : 'Belum ada produk aktif.'}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3 mt-4 rounded-xl border border-border bg-surface">
                    <span className="text-sm text-text-muted">
                        Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, sortedVariants.length)} dari {sortedVariants.length} produk
                    </span>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            Sebelumnya
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            Berikutnya
                        </Button>
                    </div>
                </div>
            )}

            {/* Center Price Edit Modal */}
            {selectedVariant && (
                <CenterPriceEditModal
                    open={modalOpen}
                    onClose={() => {
 setModalOpen(false); setSelectedVariant(null); setImpact(null); 
}}
                    productName={selectedVariant.name}
                    currentCenterPrice={selectedVariant.center_price}
                    impact={impact}
                    onSave={handleSave}
                    saving={saving}
                />
            )}
        </OwnerPageShell>
    );
}
