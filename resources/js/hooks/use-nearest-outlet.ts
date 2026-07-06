import { useEffect, useState } from 'react';
import { syncCustomerLocationDraft, useCustomerLocation } from '@/lib/customer-location';

export interface NearestOutlet {
    name: string;
    distance_km: number | null;
}

export function useNearestOutlet() {
    const [outlet, setOutlet] = useState<NearestOutlet | null>(null);
    const { saveLocation } = useCustomerLocation();

    useEffect(() => {
        if (!navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    const { latitude, longitude } = pos.coords;
                    const locData = { latitude, longitude, timestamp: Date.now() };

                    saveLocation(locData);
                    syncCustomerLocationDraft(locData);

                    const res = await fetch(`/customer/checkout/pickup-outlets?latitude=${latitude}&longitude=${longitude}`);
                    const data = await res.json();

                    if (data.recommended) {
                        setOutlet({ name: data.recommended.name, distance_km: data.recommended.distance_km });
                    }
                } catch {
                    // silent
                }
            },
            () => { /* permission denied */ },
            { enableHighAccuracy: false, timeout: 5000 },
        );
    }, [saveLocation]);

    return outlet;
}
