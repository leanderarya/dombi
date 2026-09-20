import { useState } from 'react';
import OwnerModalShell from '@/components/owner/owner-modal-shell';

interface Props {
    open: boolean;
    onClose: () => void;
    outletId: number;
    variantId: number;
    productName: string;
    currentStock: number;
    onSuccess: () => void;
}

export default function RestockModal({
    open,
    onClose,
    outletId,
    variantId,
    productName,
    currentStock,
    onSuccess,
}: Props) {
    const [quantity, setQuantity] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const qty = parseInt(quantity) || 0;
    const newStock = currentStock + qty;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (qty <= 0) {
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const res = await fetch(`/owner/outlets/${outletId}/restock`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN':
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute('content') ?? '',
                },
                body: JSON.stringify({
                    variant_id: variantId,
                    quantity: qty,
                    notes: notes || null,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                onSuccess();
                onClose();
                setQuantity('');
                setNotes('');
            } else {
                setError(data.error ?? 'Gagal melakukan restock.');
            }
        } catch {
            setError('Gagal melakukan restock.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <OwnerModalShell
            open={open}
            onClose={onClose}
            title="Restock Produk"
            maxWidth="max-w-md"
        >
            <form onSubmit={handleSubmit}>
                <div className="mt-4">
                    <div className="text-xs font-bold tracking-wider text-text-subtle uppercase">
                        Produk
                    </div>
                    <div className="mt-1 text-sm font-semibold text-text">
                        {productName}
                    </div>
                </div>

                <div className="mt-3">
                    <div className="text-xs font-bold tracking-wider text-text-subtle uppercase">
                        Stok Saat Ini
                    </div>
                    <div className="mt-1 text-sm font-semibold text-text">
                        {currentStock} pcs
                    </div>
                </div>

                <div className="mt-3">
                    <label className="text-xs font-bold tracking-wider text-text-subtle uppercase">
                        Tambah Stok
                    </label>
                    <div className="mt-1 flex gap-2">
                        {[10, 25, 50, 100].map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() =>
                                    setQuantity(
                                        String((parseInt(quantity) || 0) + n),
                                    )
                                }
                                className="rounded-lg border border-success-border bg-success-bg px-2.5 py-1.5 text-xs font-semibold text-success-text hover:bg-success-bg"
                            >
                                +{n}
                            </button>
                        ))}
                    </div>
                    <div className="relative mt-2">
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            min={1}
                            placeholder="Jumlah"
                            className="w-full rounded-lg border border-border bg-surface py-2.5 pr-12 pl-4 text-sm font-bold tabular-nums focus:border-success focus:ring-1 focus:ring-success-border"
                            autoFocus
                        />
                        <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-text-subtle">
                            pcs
                        </span>
                    </div>
                </div>

                <div className="mt-3">
                    <label className="text-xs font-bold tracking-wider text-text-subtle uppercase">
                        Catatan
                    </label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Catatan restock (opsional)"
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-success focus:ring-1 focus:ring-success-border"
                    />
                </div>

                {qty > 0 && (
                    <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2.5">
                        <span className="text-xs text-text-muted">
                            Stok Setelah Restock
                        </span>
                        <span className="text-sm font-bold text-success-text tabular-nums">
                            {newStock} pcs
                        </span>
                    </div>
                )}

                {error && (
                    <p className="mt-2 text-xs font-medium text-danger">
                        {error}
                    </p>
                )}

                <div className="mt-5 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-lg border border-border bg-surface py-2.5 text-sm font-bold text-text hover:bg-surface-muted"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={saving || qty <= 0}
                        className="flex-[2] rounded-lg bg-primary py-2.5 text-sm font-bold text-white hover:bg-primary-hover disabled:opacity-50"
                    >
                        {saving ? 'Menyimpan...' : 'Simpan Restock'}
                    </button>
                </div>
            </form>
        </OwnerModalShell>
    );
}
