export interface AvailableProduct {
    variant_id: number;
    name: string;
    family_name: string;
    selling_price: number;
}

interface RequestResult {
    ok: boolean;
    error?: string;
}

interface AvailableProductsRequestOptions {
    outletId: number;
    signal: AbortSignal;
    request: (
        outletId: number,
        signal: AbortSignal,
    ) => Promise<AvailableProduct[]>;
    onProducts: (products: AvailableProduct[]) => void;
    onSettled: () => void;
}

interface AddOutletProductsRequestOptions {
    outletId: number;
    variantIds: number[];
    initialStock: number;
    csrfToken: string;
    signal: AbortSignal;
    request: (options: {
        outletId: number;
        variantIds: number[];
        initialStock: number;
        csrfToken: string;
        signal: AbortSignal;
    }) => Promise<RequestResult>;
    onSuccess: () => void;
    onError: (message: string) => void;
    onSettled: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isAvailableProduct(value: unknown): value is AvailableProduct {
    return (
        isRecord(value) &&
        typeof value.variant_id === 'number' &&
        typeof value.name === 'string' &&
        typeof value.family_name === 'string' &&
        typeof value.selling_price === 'number'
    );
}

export async function fetchAvailableProducts(
    outletId: number,
    signal: AbortSignal,
): Promise<AvailableProduct[]> {
    const response = await fetch(
        `/owner/outlets/${outletId}/products/available`,
        {
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            signal,
        },
    );

    if (!response.ok) {
        return [];
    }

    const payload: unknown = await response.json();

    return Array.isArray(payload) && payload.every(isAvailableProduct)
        ? payload
        : [];
}

export async function postOutletProducts({
    outletId,
    variantIds,
    initialStock,
    csrfToken,
    signal,
}: {
    outletId: number;
    variantIds: number[];
    initialStock: number;
    csrfToken: string;
    signal: AbortSignal;
}): Promise<RequestResult> {
    const response = await fetch(`/owner/outlets/${outletId}/products`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-TOKEN': csrfToken,
        },
        body: JSON.stringify({
            variant_ids: variantIds,
            initial_stock: initialStock,
        }),
        signal,
    });
    const payload: unknown = await response.json();
    const error =
        isRecord(payload) && typeof payload.error === 'string'
            ? payload.error
            : undefined;

    return { ok: response.ok, error };
}

export async function runAvailableProductsRequest({
    outletId,
    signal,
    request,
    onProducts,
    onSettled,
}: AvailableProductsRequestOptions): Promise<void> {
    try {
        const products = await request(outletId, signal);

        if (!signal.aborted) {
            onProducts(products);
        }
    } catch {
        if (!signal.aborted) {
            onProducts([]);
        }
    } finally {
        if (!signal.aborted) {
            onSettled();
        }
    }
}

export async function runAddOutletProductsRequest({
    outletId,
    variantIds,
    initialStock,
    csrfToken,
    signal,
    request,
    onSuccess,
    onError,
    onSettled,
}: AddOutletProductsRequestOptions): Promise<void> {
    try {
        const result = await request({
            outletId,
            variantIds,
            initialStock,
            csrfToken,
            signal,
        });

        if (signal.aborted) {
            return;
        }

        if (result.ok) {
            onSuccess();
        } else {
            onError(result.error ?? 'Gagal menambahkan produk.');
        }
    } catch {
        if (!signal.aborted) {
            onError('Gagal menambahkan produk.');
        }
    } finally {
        if (!signal.aborted) {
            onSettled();
        }
    }
}
