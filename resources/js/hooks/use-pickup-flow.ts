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
            // Fallback: try stored customer location before giving up
            try {
                // Try last known location from localStorage
                let storedLat: number | null = null;
                let storedLng: number | null = null;

                try {
                    for (const key of ['customer.location', 'dombi_customer_location']) {
                        const raw = localStorage.getItem(key);
                        if (!raw) continue;
                        const parsed = JSON.parse(raw);
                        if (typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
                            storedLat = parsed.latitude;
                            storedLng = parsed.longitude;
                            break;
                        }
                    }
                } catch {
                    // ignore parse errors
                }

                let fallbackUrl = '/customer/outlets';
                if (storedLat !== null && storedLng !== null) {
                    fallbackUrl += `?latitude=${storedLat}&longitude=${storedLng}`;
                }

                const fallbackRes = await fetch(fallbackUrl);
                const fallbackData = await fallbackRes.json();
                const outlets = fallbackData.outlets ?? [];
                const open = outlets.filter((o: any) => o.is_open !== false);
                // When we have lat/lng (stored), outlets are distance-sorted, pick first open = true nearest
                // When no lat/lng, don't auto-pick alphabetically — keep null to avoid fake Bangetayu
                let pick = null;
                if (storedLat !== null) {
                    pick = open[0] ?? outlets[0];
                } else {
                    // No GPS and no stored location — don't guess, let products page handle selection
                    pick = null;
                }

                outletName = pick?.name ?? null;

                if (pick?.id) {
                    autoSave(pick.id);
                }
            } catch {
                // final fallback still null, will show generic searching state
            }
        }

        // If still no name, keep null to show generic loading state instead of fake name
        // If you want brand fallback, use null and let overlay show searching
        // For safety, if still null, use generic brand name without pretending it's specific
        if (!outletName) {
            outletName = null;
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
