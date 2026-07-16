import { useCallback, useMemo, useSyncExternalStore } from 'react';

export type CustomerLocation = {
    address_id?: number;
    address_line?: string;
    address_detail?: string;
    province?: string;
    city?: string;
    district?: string;
    village?: string;
    postal_code?: string;
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    timestamp: number;
    landmark?: string;
    delivery_notes?: string;
    used_for_order?: boolean;
};

type Listener = () => void;

const STORAGE_KEYS = ['customer.location', 'dombi_customer_location'] as const;

class CustomerLocationStore {
    private location: CustomerLocation | null = null;
    private listeners: Set<Listener> = new Set();

    constructor() {
        this.load();
    }

    getSnapshot(): CustomerLocation | null {
        return this.location;
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);

        return () => this.listeners.delete(listener);
    }

    save(location: CustomerLocation): void {
        const wasUsed = this.location?.used_for_order ?? false;
        this.location = {
            ...location,
            used_for_order: wasUsed || location.used_for_order === true,
        };
        this.persist();
        this.notify();
    }

    markUsedForOrder(): void {
        if (this.location) {
            this.location = { ...this.location, used_for_order: true };
            this.persist();
            this.notify();
        }
    }

    clear(): void {
        this.location = null;
        this.persist();
        this.notify();
    }

    private notify(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }

    private persist(): void {
        try {
            if (!this.location) {
                for (const key of STORAGE_KEYS) {
                    localStorage.removeItem(key);
                }

                return;
            }

            for (const key of STORAGE_KEYS) {
                localStorage.setItem(key, JSON.stringify(this.location));
            }
        } catch {
            // Non-critical
        }
    }

    private load(): void {
        try {
            for (const key of STORAGE_KEYS) {
                const stored = localStorage.getItem(key);

                if (!stored) {
                    continue;
                }

                const parsed = JSON.parse(stored) as CustomerLocation | null;

                if (
                    parsed &&
                    typeof parsed.latitude === 'number' &&
                    typeof parsed.longitude === 'number' &&
                    typeof parsed.timestamp === 'number'
                ) {
                    this.location = parsed;

                    return;
                }
            }
        } catch {
            // Ignore invalid storage
        }

        this.location = null;
    }
}

const store = new CustomerLocationStore();

/** Non-reactive escape hatch — call for one-shot persistence without subscribing. */
export function saveCustomerLocationSnapshot(loc: CustomerLocation): void {
    store.save(loc);
}

export function useCustomerLocation() {
    const location = useSyncExternalStore(
        (listener) => store.subscribe(listener),
        () => store.getSnapshot(),
        () => null,
    );

    const saveLocation = useCallback((nextLocation: CustomerLocation) => {
        store.save(nextLocation);
    }, []);

    const clearLocation = useCallback(() => {
        store.clear();
    }, []);

    const markUsedForOrder = useCallback(() => {
        store.markUsedForOrder();
    }, []);

    const summary = useMemo(() => {
        if (!location) {
            return null;
        }

        return (
            [location.village, location.district].filter(Boolean).join(', ') ||
            location.address_line ||
            null
        );
    }, [location]);

    const hasUsedLocation = useMemo(
        () => location?.used_for_order === true,
        [location],
    );

    return {
        location,
        summary,
        hasUsedLocation,
        saveLocation,
        clearLocation,
        markUsedForOrder,
    };
}

export async function syncCustomerLocationDraft(
    location: CustomerLocation,
): Promise<void> {
    try {
        const token = document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute('content');

        const response = await fetch('/customer/location', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                ...(token ? { 'X-CSRF-TOKEN': token } : {}),
            },
            body: JSON.stringify(location),
            credentials: 'same-origin',
        });

        if (!response.ok) {
            console.warn('Failed to sync location to server:', response.status);
        }
    } catch (error) {
        console.warn('Failed to sync location to server:', error);
    }
}
