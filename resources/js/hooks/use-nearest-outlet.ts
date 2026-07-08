import { useEffect, useState } from 'react';
import { syncCustomerLocationDraft, useCustomerLocation } from '@/lib/customer-location';
import { useOutletStore } from '@/lib/outlet-store';

export interface NearestOutlet {
    id: number | null;
    name: string;
    distance_km: number | null;
}

export function useNearestOutlet() {
    const [outlet, setOutlet] = useState<NearestOutlet | null>(null);
    const { saveLocation } = useCustomerLocation();
    const { autoSave } = useOutletStore();

    useEffect(() => {
        if (!navigator.geolocation) {
return;
}

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
                        setOutlet({ id: data.recommended.id ?? null, name: data.recommended.name, distance_km: data.recommended.distance_km });

                        if (data.recommended.id) {
autoSave(data.recommended.id);
}
                    }
                } catch {
                    // silent
                }
            },
            () => { /* permission denied */ },
            { enableHighAccuracy: false, timeout: 5000 },
        );
    }, [saveLocation, autoSave]);

    return outlet;
}
