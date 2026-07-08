import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'dombi_selected_outlet';
const AUTO_KEY = 'dombi_outlet_auto_selected';

type Listener = () => void;
type Snapshot = { outletId: number | null; autoSelected: boolean };

class OutletStore {
    private outletId: number | null = null;
    private autoSelected = true;
    private listeners: Set<Listener> = new Set();
    private cachedSnapshot: Snapshot = { outletId: null, autoSelected: true };

    constructor() {
        this.load();
    }

    getSnapshot(): Snapshot {
        if (this.cachedSnapshot.outletId !== this.outletId || this.cachedSnapshot.autoSelected !== this.autoSelected) {
            this.cachedSnapshot = { outletId: this.outletId, autoSelected: this.autoSelected };
        }

        return this.cachedSnapshot;
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);

        return () => this.listeners.delete(listener);
    }

    /** User manually picks an outlet — stick to it */
    select(outletId: number): void {
        this.outletId = outletId;
        this.autoSelected = false;
        this.persist();
        this.notify();
    }

    /** System auto-picks nearest — can be overridden on next GPS change */
    autoSelect(outletId: number): void {
        this.outletId = outletId;
        this.autoSelected = true;
        this.persist();
        this.notify();
    }

    clear(): void {
        this.outletId = null;
        this.autoSelected = true;
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

            localStorage.setItem(AUTO_KEY, JSON.stringify(this.autoSelected));
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

            const autoRaw = localStorage.getItem(AUTO_KEY);

            if (autoRaw) {
                const parsed = JSON.parse(autoRaw);

                if (typeof parsed === 'boolean') {
                    this.autoSelected = parsed;
                }
            }
        } catch {
            // Ignore invalid storage
        }
    }
}

const store = new OutletStore();

export function useOutletStore() {
    const snapshot = useSyncExternalStore(
        (listener) => store.subscribe(listener),
        () => store.getSnapshot(),
        () => ({ outletId: null, autoSelected: true }),
    );

    const save = useCallback((id: number) => {
        store.select(id);
    }, []);

    const autoSave = useCallback((id: number) => {
        store.autoSelect(id);
    }, []);

    const clear = useCallback(() => {
        store.clear();
    }, []);

    return { outletId: snapshot.outletId, autoSelected: snapshot.autoSelected, save, autoSave, clear };
}
