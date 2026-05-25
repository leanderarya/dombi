import { useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';

interface Props {
    item: any;
    open: boolean;
    onClose: () => void;
}

export default function InventoryAdjustmentSheet({ item, open, onClose }: Props) {
    const [mode, setMode] = useState<'add' | 'subtract'>('add');

    const form = useForm({
        current_stock: 0,
        minimum_stock: 0,
        notes: '',
    });

    // Sync form when item changes or sheet opens
    useEffect(() => {
        if (open && item) {
            const currentStock = Number(item.current_stock ?? 0);
            form.setData({
                current_stock: currentStock,
                minimum_stock: Number(item.minimum_stock ?? 0),
                notes: '',
            });
            setMode('add');
            setQtyDelta(0);
        }
    }, [open, item?.id]);

    const [qtyDelta, setQtyDelta] = useState(0);

    useEffect(() => {
        if (open) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = '';
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open || !item) return null;

    const currentStock = Number(item.current_stock ?? 0);
    const reserved = Number(item.reserved_stock ?? 0);
    const available = currentStock - reserved;
    const newStock = mode === 'add' ? currentStock + qtyDelta : currentStock - qtyDelta;
    const willViolate = newStock < reserved;
    const isLow = available <= Number(item.minimum_stock ?? 0);
    const isCritical = available <= 0;

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (willViolate || qtyDelta === 0 || !form.data.notes.trim()) return;

        form.transform(() => ({
            current_stock: newStock,
            minimum_stock: form.data.minimum_stock,
            notes: form.data.notes,
        }));

        form.put(`/owner/inventories/${item.id}`, {
            onSuccess: () => onClose(),
            preserveScroll: true,
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full max-w-lg animate-[slideUp_200ms_ease-out] rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
                {/* Handle */}
                <div className="sticky top-0 z-10 flex justify-center rounded-t-2xl bg-white pt-3 pb-2">
                    <div className="h-1 w-12 rounded-full bg-slate-300" />
                </div>

                <form onSubmit={handleSubmit} className="px-4 pb-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-base font-bold text-slate-900">{item.product?.name ?? 'SKU'}</div>
                            <div className="mt-0.5 text-xs text-slate-500">{item.outlet?.name ?? 'Outlet'}</div>
                        </div>
                        <span className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${isCritical ? 'border-red-200 bg-red-50 text-red-700' : isLow ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                            {isCritical ? 'Critical' : isLow ? 'Low Stock' : 'Healthy'}
                        </span>
                    </div>

                    {/* Current State */}
                    <div className="mt-4 grid grid-cols-4 gap-2">
                        <MetricBox label="Current" value={currentStock} />
                        <MetricBox label="Reserved" value={reserved} color="blue" />
                        <MetricBox label="Available" value={available} color={isCritical ? 'red' : isLow ? 'amber' : undefined} />
                        <MetricBox label="Minimum" value={Number(item.minimum_stock ?? 0)} />
                    </div>

                    {/* Mode Toggle */}
                    <div className="mt-4">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Adjustment Type</div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => { setMode('add'); setQtyDelta(0); }} className={`flex min-h-[44px] items-center justify-center rounded-lg border text-xs font-semibold transition-all duration-150 active:scale-[0.98] ${mode === 'add' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'}`}>
                                + Tambah Stok
                            </button>
                            <button type="button" onClick={() => { setMode('subtract'); setQtyDelta(0); }} className={`flex min-h-[44px] items-center justify-center rounded-lg border text-xs font-semibold transition-all duration-150 active:scale-[0.98] ${mode === 'subtract' ? 'border-red-300 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600'}`}>
                                − Kurangi Stok
                            </button>
                        </div>
                    </div>

                    {/* Quantity */}
                    <div className="mt-4">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Jumlah</div>
                        <div className="mt-2 flex items-center gap-3">
                            <button type="button" onClick={() => setQtyDelta(Math.max(0, qtyDelta - 1))} className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-lg font-semibold text-slate-600 transition-all duration-150 active:scale-[0.90] active:bg-slate-50">−</button>
                            <input
                                type="number"
                                min={0}
                                value={qtyDelta}
                                onChange={(e) => setQtyDelta(Math.max(0, Number(e.target.value) || 0))}
                                className="h-11 w-20 rounded-lg border border-slate-200 text-center text-lg font-bold tabular-nums text-slate-900 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                            />
                            <button type="button" onClick={() => setQtyDelta(qtyDelta + 1)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-lg font-semibold text-slate-600 transition-all duration-150 active:scale-[0.90] active:bg-slate-50">+</button>
                            <div className="flex-1 text-right">
                                <div className="text-[10px] text-slate-400">New Stock</div>
                                <div className={`text-lg font-bold tabular-nums ${willViolate ? 'text-red-600' : 'text-slate-900'}`}>{newStock}</div>
                            </div>
                        </div>
                    </div>

                    {/* Critical Warning */}
                    {willViolate && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                            <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            <div className="text-xs text-red-800">
                                <strong>Stok tidak boleh di bawah reserved.</strong> Reserved saat ini: {reserved}. Stok baru ({newStock}) akan menyebabkan inkonsistensi inventory.
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div className="mt-4">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Alasan Adjustment <span className="text-red-500">*</span></div>
                        <textarea
                            value={form.data.notes}
                            onChange={(e) => form.setData('notes', e.target.value)}
                            className="mt-2 min-h-16 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                            placeholder="Contoh: stok opname, barang rusak, koreksi outlet, retur supplier..."
                            required
                        />
                        {form.errors.notes && <p className="mt-1 text-xs text-red-600">{form.errors.notes}</p>}
                        {form.errors.current_stock && <p className="mt-1 text-xs text-red-600">{form.errors.current_stock}</p>}
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex gap-2">
                        <button type="button" onClick={onClose} className="flex min-h-[48px] flex-1 items-center justify-center rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 transition-all duration-150 active:scale-[0.98] active:bg-slate-50">
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={willViolate || qtyDelta === 0 || !form.data.notes.trim() || form.processing}
                            className="flex min-h-[48px] flex-1 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white transition-all duration-150 active:scale-[0.98] active:bg-emerald-800 disabled:bg-slate-300 disabled:active:scale-100"
                        >
                            {form.processing ? 'Saving...' : 'Simpan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function MetricBox({ label, value, color }: { label: string; value: number; color?: string }) {
    const textColor = color === 'red' ? 'text-red-600' : color === 'amber' ? 'text-amber-600' : color === 'blue' ? 'text-blue-600' : 'text-slate-900';
    return (
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
            <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
            <div className={`mt-0.5 text-base font-bold tabular-nums ${textColor}`}>{value}</div>
        </div>
    );
}
