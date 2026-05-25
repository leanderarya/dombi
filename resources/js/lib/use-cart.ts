import { useCallback, useMemo, useSyncExternalStore } from 'react';

export interface CartItem {
    product_id: number;
    quantity: number;
}

type Listener = () => void;

/**
 * Lightweight client-side cart store.
 * Persists to sessionStorage so it survives Inertia page navigations.
 * Returns new array references on mutation for React change detection.
 */
class CartStore {
    private items: CartItem[] = [];
    private listeners: Set<Listener> = new Set();
    private snapshot: CartItem[] = [];

    constructor() {
        this.load();
        this.snapshot = [...this.items];
    }

    getSnapshot(): CartItem[] {
        return this.snapshot;
    }

    getQuantity(productId: number): number {
        return this.items.find((i) => i.product_id === productId)?.quantity ?? 0;
    }

    addItem(productId: number): void {
        const existing = this.items.find((i) => i.product_id === productId);
        if (existing) {
            existing.quantity += 1;
        } else {
            this.items.push({ product_id: productId, quantity: 1 });
        }
        this.commit();
    }

    setQuantity(productId: number, quantity: number): void {
        if (quantity <= 0) {
            this.removeItem(productId);
            return;
        }
        const existing = this.items.find((i) => i.product_id === productId);
        if (existing) {
            existing.quantity = quantity;
        } else {
            this.items.push({ product_id: productId, quantity });
        }
        this.commit();
    }

    removeItem(productId: number): void {
        this.items = this.items.filter((i) => i.product_id !== productId);
        this.commit();
    }

    clear(): void {
        this.items = [];
        this.commit();
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private commit(): void {
        this.snapshot = [...this.items];
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
            sessionStorage.setItem('dombi_cart', JSON.stringify(this.items));
        } catch {
            // Non-critical
        }
    }

    private load(): void {
        try {
            const stored = sessionStorage.getItem('dombi_cart');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    this.items = parsed.filter(
                        (i: any) => typeof i.product_id === 'number' && typeof i.quantity === 'number' && i.quantity > 0
                    );
                }
            }
        } catch {
            this.items = [];
        }
    }
}

const store = new CartStore();

const subscribe = (cb: Listener) => store.subscribe(cb);
const getSnapshot = () => store.getSnapshot();
const getServerSnapshot = () => [] as CartItem[];

/**
 * React hook for reactive cart access.
 * All derived values (totalItems) are computed from the subscribed snapshot
 * to guarantee consistency — never stale.
 */
export function useCart() {
    const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    // Derive totalItems from the snapshot — guaranteed in sync
    const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

    const addItem = useCallback((productId: number) => store.addItem(productId), []);
    const setQuantity = useCallback((productId: number, qty: number) => store.setQuantity(productId, qty), []);
    const removeItem = useCallback((productId: number) => store.removeItem(productId), []);
    const clear = useCallback(() => store.clear(), []);
    const getQuantity = useCallback((productId: number) => store.getQuantity(productId), []);

    return { items, totalItems, getQuantity, addItem, setQuantity, removeItem, clear };
}

/**
 * Lightweight hook for a single product's quantity.
 * Derives from the items snapshot — re-renders only when items change.
 */
export function useProductQuantity(productId: number): number {
    const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    return items.find((i) => i.product_id === productId)?.quantity ?? 0;
}
