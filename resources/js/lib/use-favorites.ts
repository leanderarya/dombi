import { useCallback, useSyncExternalStore } from 'react';

type Listener = () => void;

class FavoritesStore {
    private favorites: Set<number> = new Set();
    private listeners: Set<Listener> = new Set();
    private snapshot: Set<number> = new Set();

    constructor() {
        this.load();
        this.snapshot = new Set(this.favorites);
    }

    getSnapshot(): Set<number> {
        return this.snapshot;
    }

    isFavorite(variantId: number): boolean {
        return this.favorites.has(variantId);
    }

    toggle(variantId: number): void {
        if (this.favorites.has(variantId)) {
            this.favorites.delete(variantId);
        } else {
            this.favorites.add(variantId);
        }

        this.commit();
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);

        return () => this.listeners.delete(listener);
    }

    private commit(): void {
        this.snapshot = new Set(this.favorites);
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
            localStorage.setItem('dombi_favorites', JSON.stringify([...this.favorites]));
        } catch {
            // Non-critical
        }
    }

    private load(): void {
        try {
            const stored = localStorage.getItem('dombi_favorites');

            if (stored) {
                const parsed = JSON.parse(stored);

                if (Array.isArray(parsed)) {
                    this.favorites = new Set(parsed.filter((id: any) => typeof id === 'number'));
                }
            }
        } catch {
            this.favorites = new Set();
        }
    }
}

const store = new FavoritesStore();

const subscribe = (cb: Listener) => store.subscribe(cb);
const getSnapshot = () => store.getSnapshot();
const getServerSnapshot = () => new Set<number>();

export function useFavorites() {
    const favorites = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const isFavorite = useCallback((variantId: number) => store.isFavorite(variantId), []);
    const toggle = useCallback((variantId: number) => store.toggle(variantId), []);

    return { favorites, isFavorite, toggle };
}
