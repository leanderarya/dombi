import { useCallback, useEffect, useRef, useState } from 'react';

export interface Variant {
    id: number;
    name: string;
    flavor: string | null;
    size: string | null;
    price: number;
    is_active: boolean;
    available_stock?: number;
    stock_status?: string;
}

export interface Family {
    id: number;
    name: string;
    brand: string | null;
    description: string | null;
    variants: Variant[];
}

const CACHE_TTL_MS = 30_000; // 30s — stock changes fast

export function useProducts(outletId: number | null, outletLoading: boolean) {
    const [families, setFamilies] = useState<Family[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const cacheRef = useRef<Map<number, { data: Family[]; ts: number }>>(new Map());
    const abortRef = useRef<AbortController | null>(null);

    const fetch = useCallback((id: number | null) => {
        const key = id ?? 0;
        const cached = cacheRef.current.get(key);

        // Return cache if fresh
        if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
            setFamilies(cached.data);
            setError(null);
            setLoading(false);

            return;
        }

        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;
        setLoading(true);

        const params = id ? `?outlet_id=${id}` : '';

        window.fetch(`/customer/products/api${params}`, {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin',
            signal: ac.signal,
        })
            .then((r) => {
 if (!r.ok) {
throw new Error();
}

 return r.json(); 
})
            .then((d) => {
                if (!ac.signal.aborted) {
                    const list: Family[] = d.families ?? [];
                    cacheRef.current.set(key, { data: list, ts: Date.now() });
                    setFamilies(list);
                    setError(null);
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (err.name !== 'AbortError') {
                    setError('Gagal memuat produk');
                    setLoading(false);
                }
            });
    }, []);

    // Invalidate stale cache entries on each render
    useEffect(() => {
        const now = Date.now();

        for (const [k, v] of cacheRef.current) {
            if (now - v.ts > CACHE_TTL_MS) {
cacheRef.current.delete(k);
}
        }
    });

    // Fetch when outlet ready
    useEffect(() => {
        if (!outletLoading && outletId != null) {
fetch(outletId);
}
    }, [outletId, outletLoading, fetch]);

    const retry = useCallback(() => {
        if (outletId != null) {
fetch(outletId);
}
    }, [outletId, fetch]);

    return { families, loading: outletLoading || loading, error, retry };
}
