import { useCallback, useMemo, useSyncExternalStore } from 'react';

export interface CartItem {
    product_id: number;
    product_variant_id?: number; // backward compat
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

    getQuantity(productId: number): number {
        return (
            this.items.find(
                (i) =>
                    i.product_id === productId ||
                    i.product_variant_id === productId,
            )?.quantity ?? 0
        );
    }

    addItem(productId: number, qty: number = 1, price: number = 0): void {
        const existing = this.items.find(
            (i) =>
                i.product_id === productId ||
                i.product_variant_id === productId,
        );

        if (existing) {
            existing.quantity += qty;

            if (price > 0) {
                existing.price = price;
            }

            // Ensure product_id is set for migrated entries
            if (!existing.product_id) {
                existing.product_id =
                    (existing as any).product_variant_id ?? productId;
            }

            existing.product_id = productId;
        } else {
            this.items.push({
                product_id: productId,
                quantity: qty,
                price,
            });
        }

        this.commit();
    }

    setQuantity(productId: number, quantity: number): void {
        if (quantity <= 0) {
            this.removeItem(productId);

            return;
        }

        const existing = this.items.find(
            (i) =>
                i.product_id === productId ||
                i.product_variant_id === productId,
        );

        if (existing) {
            existing.quantity = quantity;
            existing.product_id = productId;
        } else {
            this.items.push({
                product_id: productId,
                quantity,
                price: 0,
            });
        }

        this.commit();
    }

    removeItem(productId: number): void {
        this.items = this.items.filter(
            (i) =>
                i.product_id !== productId &&
                i.product_variant_id !== productId,
        );
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
            const data = JSON.stringify(this.items);
            sessionStorage.setItem('dombi_cart', data);

            // Also persist to localStorage for backward compat migration path
            try {
                localStorage.setItem('dombi_cart', data);
            } catch {
                // ignore
            }
        } catch {
            // Non-critical
        }
    }

    private load(): void {
        try {
            // Try sessionStorage first, fallback to localStorage for migration
            let stored: string | null = null;

            try {
                stored = sessionStorage.getItem('dombi_cart');
            } catch {
                stored = null;
            }

            if (!stored) {
                try {
                    stored = localStorage.getItem('dombi_cart');
                } catch {
                    stored = null;
                }
            }

            if (stored) {
                const parsed = JSON.parse(stored);

                if (Array.isArray(parsed)) {
                    const migrated = parsed
                        .map((i: any) => ({
                            product_id:
                                typeof i.product_id === 'number'
                                    ? i.product_id
                                    : typeof i.product_variant_id === 'number'
                                      ? i.product_variant_id
                                      : null,
                            quantity: i.quantity,
                            price:
                                typeof i.price === 'number' ? i.price : 0,
                        }))
                        .filter(
                            (i: any) =>
                                typeof i.product_id === 'number' &&
                                typeof i.quantity === 'number' &&
                                i.quantity > 0,
                        )
                        .map((i: any) => ({
                            product_id: i.product_id,
                            quantity: i.quantity,
                            price: i.price,
                        }));
                    this.items = migrated;

                    // Persist migrated format immediately
                    try {
                        this.persist();
                    } catch {
                        // ignore
                    }
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
    const items = useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot,
    );

    const totalItems = useMemo(
        () => items.reduce((sum, i) => sum + i.quantity, 0),
        [items],
    );
    const totalPrice = useMemo(
        () => items.reduce((sum, i) => sum + i.price * i.quantity, 0),
        [items],
    );
    const allHavePrice = useMemo(
        () => items.length > 0 && items.every((i) => i.price > 0),
        [items],
    );

    const addItem = useCallback(
        (variantId: number, qty?: number, price?: number) =>
            store.addItem(variantId, qty, price),
        [],
    );
    const setQuantity = useCallback(
        (variantId: number, qty: number) => store.setQuantity(variantId, qty),
        [],
    );
    const removeItem = useCallback(
        (variantId: number) => store.removeItem(variantId),
        [],
    );
    const clear = useCallback(() => store.clear(), []);
    const getQuantity = useCallback(
        (variantId: number) => store.getQuantity(variantId),
        [],
    );

    return {
        items,
        totalItems,
        totalPrice,
        allHavePrice,
        getQuantity,
        addItem,
        setQuantity,
        removeItem,
        clear,
    };
}

export function useProductQuantity(productId: number): number {
    const items = useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot,
    );

    return (
        items.find(
            (i) =>
                i.product_id === productId ||
                i.product_variant_id === productId,
        )?.quantity ?? 0
    );
}
