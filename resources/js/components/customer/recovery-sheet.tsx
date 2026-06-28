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

type LookupMode = 'order_code' | 'recovery_token';

export default function RecoverySheet({ open, onClose, onRecovered, onLoadingChange }: Props) {
    const { saveRecovery } = useOrderRecovery();
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [needsVerification, setNeedsVerification] = useState(false);
    const [lookupMode, setLookupMode] = useState<LookupMode>('order_code');
    const [credential, setCredential] = useState('');

    if (!open) {
        return null;
    }

    function handleClose() {
        setPhone('');
        setError(null);
        setNeedsVerification(false);
        setLookupMode('order_code');
        setCredential('');
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
            const token = lookupMode === 'recovery_token' ? credential.trim() : undefined;
            const code = lookupMode === 'order_code' ? credential.trim() : undefined;
            const result = await recoverOrders(phone.trim(), token, code);

            if (!result.found || result.requires_verification) {
                const altHint = lookupMode === 'order_code'
                    ? 'Coba gunakan Token Pemulihan.'
                    : 'Coba gunakan Kode Pesanan.';
                setError(`Kode tidak valid. ${altHint}`);
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

    function switchMode() {
        setLookupMode((prev) => (prev === 'order_code' ? 'recovery_token' : 'order_code'));
        setCredential('');
        setError(null);
    }

    const maskedPhone = phone.replace(/(\d{2})\d+(\d{4})/, '$1••••$2');

    return (
        <Dialog open={open} onClose={handleClose} title={needsVerification ? 'Verifikasi Pesanan' : 'Cari Pesanan'}>

            {!needsVerification ? (
                <>
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
                </>
            ) : (
                <>
                    <p className="text-sm text-text-muted">
                        Ditemukan pesanan untuk <span className="font-semibold text-text">{maskedPhone}</span>. Masukkan salah satu untuk verifikasi.
                    </p>

                    {/* Segmented control */}
                    <div className="mt-5 flex rounded-lg border border-border bg-surface p-0.5">
                        <button
                            type="button"
                            onClick={() => { setLookupMode('order_code'); setCredential(''); setError(null); }}
                            className={`flex h-11 flex-1 items-center justify-center rounded-md text-xs font-semibold transition-all active:opacity-80 ${
                                lookupMode === 'order_code'
                                    ? 'bg-white text-text shadow-sm'
                                    : 'text-text-muted'
                            }`}
                        >
                            Kode Pesanan
                        </button>
                        <button
                            type="button"
                            onClick={() => { setLookupMode('recovery_token'); setCredential(''); setError(null); }}
                            className={`flex h-11 flex-1 items-center justify-center rounded-md text-xs font-semibold transition-all active:opacity-80 ${
                                lookupMode === 'recovery_token'
                                    ? 'bg-white text-text shadow-sm'
                                    : 'text-text-muted'
                            }`}
                        >
                            Token Pemulihan
                        </button>
                    </div>

                    {/* Single input based on mode */}
                    <div className="mt-4">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">
                            {lookupMode === 'order_code' ? 'Kode Pesanan' : 'Token Pemulihan'}
                        </label>
                        <input
                            value={credential}
                            onChange={(e) => {
                                setCredential(e.target.value);
                                setError(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
handleVerify();
}
                            }}
                            placeholder={lookupMode === 'order_code' ? 'DMB-12345' : '8 karakter'}
                            className="mt-2 min-h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-text placeholder:text-text-subtle focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        />
                        <p className="mt-1.5 text-[11px] text-text-subtle">
                            {lookupMode === 'order_code'
                                ? 'Ada di struk atau halaman konfirmasi.'
                                : 'Untuk memulihkan akses jika kode hilang.'}
                        </p>
                    </div>

                    {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

                    <button
                        type="button"
                        onClick={handleVerify}
                        disabled={loading || !credential.trim()}
                        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white active:opacity-80 disabled:bg-border disabled:text-text-subtle"
                    >
                        {loading ? 'Memverifikasi...' : 'Lanjutkan'}
                    </button>
                </>
            )}
        </Dialog>
    );
}
