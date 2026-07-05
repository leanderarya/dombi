import { X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '@/lib/format';

interface Props {
    open: boolean;
    onClose: () => void;
    outletId: number;
    variantId: number;
    productName: string;
    currentStock: number;
    onSuccess: () => void;
}

export default function RestockModal({ open, onClose, outletId, variantId, productName, currentStock, onSuccess }: Props) {
    const [quantity, setQuantity] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!open) {
return null;
}

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
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
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

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full max-w-md animate-[slideUp_200ms_ease-out] rounded-t-2xl bg-white pb-safe lg:animate-none lg:rounded-xl lg:pb-0 lg:shadow-xl">
                <div className="flex justify-center pt-3 pb-2 lg:hidden">
                    <div className="h-1 w-12 rounded-full bg-slate-300" />
                </div>
                <button type="button" onClick={onClose} aria-label="Tutup" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
                    <X className="h-4 w-4" />
                </button>

                <form onSubmit={handleSubmit} className="px-6 pb-6 pt-2 lg:pt-6">
                    <h2 className="text-base font-bold text-slate-900">Restock Produk</h2>

                    <div className="mt-4">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Produk</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{productName}</div>
                    </div>

                    <div className="mt-3">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Stok Saat Ini</div>
                        <div className="mt-1 text-sm font-semibold text-slate-700">{currentStock} pcs</div>
                    </div>

                    <div className="mt-3">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tambah Stok</label>
                        <div className="mt-1 flex gap-2">
                            {[10, 25, 50, 100].map((n) => (
                                <button
                                    key={n}
                                    type="button"
                                    onClick={() => setQuantity(String((parseInt(quantity) || 0) + n))}
                                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
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
                                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-4 pr-12 text-sm font-bold tabular-nums focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                                autoFocus
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">pcs</span>
                        </div>
                    </div>

                    <div className="mt-3">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Catatan</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Catatan restock (opsional)"
                            rows={2}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                        />
                    </div>

                    {qty > 0 && (
                        <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
                            <span className="text-xs text-slate-500">Stok Setelah Restock</span>
                            <span className="text-sm font-bold tabular-nums text-emerald-700">{newStock} pcs</span>
                        </div>
                    )}

                    {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}

                    <div className="mt-5 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                            Batal
                        </button>
                        <button type="submit" disabled={saving || qty <= 0} className="flex-[2] rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                            {saving ? 'Menyimpan...' : 'Simpan Restock'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    ,
        document.body,
    );

;
}
