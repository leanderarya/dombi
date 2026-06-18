import { ArrowLeft, Search } from 'lucide-react';
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
    const [needsVerification, setNeedsVerification] = useState(false);
    const [orderCode, setOrderCode] = useState('');
    const [recoveryToken, setRecoveryToken] = useState('');

    if (!open) {
        return null;
    }

    function handleClose() {
        setPhone('');
        setError(null);
        setNeedsVerification(false);
        setOrderCode('');
        setRecoveryToken('');
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

            if (result.requires_verification) {
                setNeedsVerification(true);
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

    async function handleVerify() {
        setLoading(true);
        onLoadingChange?.(true);
        setError(null);

        try {
            const result = await recoverOrders(phone.trim(), recoveryToken || undefined, orderCode || undefined);

            if (!result.found || result.requires_verification) {
                setError('Kode pesanan atau token tidak valid.');
                setLoading(false);

                return;
            }

            const orderCodes = [...(result.active_orders ?? []), ...(result.recent_orders ?? [])].map((o: any) => o.order_code);
            saveRecovery(phone.trim(), orderCodes);
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
        <Dialog open={open} onClose={handleClose} title={needsVerification ? 'Verifikasi Pesanan' : 'Cari Pesanan Saya'}>
            {needsVerification && (
                <button
                    type="button"
                    onClick={() => {
                        setNeedsVerification(false);
                        setError(null);
                    }}
                    className="mb-3 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 active:bg-slate-100"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
            )}

            {!needsVerification ? (
                <>
                    <p className="text-sm text-slate-500">Masukkan nomor WhatsApp yang digunakan saat memesan.</p>

                    <div className="mt-5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Nomor WhatsApp</label>
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
                </>
            ) : (
                <>
                    <p className="text-sm text-slate-500">
                        Ditemukan pesanan dengan nomor ini. Masukkan kode pesanan atau token pemulihan untuk verifikasi.
                    </p>

                    <div className="mt-5 space-y-4">
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Kode Pesanan</label>
                            <input
                                value={orderCode}
                                onChange={(e) => {
                                    setOrderCode(e.target.value);
                                    setError(null);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
handleVerify();
}
                                }}
                                placeholder="contoh: ORD-12345"
                                className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                            />
                        </div>

                        <div className="relative">
                            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-200" />
                            <div className="relative mx-auto w-fit bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">atau</div>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Token Pemulihan</label>
                            <input
                                value={recoveryToken}
                                onChange={(e) => {
                                    setRecoveryToken(e.target.value);
                                    setError(null);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
handleVerify();
}
                                }}
                                placeholder="contoh: abc123def456"
                                className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                            />
                        </div>
                    </div>

                    {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

                    <button
                        type="button"
                        onClick={handleVerify}
                        disabled={loading || (!orderCode.trim() && !recoveryToken.trim())}
                        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white transition-all active:scale-[0.98] active:bg-emerald-700 disabled:bg-slate-300 disabled:active:scale-100"
                    >
                        {loading ? 'Memverifikasi...' : 'Verifikasi'}
                    </button>
                </>
            )}
        </Dialog>
    );
}
