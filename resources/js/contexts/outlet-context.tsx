import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useOutletStore } from '@/lib/outlet-store';
import { useCustomerLocation } from '@/lib/customer-location';

export type OutletOption = {
    id: number;
    name: string;
    address: string;
    kelurahan?: string | null;
    kecamatan?: string | null;
    phone?: string | null;
    distance_km?: number | null;
    stock_available: boolean;
};

type OutletContextValue = {
    selectedOutlet: OutletOption | null;
    setOutlet: (outlet: OutletOption) => void;
    outlets: OutletOption[];
    loading: boolean;
    error: string | null;
    retry: () => void;
};

const OutletContext = createContext<OutletContextValue | null>(null);

export function useOutlet(): OutletContextValue {
    const ctx = useContext(OutletContext);
    if (!ctx) {
        throw new Error('useOutlet must be used within OutletProvider');
    }
    return ctx;
}

export default function OutletProvider({ children }: { children: ReactNode }) {
    const { outletId, save } = useOutletStore();
    const { location } = useCustomerLocation();
    const [outlets, setOutlets] = useState<OutletOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fetchKey, setFetchKey] = useState(0);
    const abortRef = useRef<AbortController | null>(null);

    // Fetch outlets when location changes or retry is triggered
    useEffect(() => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (location?.latitude !== undefined) {
            params.set('latitude', String(location.latitude));
        }
        if (location?.longitude !== undefined) {
            params.set('longitude', String(location.longitude));
        }

        fetch(`/customer/outlets?${params.toString()}`, {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin',
            signal: controller.signal,
        })
            .then(async (res) => {
                if (!res.ok) throw new Error('Failed to load outlets');
                return res.json();
            })
            .then((data) => {
                if (!controller.signal.aborted) {
                    setOutlets(data.outlets ?? []);
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (err.name !== 'AbortError') {
                    setError('Gagal memuat outlet');
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, [location?.latitude, location?.longitude, fetchKey]);

    // Auto-select logic: localStorage → nearest → null
    const selectedOutlet = useMemo(() => {
        if (outlets.length === 0) return null;

        // 1. Try localStorage saved ID
        if (outletId !== null) {
            const saved = outlets.find((o) => o.id === outletId);
            if (saved) return saved;
        }

        // 2. Auto-select first (nearest by distance or first alphabetically)
        return outlets[0];
    }, [outlets, outletId]);

    // Persist default selection when none saved
    useEffect(() => {
        if (outlets.length > 0 && outletId === null) {
            save(outlets[0].id);
        } else if (outlets.length > 0 && outletId !== null && !outlets.some((o) => o.id === outletId)) {
            // Saved outlet no longer exists — reset to nearest
            save(outlets[0].id);
        }
    }, [outlets, outletId, save]);

    const setOutlet = useCallback((outlet: OutletOption) => {
        save(outlet.id);
    }, [save]);

    const retry = useCallback(() => {
        setFetchKey((k) => k + 1);
    }, []);

    const value = useMemo<OutletContextValue>(() => ({
        selectedOutlet,
        setOutlet,
        outlets,
        loading,
        error,
        retry,
    }), [selectedOutlet, setOutlet, outlets, loading, error, retry]);

    return (
        <OutletContext.Provider value={value}>
            {children}
        </OutletContext.Provider>
    );
}
