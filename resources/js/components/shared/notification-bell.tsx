import { router } from '@inertiajs/react';
import { Bell, CheckCircle2, Clock, Package, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { usePushSubscription } from '@/hooks/use-push-subscription';

interface Props {
  unreadCount?: number;
  onClick?: () => void;
}

interface LatestNotif {
  id: number;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: number | null;
}

export default function NotificationBell({ unreadCount: initialCount, onClick }: Props) {
  const [unreadCount, setUnreadCount] = useState(initialCount ?? 0);
  const { pushState, requestEnable } = usePushSubscription();
  const lastIdRef = useRef<number>(0);
  const toastTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Cleanup toast timers on unmount
  useEffect(() => () => toastTimers.current.forEach(clearTimeout), []);

  const handleClick = () => {
    if (pushState === 'loading') {
      requestEnable();
      return;
    }
    onClick?.();
  };

  useEffect(() => {
    if (initialCount !== undefined) {
      setUnreadCount(initialCount);
      return;
    }

    const fetchCount = async () => {
      try {
        const params = lastIdRef.current > 0 ? `?since_id=${lastIdRef.current}` : '';
        const res = await fetch(`/notifications/unread-count${params}`);
        if (!res.ok) return;
        const data = await res.json();
        setUnreadCount(data.unread_count);

        if (data.latest?.length) {
          for (const notif of data.latest as LatestNotif[]) {
            if (notif.id <= lastIdRef.current) continue;
            showOrderToast(notif.title, notif.message, notif.entity_type, notif.entity_id);
          }
          const ids = data.latest.map((n: LatestNotif) => n.id);
          if (ids.length) lastIdRef.current = Math.max(...ids);
        }
      } catch {
        // silently fail
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [initialCount]);

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className="relative flex h-11 w-11 items-center justify-center rounded-lg text-text-muted transition-colors active:bg-surface-muted"
        aria-label="Notifikasi"
      >
        <Bell className="h-5 w-5" strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {pushState === 'loading' && (
        <button
          onClick={requestEnable}
          className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-primary"
        >
          Aktifkan Notifikasi
        </button>
      )}
    </div>
  );
}

function getEntityUrl(type: string, id: number): string {
  const map: Record<string, string> = {
    order: `/customer/orders/${id}`,
    delivery: `/courier/deliveries/${id}`,
  };
  return map[type] || '/';
}

/* ─── In-app Toast ─────────────────────────────────────────── */

function toastIcon(type?: string | null) {
  switch (type) {
    case 'order':
      return <Package className="h-4 w-4 text-emerald-600" />;
    default:
      return <Bell className="h-4 w-4 text-emerald-600" />;
  }
}

function showOrderToast(title: string, message: string, entityType: string | null, entityId: number | null) {
  // Use dynamic import to avoid circular deps with sonner
  import('sonner').then(({ toast }) => {
    toast.custom(
      (t) => (
        <div
          className="flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-3 shadow-lg"
          style={{ animation: 'toastSlideIn 0.3s ease-out' }}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            {toastIcon(entityType)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-text">{title}</div>
            <div className="mt-0.5 line-clamp-2 text-xs text-text-muted">{message}</div>
          </div>
          {entityType && entityId && (
            <button
              type="button"
              onClick={() => {
                toast.dismiss(t);
                router.visit(getEntityUrl(entityType, entityId));
              }}
              className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white active:opacity-80"
            >
              Buka
            </button>
          )}
        </div>
      ),
      { duration: 5000, position: 'top-center', style: { top: 'calc(env(safe-area-inset-top, 0px) + 8px)' } },
    );
  });
}
