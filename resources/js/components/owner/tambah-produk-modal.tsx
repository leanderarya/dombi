import { Search, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '@/lib/format';

interface AvailableProduct {
    variant_id: number;
    name: string;
    family_name: string;
    selling_price: number;
}

interface Props {
    open: boolean;
    onClose: () => void;
    outletId: number;
    onSuccess: () => void;
}

export default function TambahProdukModal({ open, onClose, outletId, onSuccess }: Props) {
    const [products, setProducts] = useState<AvailableProduct[]>([]);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [search, setSearch] = useState('');
    const [initialStock, setInitialStock] = useState('0');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
return;
}

        setLoading(true);
        setSelected(new Set());
        setSearch('');
        setInitialStock('0');

        fetch(`/owner/outlets/${outletId}/products/available`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
        })
            .then((res) => res.ok ? res.json() : [])
            .then(setProducts)
            .catch(() => setProducts([]))
            .finally(() => setLoading(false));
    }, [open, outletId]);

    const toggle = (id: number) => {
        setSelected((prev) => {
            const next = new Set(prev);

            if (next.has(id)) {
next.delete(id);
} else {
next.add(id);
}

            return next;
        });
    };

    const selectAll = () => {
        const filteredIds = filtered.map((p) => p.variant_id);
        setSelected(new Set(filteredIds));
    };

    const handleSubmit = async () => {
        if (selected.size === 0) {
return;
}

        setSaving(true);
        setError(null);

        try {
            const res = await fetch(`/owner/outlets/${outletId}/products`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
                },
                body: JSON.stringify({
                    variant_ids: Array.from(selected),
                    initial_stock: parseInt(initialStock) || 0,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                onSuccess();
                onClose();
            } else {
                setError(data.error ?? 'Gagal menambahkan produk.');
            }
        } catch {
            setError('Gagal menambahkan produk.');
        } finally {
            setSaving(false);
        }
    };

    const filtered = products.filter((p) => {
        if (!search) {
return true;
}

        const q = search.toLowerCase();

        return p.name.toLowerCase().includes(q) || p.family_name.toLowerCase().includes(q);
    });

    if (!open) {
return null;
}

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative flex h-[80vh] w-full max-w-lg flex-col rounded-t-2xl bg-white lg:h-auto lg:max-h-[70vh] lg:rounded-xl lg:shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                    <h2 className="text-base font-bold text-slate-900">Tambah Produk Outlet</h2>
                    <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Search */}
                <div className="border-b border-slate-100 px-5 py-3">
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
                        <Search className="h-4 w-4 shrink-0 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari produk..."
                            className="w-full bg-transparent py-2 text-sm placeholder:text-slate-400 focus:outline-none"
                        />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                        <button type="button" onClick={selectAll} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                            Pilih Semua ({filtered.length})
                        </button>
                        <span className="text-xs text-slate-500">{selected.size} dipilih</span>
                    </div>
                </div>

                {/* Product list */}
                <div className="flex-1 overflow-y-auto px-5 py-2">
                    {loading ? (
                        <div className="py-8 text-center text-xs text-slate-400">Memuat produk...</div>
                    ) : filtered.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">Semua produk sudah ditambahkan.</div>
                    ) : (
                        <div className="space-y-1">
                            {filtered.map((p) => (
                                <label
                                    key={p.variant_id}
                                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                                        selected.has(p.variant_id)
                                            ? 'border-emerald-300 bg-emerald-50'
                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selected.has(p.variant_id)}
                                        onChange={() => toggle(p.variant_id)}
                                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium text-slate-900">{p.name}</div>
                                        <div className="text-[11px] text-slate-500">{p.family_name} · {formatCurrency(p.selling_price)}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-200 px-5 py-3">
                    <div className="mb-3 flex items-center gap-3">
                        <label className="text-xs font-semibold text-slate-600">Stok Awal</label>
                        <input
                            type="number"
                            value={initialStock}
                            onChange={(e) => setInitialStock(e.target.value)}
                            min={0}
                            className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                        />
                        <span className="text-xs text-slate-400">pcs</span>
                    </div>
                    {error && <p className="mb-2 text-xs font-medium text-red-600">{error}</p>}
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                            Batal
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={saving || selected.size === 0}
                            className="flex-[2] rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {saving ? 'Menambahkan...' : `Tambahkan ${selected.size} Produk`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    ,
        document.body,
    );

;
}
