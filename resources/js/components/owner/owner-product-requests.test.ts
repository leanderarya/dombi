import { describe, expect, it, vi } from 'vitest';
import {
    runAddOutletProductsRequest,
    runAvailableProductsRequest,
} from './owner-product-requests';

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });

    return { promise, resolve };
}

describe('owner product requests', () => {
    it('ignores a late available-products response after the modal closes', async () => {
        const response = deferred<
            {
                variant_id: number;
                name: string;
                family_name: string;
                selling_price: number;
            }[]
        >();
        const controller = new AbortController();
        const onProducts = vi.fn();
        const onSettled = vi.fn();
        const running = runAvailableProductsRequest({
            outletId: 7,
            signal: controller.signal,
            request: () => response.promise,
            onProducts,
            onSettled,
        });

        controller.abort();
        response.resolve([
            {
                variant_id: 11,
                name: 'Late product',
                family_name: 'Late family',
                selling_price: 10_000,
            },
        ]);
        await running;

        expect(onProducts).not.toHaveBeenCalled();
        expect(onSettled).not.toHaveBeenCalled();
    });

    it('ignores late POST callbacks after the modal closes', async () => {
        const response = deferred<{ ok: boolean; error?: string }>();
        const controller = new AbortController();
        const onSuccess = vi.fn();
        const onError = vi.fn();
        const onSettled = vi.fn();
        const running = runAddOutletProductsRequest({
            outletId: 7,
            variantIds: [11],
            initialStock: 4,
            csrfToken: 'token',
            signal: controller.signal,
            request: () => response.promise,
            onSuccess,
            onError,
            onSettled,
        });

        controller.abort();
        response.resolve({ ok: false, error: 'Late failure' });
        await running;

        expect(onSuccess).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
        expect(onSettled).not.toHaveBeenCalled();
    });
});
