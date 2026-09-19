import { Search, ShieldCheck } from 'lucide-react';
import {
    useCallback,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import { runAutoRecovery } from '@/components/customer/recovery-auto-submit';
import { Button } from '@/components/ui/button';
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

export default function RecoverySheet({
    open,
    onClose,
    onRecovered,
    onLoadingChange,
}: Props) {
    const { saveRecovery } = useOrderRecovery();
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showVerifyDialog, setShowVerifyDialog] = useState(false);
    const [isDifferentAccount, setIsDifferentAccount] = useState(false);
    const autoSubmittedRef = useRef(false);

    const handleClose = useCallback(() => {
        setPhone('');
        setError(null);
        setShowVerifyDialog(false);
        setIsDifferentAccount(false);
        onLoadingChange?.(false);
        onClose();
    }, [onClose, onLoadingChange]);

    const getAutoRecoveryEvents = useEffectEvent(() => ({
        onLoadingChange: (nextLoading: boolean) => {
            setLoading(nextLoading);
            onLoadingChange?.(nextLoading);
        },
        onNotFound: () => {
            setError('Pesanan tidak ditemukan untuk nomor ini.');
        },
        onVerificationRequired: (differentAccount: boolean) => {
            setIsDifferentAccount(differentAccount);
            setShowVerifyDialog(true);
        },
        onRecovered: (
            recoveredPhone: string,
            result: RecoveryResult,
            orderCodes: string[],
        ) => {
            localStorage.removeItem(PENDING_PHONE_KEY);
            saveRecovery(recoveredPhone, orderCodes);
            onRecovered(result);
            setPhone('');
            setError(null);
            setShowVerifyDialog(false);
            setIsDifferentAccount(false);
            setLoading(false);
            onLoadingChange?.(false);
            onClose();
        },
        onError: () => {
            setError('Terjadi kesalahan. Coba lagi.');
        },
    }));

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
            const timer = setTimeout(() => {
                void runAutoRecovery({
                    phone: storedPhone,
                    recover: recoverOrders,
                    isCancelled: () => cancelled,
                    getEvents: getAutoRecoveryEvents,
                });
            }, 100);

            return () => {
                cancelled = true;
                clearTimeout(timer);
            };
        }
    }, [open]);

    if (!open) {
        return null;
    }

    async function handleLogoutAndRedirect() {
        localStorage.setItem(PENDING_PHONE_KEY, phone);

        try {
            const csrfToken =
                document
                    .querySelector('meta[name="csrf-token"]')
                    ?.getAttribute('content') ?? '';
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

            const orderCodes = [
                ...(result.active_orders ?? []),
                ...(result.recent_orders ?? []),
            ].map((o: any) => o.order_code);
            saveRecovery(trimmed, orderCodes);
            onRecovered({
                ...result,
                active_orders: result.active_orders ?? [],
                recent_orders: result.recent_orders ?? [],
            });
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
                <p className="text-sm text-text-muted">
                    Masukkan nomor WhatsApp yang digunakan saat memesan.
                </p>

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

                <Button
                    type="button"
                    variant="primary"
                    onClick={handleRecover}
                    disabled={loading || phone.trim().length < 8}
                    className="mt-4 h-12 w-full rounded-thumb font-bold disabled:bg-border disabled:text-text-subtle"
                >
                    <Search className="h-4 w-4" />
                    {loading ? 'Mencari...' : 'Cari Pesanan'}
                </Button>
            </Dialog>

            {/* Verification Required Dialog */}
            <Dialog
                open={showVerifyDialog}
                onClose={() => setShowVerifyDialog(false)}
                title={isDifferentAccount ? 'Akun Berbeda' : 'Perlu Masuk'}
            >
                <div className="flex flex-col items-center text-center">
                    <div
                        className={`flex h-14 w-14 items-center justify-center rounded-full ${isDifferentAccount ? 'bg-warning-bg' : 'bg-primary-light'}`}
                    >
                        <ShieldCheck
                            className={`h-7 w-7 ${isDifferentAccount ? 'text-warning' : 'text-primary'}`}
                        />
                    </div>
                    {isDifferentAccount ? (
                        <>
                            <p className="mt-4 text-sm text-text">
                                Pesanan dengan nomor ini terhubung ke akun
                                Google yang berbeda.
                            </p>
                            <p className="mt-2 text-xs text-text-muted">
                                Silakan masuk dengan akun Google yang sama saat
                                membuat pesanan.
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="mt-4 text-sm text-text">
                                Pesanan dengan nomor ini sudah terhubung ke akun
                                Google.
                            </p>
                            <p className="mt-2 text-xs text-text-muted">
                                Silakan masuk dengan akun Google yang sama untuk
                                melihat pesanan Anda.
                            </p>
                        </>
                    )}
                </div>
                <div className="mt-5 flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowVerifyDialog(false)}
                        className="h-12 flex-1 rounded-thumb font-semibold"
                    >
                        Kembali
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        onClick={
                            isDifferentAccount
                                ? handleLogoutAndRedirect
                                : () => {
                                      // Store phone for post-login recovery
                                      localStorage.setItem(
                                          PENDING_PHONE_KEY,
                                          phone,
                                      );
                                      window.location.href = `/oauth/google?redirect=${encodeURIComponent('/customer/orders')}`;
                                  }
                        }
                        className={`h-12 flex-1 rounded-thumb font-bold ${isDifferentAccount ? 'bg-warning hover:bg-warning/90' : ''}`}
                    >
                        {isDifferentAccount ? 'Ganti Akun' : 'Masuk Google'}
                    </Button>
                </div>
            </Dialog>
        </>
    );
}
