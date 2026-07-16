import { useCallback, useSyncExternalStore } from 'react';

type Listener = () => void;

const GUEST_KEY = 'dombi.favorites.guest';

class FavoritesStore {
    private favorites: Set<number> = new Set();
    private listeners: Set<Listener> = new Set();
    private snapshot: Set<number> = new Set();
    private mode: 'guest' | 'user' = 'guest';
    private initPromise: Promise<void> | null = null;

    getSnapshot(): Set<number> {
        return this.snapshot;
    }

    isFavorite(variantId: number): boolean {
        return this.favorites.has(variantId);
    }

    /**
     * Initialize the store based on auth state.
     * Idempotent: calling twice with the same auth state is a no-op.
     * Always fetches from server when logged in (source of truth).
     */
    init(isLoggedIn: boolean): void {
        // If an init is already in flight, let it finish
        if (this.initPromise) {
            return;
        }

        const targetMode = isLoggedIn ? 'user' : 'guest';

        // Same mode and already hydrated — nothing to do
        if (this.mode === targetMode && this.favorites.size > 0) {
            return;
        }

        this.initPromise = this.doInit(isLoggedIn).finally(() => {
            this.initPromise = null;
        });
    }

    private async doInit(isLoggedIn: boolean): Promise<void> {
        if (isLoggedIn) {
            this.mode = 'user';
            const serverOk = await this.loadFromServer();

            if (!serverOk) {
                // Server fetch failed — don't proceed with merge
                return;
            }

            // Merge guest favorites if they exist (union, non-destructive)
            const guestIds = this.loadGuestFromStorage();

            if (guestIds.length > 0) {
                await this.mergeGuest(guestIds);
            }

            // Always clear guest storage after successful login
            this.clearGuestStorage();
        } else {
            this.mode = 'guest';
            this.loadFromGuestStorage();
        }
    }

    /**
     * Called on logout — clear user data from memory, switch to guest mode.
     * Does NOT touch server data.
     */
    logout(): void {
        this.mode = 'guest';
        this.favorites = new Set();
        this.initPromise = null;
        this.loadFromGuestStorage();
        this.commit();
    }

    async toggle(variantId: number): Promise<void> {
        if (this.mode === 'guest') {
            this.toggleLocal(variantId);
        } else {
            await this.toggleServer(variantId);
        }
    }

    // ── Private ───────────────────────────────────────────────────

    private toggleLocal(variantId: number): void {
        if (this.favorites.has(variantId)) {
            this.favorites.delete(variantId);
        } else {
            this.favorites.add(variantId);
        }

        this.commit();
        this.persistGuestToStorage();
    }

    private async toggleServer(variantId: number): Promise<void> {
        // Optimistic update
        const wasFavorite = this.favorites.has(variantId);

        if (wasFavorite) {
            this.favorites.delete(variantId);
        } else {
            this.favorites.add(variantId);
        }

        this.commit();

        try {
            const res = await fetch('/customer/favorites/toggle', {
                method: 'POST',
                headers: this.headers(),
                credentials: 'same-origin',
                body: JSON.stringify({ product_variant_id: variantId }),
            });

            if (res.ok) {
                const data = await res.json();

                // Reconcile with server response
                if (data.favorited) {
                    this.favorites.add(variantId);
                } else {
                    this.favorites.delete(variantId);
                }

                this.commit();
            } else {
                // Revert on failure
                if (wasFavorite) {
                    this.favorites.add(variantId);
                } else {
                    this.favorites.delete(variantId);
                }

                this.commit();
            }
        } catch {
            // Revert on network error
            if (wasFavorite) {
                this.favorites.add(variantId);
            } else {
                this.favorites.delete(variantId);
            }

            this.commit();
        }
    }

    /**
     * Load favorites from server. Returns true on success, false on failure.
     * On failure, does NOT modify the favorites set.
     */
    private async loadFromServer(): Promise<boolean> {
        try {
            const res = await fetch('/customer/favorites', {
                headers: this.headers(),
                credentials: 'same-origin',
            });

            if (res.ok) {
                const data = await res.json();
                const ids = (data.variant_ids ?? []).filter(
                    (id: unknown): id is number => typeof id === 'number',
                );
                this.favorites = new Set(ids);
                this.commit();

                return true;
            }

            return false;
        } catch {
            return false;
        }
    }

    /**
     * Merge guest favorites into account (union). Non-destructive.
     * Only adds, never removes.
     */
    private async mergeGuest(guestIds: number[]): Promise<void> {
        try {
            const res = await fetch('/customer/favorites/merge', {
                method: 'POST',
                headers: this.headers(),
                credentials: 'same-origin',
                body: JSON.stringify({ variant_ids: guestIds }),
            });

            if (res.ok) {
                const data = await res.json();
                const ids = (data.variant_ids ?? []).filter(
                    (id: unknown): id is number => typeof id === 'number',
                );
                this.favorites = new Set(ids);
                this.commit();
            }
            // On failure, server favorites already loaded — no change
        } catch {
            // Non-critical — server favorites already loaded
        }
    }

    private loadFromGuestStorage(): void {
        const ids = this.loadGuestFromStorage();
        this.favorites = new Set(ids);
        this.commit();
    }

    private loadGuestFromStorage(): number[] {
        try {
            const stored = localStorage.getItem(GUEST_KEY);

            if (stored) {
                const parsed = JSON.parse(stored);

                if (Array.isArray(parsed)) {
                    return parsed.filter(
                        (id: unknown): id is number => typeof id === 'number',
                    );
                }
            }
        } catch {
            // Non-critical
        }

        return [];
    }

    private persistGuestToStorage(): void {
        try {
            localStorage.setItem(
                GUEST_KEY,
                JSON.stringify([...this.favorites]),
            );
        } catch {
            // Non-critical
        }
    }

    private clearGuestStorage(): void {
        try {
            localStorage.removeItem(GUEST_KEY);
        } catch {
            // Non-critical
        }
    }

    private headers(): Record<string, string> {
        const token =
            document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content') ?? '';

        return {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-TOKEN': token,
        };
    }

    private commit(): void {
        this.snapshot = new Set(this.favorites);
        this.notify();
    }

    private notify(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);

        return () => this.listeners.delete(listener);
    }
}

export const favoritesStore = new FavoritesStore();

const subscribe = (cb: Listener) => favoritesStore.subscribe(cb);
const getSnapshot = () => favoritesStore.getSnapshot();
const getServerSnapshot = () => new Set<number>();

export function useFavorites() {
    const favorites = useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot,
    );

    const isFavorite = useCallback(
        (variantId: number) => favoritesStore.isFavorite(variantId),
        [],
    );
    const toggle = useCallback(
        (variantId: number) => favoritesStore.toggle(variantId),
        [],
    );

    return { favorites, isFavorite, toggle };
}
