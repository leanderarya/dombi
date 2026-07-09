import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

export function useInertiaLoading() {
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        const removeStart = router.on('start', () => {
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
