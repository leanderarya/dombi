import {
    CircleCheck,
    CircleX,
    Clock,
    Ban,
    Truck,
    Package,
    Bike,
    TriangleAlert,
    Undo2,
    RefreshCw,
    Bell,
    ClipboardList,
    Mail,
    AlertTriangle,
} from 'lucide-react';
import { router } from '@inertiajs/react';
import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

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
    /** Called when user clicks an inventory-related notification (optional). */
    onNavigate?: (type: string, data: Record<string, unknown> | null) => void;
}

/** Notification types that should navigate the outlet to restock page. */
const INVENTORY_ACTION_TYPES = new Set([
    'inventory.low_stock',
    'inventory.critical_stock',
    'inventory.restock_created',
    'inventory.restock_approved',
    'inventory.restock_rejected',
]);

const typeIcons: Record<string, ReactNode> = {
    // Pesanan
    'order.confirmed': <CircleCheck className="h-5 w-5 text-emerald-600" />,
    'order.rejected': <CircleX className="h-5 w-5 text-red-600" />,
    'order.expired': <Clock className="h-5 w-5 text-amber-600" />,
    'order.cancelled': <Ban className="h-5 w-5 text-slate-500" />,
    // Pengiriman
    'delivery.courier_assigned': <Truck className="h-5 w-5 text-blue-600" />,
    'delivery.picked_up': <Package className="h-5 w-5 text-emerald-600" />,
    'delivery.out_for_delivery': <Bike className="h-5 w-5 text-blue-600" />,
    'delivery.completed': <CircleCheck className="h-5 w-5 text-emerald-600" />,
    'delivery.failed': <TriangleAlert className="h-5 w-5 text-red-600" />,
    'delivery.returned_to_outlet': <Undo2 className="h-5 w-5 text-amber-600" />,
    // Operasional
    'operational.courier_rejected': (
        <RefreshCw className="h-5 w-5 text-amber-600" />
    ),
    'operational.sla_violation': <Bell className="h-5 w-5 text-red-600" />,
    'operational.returned_pending': (
        <ClipboardList className="h-5 w-5 text-blue-600" />
    ),
    // Inventaris — Stok
    'inventory.low_stock': <TriangleAlert className="h-5 w-5 text-amber-600" />,
    'inventory.critical_stock': (
        <AlertTriangle className="h-5 w-5 text-red-600" />
    ),
    // Inventaris — Restock
    'inventory.restock_created': <Package className="h-5 w-5 text-blue-600" />,
    'inventory.restock_approved': (
        <CircleCheck className="h-5 w-5 text-emerald-600" />
    ),
    'inventory.restock_rejected': <CircleX className="h-5 w-5 text-red-600" />,
    // Inventaris — Distribusi
    'inventory.distribution_sent': <Truck className="h-5 w-5 text-blue-600" />,
    'inventory.distribution_received': (
        <Package className="h-5 w-5 text-emerald-600" />
    ),
    // Inventaris — Return & Tukar
    'inventory.return_request_created': (
        <Undo2 className="h-5 w-5 text-amber-600" />
    ),
    'inventory.exchange_request_created': (
        <RefreshCw className="h-5 w-5 text-blue-600" />
    ),
};

export default function NotificationSheet({
    open,
    onClose,
    onNavigate,
}: Props) {
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

        return () => {
            document.body.style.overflow = '';
        };
    }, [open, fetchNotifications]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handler);

        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    const csrfHeaders = {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN':
            document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content') ?? '',
    };

    const handleMarkAsRead = async (
        id: number,
        type: string,
        data: Record<string, unknown> | null,
    ) => {
        try {
            await fetch(`/notifications/${id}/read`, {
                method: 'POST',
                headers: csrfHeaders,
            });
            setNotifications((prev) =>
                prev.map((n) =>
                    n.id === id
                        ? { ...n, read_at: new Date().toISOString() }
                        : n,
                ),
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch {
            // Silently fail
        }

        // Navigate for inventory action types
        if (onNavigate && INVENTORY_ACTION_TYPES.has(type)) {
            onClose();
            onNavigate(type, data);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await fetch('/notifications/read-all', {
                method: 'POST',
                headers: csrfHeaders,
            });
            setNotifications((prev) =>
                prev.map((n) => ({
                    ...n,
                    read_at: n.read_at ?? new Date().toISOString(),
                })),
            );
            setUnreadCount(0);
        } catch {
            // Silently fail
        }
    };

    if (!open) {
        return null;
    }

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div
                className="relative w-full max-w-lg rounded-t-2xl bg-white pb-safe"
                style={{ maxHeight: '80vh', overflowY: 'auto' }}
            >
                <div className="sticky top-0 z-10 flex justify-center rounded-t-2xl bg-white pt-3 pb-2">
                    <div className="h-1 w-12 rounded-full bg-slate-300" />
                </div>

                <div className="px-4 pb-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-bold text-slate-900">
                            Notifikasi
                        </h2>
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
                            <Bell className="h-8 w-8 text-slate-400" />
                            <p className="mt-2 text-sm text-slate-500">
                                Belum ada notifikasi
                            </p>
                        </div>
                    ) : (
                        <div className="mt-3 space-y-2">
                            {notifications.map((notification) => (
                                <button
                                    key={notification.id}
                                    onClick={() =>
                                        handleMarkAsRead(
                                            notification.id,
                                            notification.type,
                                            notification.data,
                                        )
                                    }
                                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                                        notification.read_at
                                            ? 'border-slate-100 bg-white'
                                            : 'border-emerald-100 bg-emerald-50/50'
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="mt-0.5 text-slate-500">
                                            {typeIcons[notification.type] ?? (
                                                <Mail className="h-5 w-5" />
                                            )}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-slate-900">
                                                    {notification.title}
                                                </span>
                                                {!notification.read_at && (
                                                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                                )}
                                            </div>
                                            <p className="mt-0.5 text-sm text-slate-600">
                                                {notification.message}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-400">
                                                {notification.time_ago}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}
