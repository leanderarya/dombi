import { router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { saveCustomerLocationSnapshot } from '@/lib/customer-location';
import { useOutletStore } from '@/lib/outlet-store';
import type { NearestOutlet } from './use-nearest-outlet';

interface PickupState {
    loading: boolean;
    error: string | null;
    foundOutletName: string | null;
}

export function usePickupFlow(nearestOutlet: NearestOutlet | null) {
    const [state, setState] = useState<PickupState>({
        loading: false,
        error: null,
        foundOutletName: null,
    });
    const timerRef = useRef<ReturnType<typeof setTimeout>>();
    const { autoSave } = useOutletStore();

    useEffect(() => () => clearTimeout(timerRef.current), []);

    const start = useCallback(async () => {
        if (state.loading) {
            return;
        }

        setState({ loading: true, error: null, foundOutletName: null });
        localStorage.setItem('dombi_fulfillment_type', 'pickup');

        // Use cached nearest outlet if available (already saved by useNearestOutlet)
        if (nearestOutlet?.name) {
            setState({
                loading: true,
                error: null,
                foundOutletName: nearestOutlet.name,
            });
            timerRef.current = setTimeout(
                () => router.get('/customer/products'),
                2000,
            );

            return;
        }

        // Otherwise fetch from API
        let outletName: string | null = null;

        try {
            const pos = await new Promise<GeolocationPosition>(
                (resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        timeout: 5000,
                    });
                },
            );
            const { latitude, longitude } = pos.coords;
            saveCustomerLocationSnapshot({
                latitude,
                longitude,
                timestamp: Date.now(),
            });

            const res = await fetch(
                `/customer/checkout/pickup-outlets?latitude=${latitude}&longitude=${longitude}`,
            );
            const data = await res.json();

            // Pick nearest open outlet
            const allOutlets = data.alternatives ?? [];
            const openOutlets = allOutlets.filter((o: any) => o.is_open !== false);
            const pick = openOutlets[0] ?? data.recommended;
            outletName = pick?.name ?? null;

            // Save recommended outlet to store so products page uses same outlet
            if (pick?.id) {
                autoSave(pick.id);
            }
        } catch {
            // silent
        }

        if (!outletName) {
            outletName = 'Outlet Dombi';
        }

        setState({ loading: true, error: null, foundOutletName: outletName });
        timerRef.current = setTimeout(
            () => router.get('/customer/products'),
            2000,
        );
    }, [nearestOutlet, state.loading, autoSave]);

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
