import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency, formatMarginPercent } from '@/lib/format';
import { marginColor } from '@/lib/pricing-utils';

interface Props {
    open: boolean;
    onClose: () => void;
    productName: string;
    centerPrice: number;
    sellingPrice: number;
    onSave: (newPrice: number) => void;
    saving: boolean;
}

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000];

export default function PricingEditModal({ open, onClose, productName, centerPrice, sellingPrice, onSave, saving }: Props) {
    const [value, setValue] = useState('');

    useEffect(() => {
        if (open) {
            setValue(String(Math.round(sellingPrice)));
        }
    }, [open, sellingPrice]);

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
    const margin = numericValue - centerPrice;
    const isNegativeMargin = margin < 0;

    const handleQuickAmount = (amount: number) => {
        const current = parseFloat(value) || 0;
        setValue(String(Math.max(0, Math.round(current + amount))));
    };

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

            <div className="relative w-full max-w-md animate-[slideUp_200ms_ease-out] rounded-t-2xl bg-white pb-safe lg:animate-none lg:rounded-xl lg:pb-0 lg:shadow-xl">
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
                    <h2 className="text-base font-bold text-slate-900">Ubah Harga</h2>

                    {/* Product Name */}
                    <div className="mt-4">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Produk</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{productName}</div>
                    </div>

                    {/* Center Price (read-only) */}
                    <div className="mt-3">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Harga Pusat</div>
                        <div className="mt-1 text-sm font-semibold text-slate-700">{formatCurrency(centerPrice)}</div>
                    </div>

                    {/* Selling Price Input */}
                    <div className="mt-3">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Harga Jual Outlet</label>
                        <div className="relative mt-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">Rp</span>
                            <input
                                type="number"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                min={0}
                                className={`w-full rounded-xl border bg-white py-3 pl-10 pr-4 text-base font-bold tabular-nums focus:ring-1 ${
                                    isNegativeMargin
                                        ? 'border-red-300 text-red-700 focus:border-red-400 focus:ring-red-200'
                                        : 'border-slate-200 text-slate-900 focus:border-emerald-400 focus:ring-emerald-200'
                                }`}
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Margin Preview */}
                    <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
                        <span className="text-xs text-slate-500">Margin Outlet</span>
                        <span className={`text-sm font-bold tabular-nums ${marginColor(margin, numericValue)}`}>
                            {formatCurrency(margin)} {formatMarginPercent(margin, numericValue)}
                        </span>
                    </div>

                    {/* Negative Margin Warning */}
                    {isNegativeMargin && (
                        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            <span className="font-bold">Margin negatif</span> — Harga jual lebih rendah dari harga pusat.
                        </div>
                    )}

                    {/* Quick Actions */}
                    <div className="mt-4">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ubah Cepat</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {QUICK_AMOUNTS.map((amt) => (
                                <div key={amt} className="flex gap-0.5">
                                    <button
                                        type="button"
                                        onClick={() => handleQuickAmount(amt)}
                                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 active:bg-emerald-100"
                                    >
                                        +{amt.toLocaleString('id-ID')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleQuickAmount(-amt)}
                                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 active:bg-slate-50"
                                    >
                                        -{amt.toLocaleString('id-ID')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

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
        </div>
    ,
        document.body,
    );

;
}
