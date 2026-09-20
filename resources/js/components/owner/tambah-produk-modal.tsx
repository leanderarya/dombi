import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import OwnerModalShell from '@/components/owner/owner-modal-shell';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import {
    fetchAvailableProducts,
    postOutletProducts,
    runAddOutletProductsRequest,
    runAvailableProductsRequest,
} from './owner-product-requests';
import type { AvailableProduct } from './owner-product-requests';

interface Props {
    open: boolean;
    onClose: () => void;
    outletId: number;
    onSuccess: () => void;
}

export default function TambahProdukModal({
    open,
    onClose,
    outletId,
    onSuccess,
}: Props) {
    if (!open) {
        return null;
    }

    return (
        <TambahProdukModalContent
            onClose={onClose}
            outletId={outletId}
            onSuccess={onSuccess}
        />
    );
}

function TambahProdukModalContent({
    onClose,
    outletId,
    onSuccess,
}: Omit<Props, 'open'>) {
    const [products, setProducts] = useState<AvailableProduct[]>([]);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [search, setSearch] = useState('');
    const [initialStock, setInitialStock] = useState('0');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const submitControllerRef = useRef<AbortController | null>(null);

    const closeModal = () => {
        submitControllerRef.current?.abort();
        onClose();
    };

    useEffect(() => {
        const controller = new AbortController();

        void runAvailableProductsRequest({
            outletId,
            signal: controller.signal,
            request: fetchAvailableProducts,
            onProducts: setProducts,
            onSettled: () => setLoading(false),
        });

        return () => {
            controller.abort();
            submitControllerRef.current?.abort();
        };
    }, [outletId]);

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

    const handleSubmit = () => {
        if (selected.size === 0) {
            return;
        }

        submitControllerRef.current?.abort();
        const controller = new AbortController();
        submitControllerRef.current = controller;
        setSaving(true);
        setError(null);
        const csrfToken =
            document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content') ?? '';

        void runAddOutletProductsRequest({
            outletId,
            variantIds: Array.from(selected),
            initialStock: parseInt(initialStock) || 0,
            csrfToken,
            signal: controller.signal,
            request: postOutletProducts,
            onSuccess: () => {
                onSuccess();
                closeModal();
            },
            onError: setError,
            onSettled: () => {
                if (submitControllerRef.current === controller) {
                    submitControllerRef.current = null;
                }

                setSaving(false);
            },
        });
    };

    const filtered = products.filter((p) => {
        if (!search) {
            return true;
        }

        const q = search.toLowerCase();

        return (
            p.name.toLowerCase().includes(q) ||
            p.family_name.toLowerCase().includes(q)
        );
    });

    return (
        <OwnerModalShell
            open
            onClose={closeModal}
            title="Tambah Produk Outlet"
            maxWidth="max-w-lg"
        >
            {/* Search */}
            <div className="border-b border-border pb-3">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3">
                    <Search className="h-4 w-4 shrink-0 text-text-subtle" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari produk..."
                        className="w-full bg-transparent py-2 text-sm placeholder:text-text-muted focus:outline-none"
                    />
                </div>
                <div className="mt-2 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={selectAll}
                        className="text-xs font-semibold text-success-text hover:text-success-text"
                    >
                        Pilih Semua ({filtered.length})
                    </button>
                    <span className="text-xs text-text-muted">
                        {selected.size} dipilih
                    </span>
                </div>
            </div>

            {/* Product list */}
            <div className="flex-1 overflow-y-auto py-2">
                {loading ? (
                    <div className="py-8 text-center text-xs text-text-subtle">
                        Memuat produk...
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-8 text-center text-xs text-text-subtle">
                        Semua produk sudah ditambahkan.
                    </div>
                ) : (
                    <div className="space-y-1">
                        {filtered.map((p) => (
                            <label
                                key={p.variant_id}
                                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                                    selected.has(p.variant_id)
                                        ? 'border-success-border bg-success-bg'
                                        : 'border-border bg-surface hover:border-border-strong'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selected.has(p.variant_id)}
                                    onChange={() => toggle(p.variant_id)}
                                    className="h-4 w-4 rounded border-border-strong text-success-text focus:ring-success"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium text-text">
                                        {p.name}
                                    </div>
                                    <div className="text-xs text-text-muted">
                                        {p.family_name} ·{' '}
                                        {formatCurrency(p.selling_price)}
                                    </div>
                                </div>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="border-t border-border pt-3">
                <div className="mb-3 flex items-center gap-3">
                    <label className="text-xs font-semibold text-text-muted">
                        Stok Awal
                    </label>
                    <input
                        type="number"
                        value={initialStock}
                        onChange={(e) => setInitialStock(e.target.value)}
                        min={0}
                        className="w-20 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
                    />
                    <span className="text-xs text-text-subtle">pcs</span>
                </div>
                {error && (
                    <p className="mb-2 text-xs font-medium text-danger">
                        {error}
                    </p>
                )}
                <div className="flex gap-3">
                    <Button
                        type="button"
                        onClick={closeModal}
                        variant="outline"
                        size="lg"
                        className="flex-1"
                    >
                        Batal
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving || selected.size === 0}
                        size="lg"
                        className="flex-[2]"
                    >
                        {saving
                            ? 'Menambahkan...'
                            : `Tambahkan ${selected.size} Produk`}
                    </Button>
                </div>
            </div>
        </OwnerModalShell>
    );
}
