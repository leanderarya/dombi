import { X, Copy, Check, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '@/lib/format';

interface UnpaidItem {
    id: number;
    period_label: string;
    period_start: string;
    period_end: string;
    outstanding: number;
    due_date: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    outletId: number;
    outletName: string;
    totalOutstanding: number;
    unpaidBreakdown: UnpaidItem[];
}

export default function InvoiceModal({ open, onClose, outletId, outletName, totalOutstanding, unpaidBreakdown }: Props) {
    const [copied, setCopied] = useState(false);

    if (!open) {
return null;
}

    const lines = unpaidBreakdown.map(
        (item) => `• Periode ${item.period_label} : ${formatCurrency(item.outstanding)}`
    );

    const message = `Halo Outlet ${outletName},\n\nBerikut tagihan yang masih belum diselesaikan:\n\n${lines.join('\n')}\n\nTotal Outstanding:\n${formatCurrency(totalOutstanding)}\n\nMohon dilakukan pembayaran.\n\nTerima kasih.`;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(message);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // fallback
        }
    };

    const handleWhatsApp = () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full max-w-md animate-[slideUp_200ms_ease-out] rounded-t-lg bg-white pb-safe lg:animate-none lg:rounded-lg lg:pb-0">
                <div className="flex justify-center pt-3 pb-2 lg:hidden">
                    <div className="h-1 w-12 rounded-full bg-slate-300" />
                </div>
                <button type="button" onClick={onClose} aria-label="Tutup" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
                    <X className="h-4 w-4" />
                </button>

                <div className="px-6 pb-6 pt-2 lg:pt-6">
                    <h2 className="text-base font-bold text-slate-900">Kirim Tagihan</h2>

                    <div className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Outlet</span>
                            <span className="font-medium text-slate-900">{outletName}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Total Outstanding</span>
                            <span className="font-semibold text-red-600">{formatCurrency(totalOutstanding)}</span>
                        </div>
                    </div>

                    {/* Breakdown */}
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Tagihan Belum Dibayar</div>
                        {unpaidBreakdown.map((item) => (
                            <div key={item.id} className="flex justify-between py-1 text-xs">
                                <span className="text-slate-600">{item.period_label}</span>
                                <span className="font-semibold text-slate-900">{formatCurrency(item.outstanding)}</span>
                            </div>
                        ))}
                    </div>

                    {/* Preview */}
                    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                        <pre className="whitespace-pre-wrap text-xs text-slate-600 leading-relaxed">{message}</pre>
                    </div>

                    <div className="mt-5 flex gap-3">
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                            {copied ? 'Tersalin' : 'Copy Pesan'}
                        </button>
                        <button
                            type="button"
                            onClick={handleWhatsApp}
                            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
                        >
                            <ExternalLink className="h-4 w-4" />
                            Buka WhatsApp
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
