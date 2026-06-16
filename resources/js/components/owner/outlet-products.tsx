import { MoreHorizontal, Package, Plus, Search, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '@/lib/format';
import RestockModal from './restock-modal';
import TambahProdukModal from './tambah-produk-modal';

interface ProductItem {
    id: number;
    variant_id: number;
    name: string;
    family_name: string;
    selling_price: number;
    is_active: boolean;
    current_stock: number;
    available_stock: number;
    stock_status: 'ok' | 'low' | 'out_of_stock';
}

interface Props {
    outletId: number;
}

export default function OutletProducts({ outletId }: Props) {
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [restockTarget, setRestockTarget] = useState<ProductItem | null>(null);
    const [addOpen, setAddOpen] = useState(false);

    const fetchProducts = useCallback(async () => {
        try {
            const res = await fetch(`/owner/outlets/${outletId}/products`, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
            });

            if (res.ok) {
setProducts(await res.json());
}
        } catch { /* non-critical */ } finally {
            setLoading(false);
        }
    }, [outletId]);

    useEffect(() => {
 fetchProducts(); 
}, [fetchProducts]);

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

    const apiCall = async (url: string, method: string, body?: any) => {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrfToken },
            body: body ? JSON.stringify(body) : undefined,
        });

        return res.ok;
    };

    const handleToggle = async (variantId: number) => {
        if (await apiCall(`/owner/outlets/${outletId}/products/${variantId}/toggle`, 'PUT')) {
            setProducts((prev) => prev.map((p) => p.variant_id === variantId ? { ...p, is_active: !p.is_active } : p));
        }
    };

    const handleRemove = async (variantId: number) => {
        if (!confirm('Nonaktifkan produk ini dari outlet?')) {
return;
}

        if (await apiCall(`/owner/outlets/${outletId}/products/${variantId}`, 'DELETE')) {
            setProducts((prev) => prev.filter((p) => p.variant_id !== variantId));
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
        return <div className="py-6 text-center text-xs text-slate-400">Memuat produk...</div>;
    }

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari produk..."
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-bold text-white hover:bg-emerald-700"
                >
                    <Plus className="h-4 w-4" />
                    Tambah Produk
                </button>
            </div>

            {/* Empty State */}
            {products.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-10 text-center">
                    <Package className="mb-3 h-10 w-10 text-slate-300" />
                    <div className="text-sm font-semibold text-slate-700">Belum ada produk outlet</div>
                    <div className="mt-1 text-xs text-slate-500">Tambahkan produk pertama untuk outlet ini.</div>
                    <button
                        type="button"
                        onClick={() => setAddOpen(true)}
                        className="mt-4 flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                        <Plus className="h-4 w-4" />
                        Tambah Produk
                    </button>
                </div>
            )}

            {/* Table */}
            {filtered.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50">
                                <th className="px-3 py-2.5 text-left font-medium text-slate-500">Produk</th>
                                <th className="px-3 py-2.5 text-left font-medium text-slate-500">Status</th>
                                <th className="px-3 py-2.5 text-right font-medium text-slate-500">Harga Jual</th>
                                <th className="px-3 py-2.5 text-right font-medium text-slate-500">Stok</th>
                                <th className="px-3 py-2.5 text-right font-medium text-slate-500">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((p) => (
                                <tr key={p.variant_id} className="border-b border-slate-50 last:border-0">
                                    <td className="px-3 py-2.5">
                                        <div className="font-medium text-slate-900">{p.name}</div>
                                        <div className="text-[11px] text-slate-500">{p.family_name}</div>
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <StatusBadge active={p.is_active} />
                                    </td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                                        {formatCurrency(p.selling_price)}
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                        <StockBadge status={p.stock_status} stock={p.available_stock} />
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                        <ActionMenu
                                            variantId={p.variant_id}
                                            isActive={p.is_active}
                                            onRestock={() => setRestockTarget(p)}
                                            onToggle={() => handleToggle(p.variant_id)}
                                            onRemove={() => handleRemove(p.variant_id)}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modals */}
            <TambahProdukModal
                open={addOpen}
                onClose={() => setAddOpen(false)}
                outletId={outletId}
                onSuccess={fetchProducts}
            />
            {restockTarget && (
                <RestockModal
                    open={!!restockTarget}
                    onClose={() => setRestockTarget(null)}
                    outletId={outletId}
                    variantId={restockTarget.variant_id}
                    productName={restockTarget.name}
                    currentStock={restockTarget.current_stock}
                    onSuccess={fetchProducts}
                />
            )}
        </div>
    );
}

function StatusBadge({ active }: { active: boolean }) {
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
        }`}>
            {active ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />}
            {active ? 'Aktif' : 'Nonaktif'}
        </span>
    );
}

function StockBadge({ status, stock }: { status: string; stock: number }) {
    if (status === 'out_of_stock') {
        return <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">Habis</span>;
    }

    if (status === 'low') {
        return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Menipis ({stock})</span>;
    }

    return <span className="tabular-nums text-slate-700">{stock} pcs</span>;
}

function ActionMenu({ variantId, isActive, onRestock, onToggle, onRemove }: {
    variantId: number;
    isActive: boolean;
    onRestock: () => void;
    onToggle: () => void;
    onRemove: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, right: 0 });
    const triggerRef = useRef<HTMLButtonElement>(null);

    const handleOpen = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPos({
                top: rect.bottom + 4,
                right: window.innerWidth - rect.right,
            });
        }

        setOpen(true);
    };

    useEffect(() => {
        if (!open) {
return;
}

        const handler = (e: MouseEvent) => {
            if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const escHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
setOpen(false);
}
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('keydown', escHandler);

        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('keydown', escHandler);
        };
    }, [open]);

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={open ? () => setOpen(false) : handleOpen}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
                <MoreHorizontal className="h-4 w-4" />
            </button>
            {open && createPortal(
                <div
                    className="fixed z-[100] min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                    style={{ top: pos.top, right: pos.right }}
                >
                    <button
                        type="button"
                        onClick={() => {
 onRestock(); setOpen(false); 
}}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                        Restock
                    </button>
                    <button
                        type="button"
                        onClick={() => {
 onToggle(); setOpen(false); 
}}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                        {isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
 onRemove(); setOpen(false); 
}}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Hapus dari Outlet
                    </button>
                </div>,
                document.body
            )}
        </>
    );
}
