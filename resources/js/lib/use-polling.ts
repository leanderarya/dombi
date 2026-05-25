import { router } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import { useOnline } from './use-online';

/**
 * Lightweight polling hook for operational pages.
 * Only polls when online and page is visible.
 * Default interval: 30 seconds.
 */
export function usePolling(intervalMs: number = 30000): void {
    const online = useOnline();
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!online) return;

        const poll = () => {
            if (document.visibilityState === 'visible' && navigator.onLine) {
                router.reload({ only: ['stats', 'alerts', 'activeDeliveries', 'recentOrders', 'lowStockItems'] });
            }
        };

        timerRef.current = setInterval(poll, intervalMs);

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                poll();
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [online, intervalMs]);
}
