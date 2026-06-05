import { useState, useEffect, useCallback } from 'react';

interface Notification {
    id: number;
    type: string;
    title: string;
    message: string;
    data: Record<string, unknown> | null;
    read_at: string | null;
    created_at: string;
    time_ago: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
}

const typeIcons: Record<string, string> = {
    'order.confirmed': '✅',
    'order.rejected': '❌',
    'order.expired': '⏰',
    'order.cancelled': '🚫',
    'delivery.courier_assigned': '🚚',
    'delivery.picked_up': '📦',
    'delivery.out_for_delivery': '🛵',
    'delivery.completed': '🎉',
    'delivery.failed': '⚠️',
    'delivery.returned_to_outlet': '↩️',
    'operational.courier_rejected': '🔄',
    'operational.sla_violation': '🔔',
    'operational.returned_pending': '📋',
};

export default function NotificationSheet({ open, onClose }: Props) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/notifications');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications);
                setUnreadCount(data.unread_count);
            }
        } catch {
            // Silently fail
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (open) {
            fetchNotifications();
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [open, fetchNotifications]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    const handleMarkAsRead = async (id: number) => {
        try {
            await fetch(`/notifications/${id}/read`, { method: 'POST' });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch {
            // Silently fail
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await fetch('/notifications/read-all', { method: 'POST' });
            setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
            setUnreadCount(0);
        } catch {
            // Silently fail
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full max-w-lg rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                <div className="sticky top-0 z-10 flex justify-center rounded-t-2xl bg-white pt-3 pb-2">
                    <div className="h-1 w-12 rounded-full bg-slate-300" />
                </div>

                <div className="px-4 pb-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-bold text-slate-900">Notifikasi</h2>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllAsRead}
                                className="text-xs font-semibold text-emerald-600"
                            >
                                Tandai semua dibaca
                            </button>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <span className="text-4xl">🔔</span>
                            <p className="mt-2 text-sm text-slate-500">Belum ada notifikasi</p>
                        </div>
                    ) : (
                        <div className="mt-3 space-y-2">
                            {notifications.map((notification) => (
                                <button
                                    key={notification.id}
                                    onClick={() => handleMarkAsRead(notification.id)}
                                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                                        notification.read_at
                                            ? 'border-slate-100 bg-white'
                                            : 'border-emerald-100 bg-emerald-50/50'
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="mt-0.5 text-lg">
                                            {typeIcons[notification.type] ?? '📩'}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-slate-900">{notification.title}</span>
                                                {!notification.read_at && (
                                                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                                )}
                                            </div>
                                            <p className="mt-0.5 text-sm text-slate-600">{notification.message}</p>
                                            <p className="mt-1 text-xs text-slate-400">{notification.time_ago}</p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
