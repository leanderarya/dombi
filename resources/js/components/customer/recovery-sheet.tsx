import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { recoverOrders, useOrderRecovery } from '@/lib/order-recovery';
import { formatCurrency } from '@/lib/format';

type Props = {
    open: boolean;
    onClose: () => void;
    onRecovered: (result: RecoveryResult) => void;
};

type RecoveryResult = {
    found: boolean;
    customer_name?: string;
    active_orders: any[];
    recent_orders: any[];
};

export default function RecoverySheet({ open, onClose, onRecovered }: Props) {
    const { saveRecovery } = useOrderRecovery();
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!open) return null;

    async function handleRecover() {
        const trimmed = phone.trim();
        if (trimmed.length < 8) {
            setError('Masukkan nomor WhatsApp yang valid.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await recoverOrders(trimmed);

            if (!result.found) {
                setError('Pesanan tidak ditemukan untuk nomor ini.');
                setLoading(false);
                return;
            }

            const orderCodes = [...result.active_orders, ...result.recent_orders].map((o: any) => o.order_code);
            saveRecovery(trimmed, orderCodes);
            onRecovered(result);
            onClose();
        } catch {
            setError('Terjadi kesalahan. Coba lagi.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40" onClick={onClose}>
            <div
                className="flex w-full max-w-lg flex-col rounded-t-3xl bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-16px_40px_rgba(15,23,42,0.16)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-200" />
                <div className="mt-3 flex items-center justify-between">
                    <h2 className="text-[15px] font-semibold text-slate-900">Cari Pesanan Saya</h2>
                    <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 active:bg-slate-100">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <p className="mt-2 text-sm text-slate-500">Masukkan nomor WhatsApp yang digunakan saat memesan.</p>

                <div className="mt-5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Nomor WhatsApp</label>
                    <input
                        value={phone}
                        onChange={(e) => {
                            setPhone(e.target.value);
                            setError(null);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRecover();
                        }}
                        inputMode="tel"
                        placeholder="081234567890"
                        className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                    />
                    {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
                </div>

                <button
                    type="button"
                    onClick={handleRecover}
                    disabled={loading || phone.trim().length < 8}
                    className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white transition-all active:scale-[0.98] active:bg-emerald-700 disabled:bg-slate-300 disabled:active:scale-100"
                >
                    <Search className="h-4 w-4" />
                    {loading ? 'Mencari...' : 'Cari Pesanan'}
                </button>
            </div>
        </div>
    );
}
