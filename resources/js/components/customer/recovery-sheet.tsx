import { Search, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Dialog from '@/components/ui/dialog';
import PhoneInput from '@/components/ui/phone-input';
import { PENDING_PHONE_KEY } from '@/lib/constants';
import { recoverOrders, useOrderRecovery } from '@/lib/order-recovery';

type Props = {
    open: boolean;
    onClose: () => void;
    onRecovered: (result: RecoveryResult) => void;
    onLoadingChange?: (loading: boolean) => void;
};

type RecoveryResult = {
    found: boolean;
    requires_verification?: boolean;
    is_different_account?: boolean;
    customer_name?: string;
    active_orders: any[];
    recent_orders: any[];
};

export default function RecoverySheet({ open, onClose, onRecovered, onLoadingChange }: Props) {
    const { saveRecovery } = useOrderRecovery();
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showVerifyDialog, setShowVerifyDialog] = useState(false);
    const [isDifferentAccount, setIsDifferentAccount] = useState(false);
    const autoSubmittedRef = useRef(false);

    // Auto-submit when opened — reads directly from localStorage
    useEffect(() => {
        if (!open) {
            autoSubmittedRef.current = false;

            return;
        }

        const storedPhone = localStorage.getItem(PENDING_PHONE_KEY);

        if (storedPhone && !autoSubmittedRef.current) {
            autoSubmittedRef.current = true;
            setPhone(storedPhone);

            let cancelled = false;
            const timer = setTimeout(async () => {
                setLoading(true);
                onLoadingChange?.(true);

                try {
                    const result = await recoverOrders(storedPhone);

                    if (cancelled) {
return;
}

                    if (!result.found) {
                        setError('Pesanan tidak ditemukan untuk nomor ini.');
                    } else if (result.requires_verification) {
                        setIsDifferentAccount(result.is_different_account ?? false);
                        setShowVerifyDialog(true);
                    } else {
                        localStorage.removeItem(PENDING_PHONE_KEY);
                        const orderCodes = [...(result.active_orders ?? []), ...(result.recent_orders ?? [])].map((o: any) => o.order_code);
                        saveRecovery(storedPhone, orderCodes);
                        onRecovered({ ...result, active_orders: result.active_orders ?? [], recent_orders: result.recent_orders ?? [] });
                        handleClose();
                    }
                } catch {
                    if (!cancelled) {
setError('Terjadi kesalahan. Coba lagi.');
}
                } finally {
                    if (!cancelled) {
                        setLoading(false);
                        onLoadingChange?.(false);
                    }
                }
            }, 100);

            return () => {
 cancelled = true; clearTimeout(timer); 
};
        }
    }, [open]);

    if (!open) {
        return null;
    }

    function handleClose() {
        setPhone('');
        setError(null);
        setShowVerifyDialog(false);
        setIsDifferentAccount(false);
        onLoadingChange?.(false);
        onClose();
    }

    async function handleLogoutAndRedirect() {
        localStorage.setItem(PENDING_PHONE_KEY, phone);

        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
            const res = await fetch('/logout', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
            });

            if (!res.ok) {
throw new Error('Logout failed');
}
        } catch {
            setError('Gagal logout. Coba lagi.');
            localStorage.removeItem(PENDING_PHONE_KEY);

            return;
        }

        window.location.href = `/oauth/google?redirect=${encodeURIComponent('/customer/orders')}`;
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
                setIsDifferentAccount(result.is_different_account ?? false);
                setShowVerifyDialog(true);
                setLoading(false);
                onLoadingChange?.(false);

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
        <>
        <Dialog open={open} onClose={handleClose} title="Cari Pesanan">
            <p className="text-sm text-text-muted">Masukkan nomor WhatsApp yang digunakan saat memesan.</p>

            <div className="mt-5">
                <PhoneInput
                    label="Nomor WhatsApp"
                    value={phone}
                    onChange={(value) => {
                        setPhone(value);
                        setError(null);
                    }}
                    error={error ?? undefined}
                    required
                />
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

        {/* Verification Required Dialog */}
        <Dialog open={showVerifyDialog} onClose={() => setShowVerifyDialog(false)} title={isDifferentAccount ? 'Akun Berbeda' : 'Perlu Masuk'}>
            <div className="flex flex-col items-center text-center">
                <div className={`flex h-14 w-14 items-center justify-center rounded-full ${isDifferentAccount ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                    <ShieldCheck className={`h-7 w-7 ${isDifferentAccount ? 'text-amber-600' : 'text-emerald-600'}`} />
                </div>
                {isDifferentAccount ? (
                    <>
                        <p className="mt-4 text-sm text-text">
                            Pesanan dengan nomor ini terhubung ke akun Google yang berbeda.
                        </p>
                        <p className="mt-2 text-xs text-text-muted">
                            Silakan masuk dengan akun Google yang sama saat membuat pesanan.
                        </p>
                    </>
                ) : (
                    <>
                        <p className="mt-4 text-sm text-text">
                            Pesanan dengan nomor ini sudah terhubung ke akun Google.
                        </p>
                        <p className="mt-2 text-xs text-text-muted">
                            Silakan masuk dengan akun Google yang sama untuk melihat pesanan Anda.
                        </p>
                    </>
                )}
            </div>
            <div className="mt-5 flex gap-2">
                <button
                    type="button"
                    onClick={() => setShowVerifyDialog(false)}
                    className="flex h-12 flex-1 items-center justify-center rounded-xl border border-border text-sm font-semibold text-text active:opacity-80"
                >
                    Kembali
                </button>
                <button
                    type="button"
                    onClick={isDifferentAccount ? handleLogoutAndRedirect : () => {
                        // Store phone for post-login recovery
                        localStorage.setItem(PENDING_PHONE_KEY, phone);
                        window.location.href = `/oauth/google?redirect=${encodeURIComponent('/customer/orders')}`;
                    }}
                    className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white active:opacity-80 ${isDifferentAccount ? 'bg-amber-600' : 'bg-emerald-600'}`}
                >
                    {isDifferentAccount ? 'Ganti Akun' : 'Masuk Google'}
                </button>
            </div>
        </Dialog>
        </>
    );
}
