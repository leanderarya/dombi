import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'dombi_selected_outlet';

type Listener = () => void;

class OutletStore {
    private outletId: number | null = null;
    private listeners: Set<Listener> = new Set();

    constructor() {
        this.load();
    }

    getSnapshot(): number | null {
        return this.outletId;
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);

        return () => this.listeners.delete(listener);
    }

    save(outletId: number): void {
        this.outletId = outletId;
        this.persist();
        this.notify();
    }

    clear(): void {
        this.outletId = null;
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
            if (this.outletId === null) {
                localStorage.removeItem(STORAGE_KEY);
            } else {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.outletId));
            }
        } catch {
            // Non-critical
        }
    }

    private load(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);

            if (stored) {
                const parsed = JSON.parse(stored);

                if (typeof parsed === 'number') {
                    this.outletId = parsed;
                }
            }
        } catch {
            // Ignore invalid storage
        }
    }
}

const store = new OutletStore();

export function useOutletStore() {
    const outletId = useSyncExternalStore(
        (listener) => store.subscribe(listener),
        () => store.getSnapshot(),
        () => null,
    );

    const save = useCallback((id: number) => {
        store.save(id);
    }, []);

    const clear = useCallback(() => {
        store.clear();
    }, []);

    return { outletId, save, clear };
}
