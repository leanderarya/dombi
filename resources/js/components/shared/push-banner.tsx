import { useEffect, useState } from 'react';
import { Bell, BellOff, CheckCircle2, X } from 'lucide-react';
import { usePushSubscription } from '@/hooks/use-push-subscription';

interface Props {
  variant: 'home' | 'confirm';
  onDismiss?: () => void;
}

const LS_KEY = 'dombi_push_banner_home_dismissed';

export default function PushBanner({ variant, onDismiss }: Props) {
  const { pushState, requestEnable } = usePushSubscription();
  const [dismissed, setDismissed] = useState(() => {
    if (variant !== 'home') return false;
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(LS_KEY) === 'true';
  });

  // Hide when active (home variant) or unsupported
  if (pushState === 'unsupported') return null;
  if ((pushState === 'active' && variant === 'home') || dismissed) return null;

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
      <div className="relative rounded-xl border border-border bg-white p-3">
        <button
          onClick={handleDismiss}
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            {pushState === 'denied' ? (
              <p className="text-sm font-medium text-text">
                Notifikasi dimatikan
              </p>
            ) : (
              <>
                <p className="text-sm font-medium text-text">
                  Dapatkan info pesanan real-time
                </p>
                <button
                  onClick={handleEnable}
                  className="mt-2 inline-flex min-h-9 items-center rounded-lg bg-primary px-4 text-xs font-bold text-white active:opacity-80"
                >
                  Aktifkan Notifikasi
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // variant === 'confirm'
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      {pushState === 'denied' ? (
        <div className="flex items-center gap-3">
          <BellOff className="h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              Notifikasi dimatikan
            </p>
            <p className="mt-0.5 text-xs text-emerald-600">
              Aktifkan lewat Settings browser / iPhone
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {pushState === 'active' ? (
            <>
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-800">
                Notifikasi aktif ✓
              </p>
            </>
          ) : (
            <>
              <Bell className="h-5 w-5 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-emerald-800">
                  Pantau pesananmu secara real-time
                </p>
                <button
                  onClick={handleEnable}
                  className="mt-2 inline-flex min-h-10 items-center rounded-xl bg-white px-5 text-xs font-bold text-emerald-700 shadow-sm active:opacity-80"
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
