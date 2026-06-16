import { useCallback, useSyncExternalStore } from 'react';

type RecoveryData = {
    phone: string;
    recent_order_codes: string[];
    last_recovered_at: number;
};

const STORAGE_KEY = 'dombi_order_recovery';

class OrderRecoveryStore {
    private data: RecoveryData | null = null;
    private listeners: Set<() => void> = new Set();

    constructor() {
        this.load();
    }

    getSnapshot(): RecoveryData | null {
        return this.data;
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);

        return () => this.listeners.delete(listener);
    }

    save(phone: string, orderCodes: string[]): void {
        const existing = this.data;
        const mergedCodes = [...new Set([...(existing?.recent_order_codes ?? []), ...orderCodes])].slice(0, 20);

        this.data = {
            phone,
            recent_order_codes: mergedCodes,
            last_recovered_at: Date.now(),
        };
        this.persist();
        this.notify();
    }

    addOrder(phone: string, orderCode: string): void {
        if (!orderCode) {
return;
}

        const existing = this.data;
        const codes = [orderCode, ...(existing?.recent_order_codes ?? [])];
        const uniqueCodes = [...new Set(codes)].slice(0, 20);

        this.data = {
            phone,
            recent_order_codes: uniqueCodes,
            last_recovered_at: Date.now(),
        };
        this.persist();
        this.notify();
    }

    getPhone(): string | null {
        return this.data?.phone ?? null;
    }

    clear(): void {
        this.data = null;
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
            if (!this.data) {
                localStorage.removeItem(STORAGE_KEY);

                return;
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        } catch {
            // Non-critical
        }
    }

    private load(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);

            if (!stored) {
return;
}

            const parsed = JSON.parse(stored) as RecoveryData;

            if (parsed && typeof parsed.phone === 'string' && Array.isArray(parsed.recent_order_codes)) {
                this.data = parsed;
            }
        } catch {
            // Ignore invalid storage
        }
    }
}

const store = new OrderRecoveryStore();

export function maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');

    if (digits.length < 6) {
return phone;
}

    return digits.slice(0, 4) + 'xxxx' + digits.slice(-3);
}

export function useOrderRecovery() {
    const data = useSyncExternalStore(
        (listener) => store.subscribe(listener),
        () => store.getSnapshot(),
        () => null,
    );

    const saveRecovery = useCallback((phone: string, orderCodes: string[]) => {
        store.save(phone, orderCodes);
    }, []);

    const addOrder = useCallback((phone: string, orderCode: string) => {
        store.addOrder(phone, orderCode);
    }, []);

    const getPhone = useCallback(() => {
        return store.getPhone();
    }, []);

    const clearRecovery = useCallback(() => {
        store.clear();
    }, []);

    return {
        data,
        hasRecovery: !!data?.phone,
        phone: data?.phone ?? null,
        maskedPhone: data?.phone ? maskPhone(data.phone) : null,
        saveRecovery,
        addOrder,
        getPhone,
        clearRecovery,
    };
}

export async function recoverOrders(phone: string): Promise<{
    found: boolean;
    customer_name?: string;
    active_orders: any[];
    recent_orders: any[];
}> {
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    const response = await fetch('/customer/orders/recovery', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...(token ? { 'X-CSRF-TOKEN': token } : {}),
        },
        body: JSON.stringify({ phone }),
        credentials: 'same-origin',
    });

    if (!response.ok) {
        return { found: false, active_orders: [], recent_orders: [] };
    }

    return response.json();
}
