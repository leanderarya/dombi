import { Head, router } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useCallback, useState } from 'react';
import CenterPriceEditModal from '@/components/owner/center-price-edit-modal';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { formatCurrency, formatMarginPercent } from '@/lib/format';

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

    const marginColor = (margin: number, sellingPrice: number) => {
        const pct = sellingPrice > 0 ? (margin / sellingPrice) * 100 : 0;

        if (pct > 20) {
return 'text-emerald-600';
}

        if (pct >= 10) {
return 'text-blue-600';
}

        if (pct >= 0) {
return 'text-amber-600';
}

        return 'text-red-600';
    };

    return (
        <OwnerPageShell title="Harga Pusat" subtitle="Kelola harga pusat dan harga jual default">
            {/* Search */}
            <div className="mb-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari produk..."
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="px-4 py-3 text-left font-medium text-slate-500">Produk</th>
                                <th className="px-4 py-3 text-right font-medium text-slate-500">Harga Pusat</th>
                                <th className="px-4 py-3 text-right font-medium text-slate-500">Harga Default</th>
                                <th className="px-4 py-3 text-right font-medium text-slate-500">Margin</th>
                                <th className="px-4 py-3 text-right font-medium text-slate-500">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((v) => (
                                <tr key={v.variant_id} className="border-b border-slate-50 last:border-0">
                                    <td className="px-4 py-3">
                                        <div className="font-semibold text-slate-900">{v.name}</div>
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                                        {formatCurrency(v.center_price)}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                                        {formatCurrency(v.selling_price)}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${marginColor(v.margin, v.selling_price)}`}>
                                        {formatCurrency(v.margin)} {formatMarginPercent(v.margin, v.selling_price)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenModal(v)}
                                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 active:bg-emerald-50"
                                        >
                                            Ubah Harga Pusat
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filtered.length === 0 && (
                    <div className="p-8 text-center text-sm text-slate-500">
                        {search ? 'Produk tidak ditemukan.' : 'Belum ada produk aktif.'}
                    </div>
                )}
            </div>

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
