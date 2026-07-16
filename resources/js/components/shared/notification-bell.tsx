import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props {
    unreadCount?: number;
    onClick?: () => void;
}

export default function NotificationBell({
    unreadCount: initialCount,
    onClick,
}: Props) {
    const [unreadCount, setUnreadCount] = useState(initialCount ?? 0);

    useEffect(() => {
        if (initialCount !== undefined) {
            setUnreadCount(initialCount);

            return;
        }

        // Poll for unread count every 30 seconds
        const fetchCount = async () => {
            try {
                const res = await fetch('/notifications/unread-count');

                if (res.ok) {
                    const data = await res.json();
                    setUnreadCount(data.unread_count);
                }
            } catch {
                // Silently fail
            }
        };

        fetchCount();
        const interval = setInterval(fetchCount, 30000);

        return () => clearInterval(interval);
    }, [initialCount]);

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
