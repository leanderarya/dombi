import { useEffect, useRef, useState } from 'react';

export function useOrderAlert() {
    const [pendingCount, setPendingCount] = useState(0);
    const prevCount = useRef(-1); // -1 = not loaded yet
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        audioRef.current = new Audio('/sounds/new-order.mp3');
        audioRef.current.volume = 0.7;
    }, []);

    useEffect(() => {
        const fetchCount = async () => {
            try {
                const res = await fetch('/outlet/orders/pending-count');

                if (!res.ok) {
return;
}

                const data = await res.json();
                const count = data.pending_count as number;

                // Play sound if count increased (not on first fetch) and not on order detail page
                const isOrderDetail = /^\/outlet\/orders\/\d+/.test(window.location.pathname);

                if (prevCount.current !== -1 && count > prevCount.current && !isOrderDetail) {
                    audioRef.current?.play().catch(() => {});
                }

                prevCount.current = count;
                setPendingCount(count);
            } catch {
                // Silently fail
            }
        };

        fetchCount();
        const interval = setInterval(fetchCount, 10_000);

        return () => clearInterval(interval);
    }, []);

    return { pendingCount };
}
