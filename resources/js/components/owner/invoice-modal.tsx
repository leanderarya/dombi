import { Copy, Check, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import OwnerModalShell from '@/components/owner/owner-modal-shell';
import { formatCurrency } from '@/lib/format';
import { copyToClipboard } from '@/lib/clipboard';

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

export default function InvoiceModal({
    open,
    onClose,
    outletId,
    outletName,
    totalOutstanding,
    unpaidBreakdown,
}: Props) {
    const [copied, setCopied] = useState(false);

    const lines = unpaidBreakdown.map(
        (item) =>
            `• Periode ${item.period_label} : ${formatCurrency(item.outstanding)}`,
    );

    const message = `Halo Outlet ${outletName},\n\nBerikut tagihan yang masih belum diselesaikan:\n\n${lines.join('\n')}\n\nTotal Outstanding:\n${formatCurrency(totalOutstanding)}\n\nMohon dilakukan pembayaran.\n\nTerima kasih.`;

    const handleCopy = async () => {
        try {
            await copyToClipboard(message);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // fallback
        }
    };

    const handleWhatsApp = () => {
        window.open(
            `https://wa.me/?text=${encodeURIComponent(message)}`,
            '_blank',
        );
    };

    return (
        <OwnerModalShell
            open={open}
            onClose={onClose}
            title="Kirim Tagihan"
            maxWidth="max-w-md"
        >
            <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-slate-500">Outlet</span>
                    <span className="font-medium text-slate-900">
                        {outletName}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-500">Total Outstanding</span>
                    <span className="font-semibold text-red-600">
                        {formatCurrency(totalOutstanding)}
                    </span>
                </div>
            </div>

            {/* Breakdown */}
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
                    Tagihan Belum Dibayar
                </div>
                {unpaidBreakdown.map((item) => (
                    <div
                        key={item.id}
                        className="flex justify-between py-1 text-xs"
                    >
                        <span className="text-slate-600">
                            {item.period_label}
                        </span>
                        <span className="font-semibold text-slate-900">
                            {formatCurrency(item.outstanding)}
                        </span>
                    </div>
                ))}
            </div>

            {/* Preview */}
            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                <pre className="text-xs leading-relaxed whitespace-pre-wrap text-slate-600">
                    {message}
                </pre>
            </div>

            <div className="mt-5 flex gap-3">
                <button
                    type="button"
                    onClick={handleCopy}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                    {copied ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                        <Copy className="h-4 w-4" />
                    )}
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
        </OwnerModalShell>
    );
}
