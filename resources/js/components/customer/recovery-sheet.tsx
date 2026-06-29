import { Search } from 'lucide-react';
import { useState } from 'react';
import Dialog from '@/components/ui/dialog';
import { recoverOrders, useOrderRecovery } from '@/lib/order-recovery';

type Props = {
    open: boolean;
    onClose: () => void;
    onRecovered: (result: RecoveryResult) => void;
    onLoadingChange?: (loading: boolean) => void;
};

type RecoveryResult = {
    found: boolean;
    customer_name?: string;
    active_orders: any[];
    recent_orders: any[];
};

export default function RecoverySheet({ open, onClose, onRecovered, onLoadingChange }: Props) {
    const { saveRecovery } = useOrderRecovery();
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!open) {
        return null;
    }

    function handleClose() {
        setPhone('');
        setError(null);
        onLoadingChange?.(false);
        onClose();
    }

    async function handleRecover() {
        const trimmed = phone.trim();

        if (trimmed.length < 8) {
            setError('Masukkan nomor WhatsApp yang valid.');
            return;
        }

        setLoading(true);
        onLoadingChange?.(true);
        setError(null);

        try {
            const result = await recoverOrders(trimmed);

            if (!result.found) {
                setError('Pesanan tidak ditemukan untuk nomor ini.');
                setLoading(false);
                return;
            }

            const orderCodes = [...(result.active_orders ?? []), ...(result.recent_orders ?? [])].map((o: any) => o.order_code);
            saveRecovery(trimmed, orderCodes);
            onRecovered({ ...result, active_orders: result.active_orders ?? [], recent_orders: result.recent_orders ?? [] });
            handleClose();
        } catch {
            setError('Terjadi kesalahan. Coba lagi.');
        } finally {
            setLoading(false);
            onLoadingChange?.(false);
        }
    }

    return (
        <Dialog open={open} onClose={handleClose} title="Cari Pesanan">
            <p className="text-sm text-text-muted">Masukkan nomor WhatsApp yang digunakan saat memesan.</p>

            <div className="mt-5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Nomor WhatsApp</label>
                <input
                    value={phone}
                    onChange={(e) => {
                        setPhone(e.target.value);
                        setError(null);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleRecover();
                        }
                    }}
                    inputMode="tel"
                    placeholder="081234567890"
                    className="mt-2 min-h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-text placeholder:text-text-subtle focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
                {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            </div>

            <button
                type="button"
                onClick={handleRecover}
                disabled={loading || phone.trim().length < 8}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white active:opacity-80 disabled:bg-border disabled:text-text-subtle"
            >
                <Search className="h-4 w-4" />
                {loading ? 'Mencari...' : 'Cari Pesanan'}
            </button>
        </Dialog>
    );
}
