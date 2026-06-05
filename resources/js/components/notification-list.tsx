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
    initialNotifications?: Notification[];
    initialUnreadCount?: number;
    onNotificationClick?: (notification: Notification) => void;
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

export default function NotificationList({ initialNotifications, initialUnreadCount, onNotificationClick }: Props) {
    const [notifications, setNotifications] = useState<Notification[]>(initialNotifications ?? []);
    const [unreadCount, setUnreadCount] = useState(initialUnreadCount ?? 0);
    const [loading, setLoading] = useState(!initialNotifications);

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
        if (!initialNotifications) {
            fetchNotifications();
        }
    }, [initialNotifications, fetchNotifications]);

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

    const handleClick = (notification: Notification) => {
        if (!notification.read_at) {
            handleMarkAsRead(notification.id);
        }
        onNotificationClick?.(notification);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
            </div>
        );
    }

    return (
        <div>
            {unreadCount > 0 && (
                <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm text-slate-500">{unreadCount} belum dibaca</span>
                    <button
                        onClick={handleMarkAllAsRead}
                        className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                    >
                        Tandai semua dibaca
                    </button>
                </div>
            )}

            {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <span className="text-4xl">🔔</span>
                    <p className="mt-2 text-sm text-slate-500">Belum ada notifikasi</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {notifications.map((notification) => (
                        <button
                            key={notification.id}
                            onClick={() => handleClick(notification)}
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
    );
}
