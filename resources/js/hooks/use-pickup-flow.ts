import { router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { NearestOutlet } from './use-nearest-outlet';

interface PickupState {
    loading: boolean;
    error: string | null;
    foundOutletName: string | null;
}

export function usePickupFlow(nearestOutlet: NearestOutlet | null) {
    const [state, setState] = useState<PickupState>({ loading: false, error: null, foundOutletName: null });
    const timerRef = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => () => clearTimeout(timerRef.current), []);

    const start = useCallback(async () => {
        if (state.loading) return;

        setState({ loading: true, error: null, foundOutletName: null });
        localStorage.setItem('dombi_fulfillment_type', 'pickup');

        // Use cached nearest outlet if available
        if (nearestOutlet?.name) {
            setState({ loading: true, error: null, foundOutletName: nearestOutlet.name });
            timerRef.current = setTimeout(() => router.get('/customer/products'), 2000);
            return;
        }

        // Otherwise fetch from API
        let outletName: string | null = null;

        try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
            });
            const res = await fetch(`/customer/checkout/pickup-outlets?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}`);
            const data = await res.json();
            outletName = data.recommended?.name ?? null;
        } catch {
            // silent
        }

        if (!outletName) outletName = 'Outlet Dombi';

        setState({ loading: true, error: null, foundOutletName: outletName });
        timerRef.current = setTimeout(() => router.get('/customer/products'), 2000);
    }, [nearestOutlet, state.loading]);

    const retry = useCallback(() => {
        setState({ loading: false, error: null, foundOutletName: null });
        start();
    }, [start]);

    const cancel = useCallback(() => {
        clearTimeout(timerRef.current);
        setState({ loading: false, error: null, foundOutletName: null });
    }, []);

    return { ...state, start, retry, cancel };
}
