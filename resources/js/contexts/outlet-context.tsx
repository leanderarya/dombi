import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import type { ReactNode } from 'react';
import { useCustomerLocation } from '@/lib/customer-location';
import { useOutletStore } from '@/lib/outlet-store';

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
    selectManual: (outlet: OutletOption) => void;
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
    const { outletId, autoSelected, save, autoSave } = useOutletStore();
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
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
            signal: controller.signal,
        })
            .then(async (res) => {
                if (!res.ok) {
                    throw new Error('Failed to load outlets');
                }

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

    // Auto-select logic: manual pick → auto nearest → fallback
    const selectedOutlet = useMemo(() => {
        if (outlets.length === 0) {
            return null;
        }

        // User manually picked an outlet — keep it (even if GPS changes)
        if (!autoSelected && outletId !== null) {
            const saved = outlets.find((o) => o.id === outletId);

            if (saved) {
                return saved;
            }
        }

        // Auto-select nearest (first in sorted list) or fallback to saved
        if (outletId !== null) {
            const saved = outlets.find((o) => o.id === outletId);

            if (saved) {
                return saved;
            }
        }

        // Fallback to nearest
        return outlets[0];
    }, [outlets, outletId, autoSelected]);

    // Persist selection — only override when saved outlet no longer exists
    useEffect(() => {
        if (outlets.length === 0) {
            return;
        }

        // Manual pick — keep it, don't override
        if (
            !autoSelected &&
            outletId !== null &&
            outlets.some((o) => o.id === outletId)
        ) {
            return;
        }

        // Auto mode — keep saved if it still exists in list
        if (
            autoSelected &&
            outletId !== null &&
            outlets.some((o) => o.id === outletId)
        ) {
            return;
        }

        // No saved outlet or saved outlet no longer exists — auto-pick nearest
        autoSave(outlets[0].id);
    }, [outlets, outletId, autoSelected, autoSave]);

    const selectManual = useCallback(
        (outlet: OutletOption) => {
            save(outlet.id);
        },
        [save],
    );

    const retry = useCallback(() => {
        setFetchKey((k) => k + 1);
    }, []);

    const value = useMemo<OutletContextValue>(
        () => ({
            selectedOutlet,
            selectManual,
            outlets,
            loading,
            error,
            retry,
        }),
        [selectedOutlet, selectManual, outlets, loading, error, retry],
    );

    return (
        <OutletContext.Provider value={value}>
            {children}
        </OutletContext.Provider>
    );
}
