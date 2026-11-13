import { Bell, BellOff, CheckCircle2, X } from 'lucide-react';
import { useState } from 'react';
import { usePushSubscription } from '@/hooks/use-push-subscription';

interface Props {
    variant: 'home' | 'confirm';
    onDismiss?: () => void;
}

const LS_KEY = 'dombi_push_banner_home_dismissed';

export default function PushBanner({ variant, onDismiss }: Props) {
    const { pushState, requestEnable } = usePushSubscription();
    const [dismissed, setDismissed] = useState(() => {
        if (variant !== 'home') {
            return false;
        }

        if (typeof window === 'undefined') {
            return false;
        }

        return localStorage.getItem(LS_KEY) === 'true';
    });

    // Hide when active (home variant) or unsupported
    if (pushState === 'unsupported') {
        return null;
    }

    if ((pushState === 'active' && variant === 'home') || dismissed) {
        return null;
    }

    const handleEnable = async () => {
        const ok = await requestEnable();

        if (ok && variant === 'home') {
            setDismissed(true);
        }
    };

    const handleDismiss = () => {
        setDismissed(true);
        localStorage.setItem(LS_KEY, 'true');
        onDismiss?.();
    };

    if (variant === 'home') {
        return (
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-surface-muted/60 px-2 py-1.5">
                <Bell className="h-3.5 w-3.5 shrink-0 text-primary" />
                <p className="min-w-32 flex-1 text-xs text-text-muted">
                    {pushState === 'denied'
                        ? 'Notifikasi dimatikan'
                        : 'Aktifkan notifikasi untuk info pesanan'}
                </p>
                {pushState !== 'denied' && (
                    <button
                        onClick={handleEnable}
                        className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-xs font-bold text-primary active:bg-primary/10"
                    >
                        Aktifkan
                    </button>
                )}
                <button
                    onClick={handleDismiss}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-subtle active:bg-surface-muted"
                    aria-label="Tutup"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
        );
    }

    // variant === 'confirm'
    return (
        <div className="rounded-2xl border border-primary/20 bg-primary-light p-4">
            {pushState === 'denied' ? (
                <div className="flex items-center gap-3">
                    <BellOff className="h-5 w-5 shrink-0 text-primary" />
                    <div>
                        <p className="text-sm font-semibold text-primary">
                            Notifikasi dimatikan
                        </p>
                        <p className="mt-0.5 text-xs text-primary">
                            Aktifkan lewat Settings browser / iPhone
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-3">
                    {pushState === 'active' ? (
                        <>
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                            <p className="text-sm font-semibold text-primary">
                                Notifikasi aktif ✓
                            </p>
                        </>
                    ) : (
                        <>
                            <Bell className="h-5 w-5 shrink-0 text-primary" />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-primary">
                                    Pantau pesananmu secara real-time
                                </p>
                                <button
                                    onClick={handleEnable}
                                    className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-white px-5 text-xs font-bold text-primary shadow-sm active:opacity-80"
                                >
                                    Aktifkan Notifikasi
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
