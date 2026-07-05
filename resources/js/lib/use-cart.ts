import { useCallback, useMemo, useSyncExternalStore } from 'react';

export interface CartItem {
    product_variant_id: number;
    quantity: number;
    price: number;
}

type Listener = () => void;

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

    getQuantity(variantId: number): number {
        return this.items.find((i) => i.product_variant_id === variantId)?.quantity ?? 0;
    }

    addItem(variantId: number, qty: number = 1, price: number = 0): void {
        const existing = this.items.find((i) => i.product_variant_id === variantId);

        if (existing) {
            existing.quantity += qty;

            if (price > 0) {
                existing.price = price;
            }
        } else {
            this.items.push({ product_variant_id: variantId, quantity: qty, price });
        }

        this.commit();
    }

    setQuantity(variantId: number, quantity: number): void {
        if (quantity <= 0) {
            this.removeItem(variantId);

            return;
        }

        const existing = this.items.find((i) => i.product_variant_id === variantId);

        if (existing) {
            existing.quantity = quantity;
        } else {
            this.items.push({ product_variant_id: variantId, quantity, price: 0 });
        }

        this.commit();
    }

    removeItem(variantId: number): void {
        this.items = this.items.filter((i) => i.product_variant_id !== variantId);
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
                        (i: any) => typeof i.product_variant_id === 'number' && typeof i.quantity === 'number' && i.quantity > 0
                    ).map((i: any) => ({
                        product_variant_id: i.product_variant_id,
                        quantity: i.quantity,
                        price: typeof i.price === 'number' ? i.price : 0,
                    }));
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

export function useCart() {
    const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
    const totalPrice = useMemo(() => items.reduce((sum, i) => sum + (i.price * i.quantity), 0), [items]);
    const allHavePrice = useMemo(() => items.length > 0 && items.every((i) => i.price > 0), [items]);

    const addItem = useCallback((variantId: number, qty?: number, price?: number) => store.addItem(variantId, qty, price), []);
    const setQuantity = useCallback((variantId: number, qty: number) => store.setQuantity(variantId, qty), []);
    const removeItem = useCallback((variantId: number) => store.removeItem(variantId), []);
    const clear = useCallback(() => store.clear(), []);
    const getQuantity = useCallback((variantId: number) => store.getQuantity(variantId), []);

    return { items, totalItems, totalPrice, allHavePrice, getQuantity, addItem, setQuantity, removeItem, clear };
}

export function useProductQuantity(variantId: number): number {
    const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    return items.find((i) => i.product_variant_id === variantId)?.quantity ?? 0;
}
