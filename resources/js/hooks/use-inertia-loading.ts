import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { pollingReloadActive } from '@/lib/use-polling';

export function useInertiaLoading() {
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );

    useEffect(() => {
        const removeStart = router.on('start', () => {
            if (pollingReloadActive.current) return;
            debounceRef.current = setTimeout(() => setLoading(true), 200);
        });
        const removeFinish = router.on('finish', () => {
            clearTimeout(debounceRef.current);
            setLoading(false);
        });

        return () => {
            removeStart();
            removeFinish();
            clearTimeout(debounceRef.current);
        };
    }, []);

    return { loading };
}
