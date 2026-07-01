import { useEffect, useState } from 'react';

export interface OutletBadgeCounts {
    returns: number;
    exchanges: number;
    restocks: number;
    deliveries: number;
    payments: number;
    reports: number;
}

const EMPTY_COUNTS: OutletBadgeCounts = {
    returns: 0,
    exchanges: 0,
    restocks: 0,
    deliveries: 0,
    payments: 0,
    reports: 0,
};

export function useOutletBadges() {
    const [badgeCounts, setBadgeCounts] = useState<OutletBadgeCounts>(EMPTY_COUNTS);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchCounts = async () => {
            try {
                const res = await fetch('/outlet/badge-counts');
                if (!res.ok) return;
                const data = await res.json();
                setBadgeCounts({
                    returns: data.returns ?? 0,
                    exchanges: data.exchanges ?? 0,
                    restocks: data.restocks ?? 0,
                    deliveries: data.deliveries ?? 0,
                    payments: data.payments ?? 0,
                    reports: data.reports ?? 0,
                });
            } catch {
                // Silently fail
            } finally {
                setIsLoading(false);
            }
        };

        fetchCounts();
        const interval = setInterval(fetchCounts, 30_000);

        return () => clearInterval(interval);
    }, []);

    return { badgeCounts, isLoading };
}
