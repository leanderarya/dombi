import { router } from '@inertiajs/react';
import { useEffect, useRef, useCallback } from 'react';

export function usePolling(
    intervalMs: number = 30000,
    only: string[] = [],
    enabled: boolean = true,
) {
    const isOnline = useRef(true);
    const wasHidden = useRef(false);

    const handleOnline = useCallback(() => {
        isOnline.current = true;

        // Reload immediately when coming back online
        if (enabled) {
            router.reload({ only: only.length > 0 ? only : undefined });
        }
    }, [only, enabled]);

    const handleOffline = useCallback(() => {
        isOnline.current = false;
    }, []);

    const handleVisibilityChange = useCallback(() => {
        const isHidden = document.hidden;

        if (isHidden) {
            wasHidden.current = true;
        } else if (wasHidden.current && isOnline.current && enabled) {
            // Page just became visible after being hidden — reload immediately
            wasHidden.current = false;
            router.reload({ only: only.length > 0 ? only : undefined });
        }
    }, [only, enabled]);

    useEffect(() => {
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            );
        };
    }, [handleOnline, handleOffline, handleVisibilityChange]);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const interval = setInterval(() => {
            if (isOnline.current && !document.hidden) {
                router.reload({ only: only.length > 0 ? only : undefined });
            }
        }, intervalMs);

        return () => clearInterval(interval);
    }, [intervalMs, only, enabled]);
}
