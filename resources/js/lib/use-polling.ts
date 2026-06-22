import { router } from '@inertiajs/react';
import { useEffect, useRef, useCallback } from 'react';

export function usePolling(intervalMs: number = 30000, only: string[] = []) {
    const isOnline = useRef(true);
    const isVisible = useRef(true);

    const handleOnline = useCallback(() => {
        isOnline.current = true;
    }, []);

    const handleOffline = useCallback(() => {
        isOnline.current = false;
    }, []);

    const handleVisibilityChange = useCallback(() => {
        isVisible.current = !document.hidden;
    }, []);

    useEffect(() => {
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [handleOnline, handleOffline, handleVisibilityChange]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (isOnline.current && isVisible.current) {
                router.reload({ only: only.length > 0 ? only : undefined });
            }
        }, intervalMs);

        return () => clearInterval(interval);
    }, [intervalMs, only]);
}
