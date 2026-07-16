import { useEffect, useRef } from 'react';
import {
    syncCustomerLocationDraft,
    useCustomerLocation,
} from '@/lib/customer-location';

export default function CustomerLocationBootstrap() {
    const { location } = useCustomerLocation();
    const syncedAt = useRef<number | null>(null);

    useEffect(() => {
        if (!location || syncedAt.current === location.timestamp) {
            return;
        }

        syncedAt.current = location.timestamp;
        void syncCustomerLocationDraft(location);
    }, [location]);

    return null;
}
