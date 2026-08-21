import type { OutletPriceRow } from './types';

export interface CompareData {
    outlet_id: number;
    outlet_name: string;
    prices: OutletPriceRow[];
}

interface CompareRequestOptions {
    outletIds: number[];
    signal: AbortSignal;
    request: (
        outletIds: number[],
        signal: AbortSignal,
    ) => Promise<CompareData[]>;
    onData: (data: CompareData[]) => void;
    onError?: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isOutletPriceRow(value: unknown): value is OutletPriceRow {
    return (
        isRecord(value) &&
        (typeof (value as any).product_id === 'number' ||
            typeof (value as any).variant_id === 'number') &&
        typeof (value as any).name === 'string' &&
        typeof (value as any).center_price === 'number' &&
        typeof (value as any).selling_price === 'number' &&
        typeof (value as any).margin === 'number'
    );
}

function isCompareData(value: unknown): value is CompareData {
    return (
        isRecord(value) &&
        typeof value.outlet_id === 'number' &&
        typeof value.outlet_name === 'string' &&
        Array.isArray(value.prices) &&
        value.prices.every(isOutletPriceRow)
    );
}

export async function fetchCompareData(
    outletIds: number[],
    signal: AbortSignal,
): Promise<CompareData[]> {
    const params = new URLSearchParams();
    outletIds.forEach((id) => params.append('outlet_ids[]', String(id)));
    const response = await fetch(
        `/owner/pricing/outlets/compare?${params.toString()}`,
        {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            signal,
        },
    );
    const payload: unknown = await response.json();
    const data = isRecord(payload) ? payload.data : undefined;

    return Array.isArray(data) && data.every(isCompareData) ? data : [];
}

export async function runCompareRequest({
    outletIds,
    signal,
    request,
    onData,
    onError,
}: CompareRequestOptions): Promise<void> {
    try {
        const data = await request(outletIds, signal);

        if (!signal.aborted) {
            onData(data);
        }
    } catch {
        if (!signal.aborted) {
            onError?.();
        }
    }
}
