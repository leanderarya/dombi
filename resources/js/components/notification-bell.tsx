import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

interface Props {
    unreadCount?: number;
    onClick?: () => void;
}

export default function NotificationBell({ unreadCount: initialCount, onClick }: Props) {
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
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 active:bg-slate-200"
            aria-label="Notifikasi"
        >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}
        </button>
    );
}
