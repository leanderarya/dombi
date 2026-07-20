import { router } from '@inertiajs/react';
import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
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
  const { pushState } = usePushSubscription();
  const lastIdRef = useRef<number>(0);

  useEffect(() => {
    if (initialCount !== undefined) {
      setUnreadCount(initialCount);
      return;
    }

    const fetchCount = async () => {
      try {
        const params = pushState !== 'active' && lastIdRef.current > 0 ? `?since_id=${lastIdRef.current}` : '';
        const res = await fetch(`/notifications/unread-count${params}`);
        if (!res.ok) return;
        const data = await res.json();
        setUnreadCount(data.unread_count);

        if (pushState !== 'active' && data.latest?.length) {
          for (const notif of data.latest as LatestNotif[]) {
            if (notif.id <= lastIdRef.current) continue;
            toast(notif.title, {
              description: notif.message,
              action: notif.entity_type
                ? { label: 'Buka', onClick: () => router.visit(getEntityUrl(notif.entity_type!, notif.entity_id!)) }
                : undefined,
            });
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
  }, [initialCount, pushState]);

  return (
    <button
      onClick={onClick}
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
  );
}

function getEntityUrl(type: string, id: number): string {
  const map: Record<string, string> = {
    order: `/customer/orders/${id}`,
    delivery: `/courier/deliveries/${id}`,
  };
  return map[type] || '/';
}
