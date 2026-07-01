import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '@/lib/format';

interface ImpactData {
    total_outlets: number;
    affected_outlets: number;
    negative_margin_outlets: number;
    low_margin_outlets: number;
}

interface Props {
    open: boolean;
    onClose: () => void;
    productName: string;
    currentCenterPrice: number;
    impact: ImpactData | null;
    onSave: (newCenterPrice: number) => void;
    saving: boolean;
}

export default function CenterPriceEditModal({ open, onClose, productName, currentCenterPrice, impact, onSave, saving }: Props) {
    const [value, setValue] = useState('');

    useEffect(() => {
        if (open) {
            setValue(String(Math.round(currentCenterPrice)));
        }
    }, [open, currentCenterPrice]);

    useEffect(() => {
        if (!open) {
return;
}

        const handler = (e: KeyboardEvent) => {
 if (e.key === 'Escape') {
onClose();
} 
};
        document.addEventListener('keydown', handler);

        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
 document.body.style.overflow = ''; 
};
    }, [open]);

    if (!open) {
return null;
}

    const numericValue = parseFloat(value) || 0;
    const diff = numericValue - currentCenterPrice;
    const isIncrease = diff > 0;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (numericValue <= 0) {
return;
}

        onSave(numericValue);
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />

            <div className="relative w-full max-w-md animate-[slideUp_200ms_ease-out] rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] lg:animate-none lg:rounded-xl lg:pb-0 lg:shadow-xl">
                {/* Drag handle — mobile only */}
                <div className="flex justify-center pt-3 pb-2 lg:hidden">
                    <div className="h-1 w-12 rounded-full bg-slate-300" />
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Tutup"
                    className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 active:bg-slate-100"
                >
                    <X className="h-4 w-4" />
                </button>

                <form onSubmit={handleSubmit} className="px-6 pb-6 pt-2 lg:pt-6">
                    <h2 className="text-base font-bold text-slate-900">Ubah Harga Pusat</h2>

                    {/* Product Name */}
                    <div className="mt-4">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Produk</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{productName}</div>
                    </div>

                    {/* Current Center Price */}
                    <div className="mt-3">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Harga Pusat Saat Ini</div>
                        <div className="mt-1 text-sm font-semibold text-slate-700">{formatCurrency(currentCenterPrice)}</div>
                    </div>

                    {/* New Center Price Input */}
                    <div className="mt-3">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Harga Pusat Baru</label>
                        <div className="relative mt-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">Rp</span>
                            <input
                                type="number"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                min={0}
                                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-base font-bold tabular-nums text-slate-900 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Change Preview */}
                    {diff !== 0 && (
                        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">Perubahan</span>
                                <span className={`text-sm font-bold tabular-nums ${isIncrease ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {isIncrease ? '+' : ''}{formatCurrency(diff)}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Impact Preview */}
                    {impact && diff !== 0 && (
                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                <div className="text-xs text-amber-800">
                                    <div className="font-bold">Dampak Perubahan</div>
                                    <ul className="mt-1.5 space-y-0.5">
                                        <li>{impact.affected_outlets} outlet memiliki harga jual custom</li>
                                        {impact.negative_margin_outlets > 0 && (
                                            <li className="font-bold text-red-700">{impact.negative_margin_outlets} outlet margin negatif</li>
                                        )}
                                        {impact.low_margin_outlets > 0 && (
                                            <li className="font-bold text-amber-700">{impact.low_margin_outlets} outlet margin rendah</li>
                                        )}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="mt-5 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 active:bg-slate-50"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={saving || numericValue <= 0}
                            className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 active:bg-emerald-700 disabled:opacity-50"
                        >
                            {saving ? 'Menyimpan...' : 'Simpan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body,
    );
}
