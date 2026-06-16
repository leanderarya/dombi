import { Search, ToggleLeft, ToggleRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface ProductItem {
    id: number;
    variant_id: number;
    name: string;
    family_name: string;
    is_active: boolean;
    current_stock: number;
    has_inventory: boolean;
}

interface Props {
    outletId: number;
}

export default function ProductAssignment({ outletId }: Props) {
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchProducts = useCallback(async () => {
        try {
            const res = await fetch(`/owner/outlets/${outletId}/products`, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
            });

            if (res.ok) {
                setProducts(await res.json());
            }
        } catch {
            // Non-critical
        } finally {
            setLoading(false);
        }
    }, [outletId]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const toggleProduct = async (variantId: number) => {
        try {
            const res = await fetch(`/owner/outlets/${outletId}/products/${variantId}/toggle`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
                },
            });

            if (res.ok) {
                const data = await res.json();
                setProducts((prev) =>
                    prev.map((p) => p.variant_id === variantId ? { ...p, is_active: data.is_active, has_inventory: true } : p)
                );
            }
        } catch {
            // Non-critical
        }
    };

    const filtered = products.filter((p) => {
        if (!search) {
return true;
}

        const q = search.toLowerCase();

        return p.name.toLowerCase().includes(q) || p.family_name.toLowerCase().includes(q);
    });

    if (loading) {
        return <div className="py-4 text-center text-xs text-slate-400">Memuat produk...</div>;
    }

    return (
        <div className="space-y-3">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari produk..."
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                />
            </div>

            {filtered.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-400">Tidak ada produk ditemukan.</p>
            ) : (
                <div className="space-y-1">
                    {filtered.map((p) => (
                        <div
                            key={p.variant_id}
                            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-slate-900">{p.name}</div>
                                <div className="text-[11px] text-slate-500">
                                    {p.family_name}
                                    {p.current_stock > 0 && ` · Stok: ${p.current_stock}`}
                                    {!p.has_inventory && ' · Belum ada stok'}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => toggleProduct(p.variant_id)}
                                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                    p.is_active
                                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                            >
                                {p.is_active ? (
                                    <ToggleRight className="h-4 w-4" />
                                ) : (
                                    <ToggleLeft className="h-4 w-4" />
                                )}
                                {p.is_active ? 'Aktif' : 'Nonaktif'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
