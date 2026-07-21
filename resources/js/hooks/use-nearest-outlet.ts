import { useEffect, useState } from 'react';
import {
    syncCustomerLocationDraft,
    useCustomerLocation,
} from '@/lib/customer-location';
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
                    const locData = {
                        latitude,
                        longitude,
                        timestamp: Date.now(),
                    };

                    saveLocation(locData);
                    syncCustomerLocationDraft(locData);

                    const res = await fetch(
                        `/customer/checkout/pickup-outlets?latitude=${latitude}&longitude=${longitude}`,
                    );
                    const data = await res.json();

                    // Pick nearest open outlet
                    const allOutlets = data.alternatives ?? [];
                    const openOutlets = allOutlets.filter((o: any) => o.is_open !== false);
                    const pick = openOutlets[0] ?? data.recommended;

                    if (pick) {
                        setOutlet({
                            id: pick.id ?? null,
                            name: pick.name,
                            distance_km: pick.distance_km,
                        });

                        if (pick.id) {
                            autoSave(pick.id);
                        }
                    }
                } catch {
                    // silent
                }
            },
            () => {
                /* permission denied */
            },
            { enableHighAccuracy: false, timeout: 5000 },
        );
    }, [saveLocation, autoSave]);

    return outlet;
}
