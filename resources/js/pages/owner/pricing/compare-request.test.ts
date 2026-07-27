import { describe, expect, it, vi } from 'vitest';
import { runCompareRequest } from './compare-request';

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });

    return { promise, resolve };
}

describe('runCompareRequest', () => {
    it('keeps a replaced rapid-selection request from publishing stale data', async () => {
        const firstResponse =
            deferred<
                { outlet_id: number; outlet_name: string; prices: never[] }[]
            >();
        const secondResponse =
            deferred<
                { outlet_id: number; outlet_name: string; prices: never[] }[]
            >();
        const firstController = new AbortController();
        const secondController = new AbortController();
        const onData = vi.fn();

        const firstRun = runCompareRequest({
            outletIds: [1, 2],
            signal: firstController.signal,
            request: () => firstResponse.promise,
            onData,
        });
        firstController.abort();
        const secondRun = runCompareRequest({
            outletIds: [2, 3],
            signal: secondController.signal,
            request: () => secondResponse.promise,
            onData,
        });

        secondResponse.resolve([
            { outlet_id: 2, outlet_name: 'Current', prices: [] },
        ]);
        await secondRun;
        firstResponse.resolve([
            { outlet_id: 1, outlet_name: 'Stale', prices: [] },
        ]);
        await firstRun;

        expect(onData).toHaveBeenCalledTimes(1);
        expect(onData).toHaveBeenCalledWith([
            { outlet_id: 2, outlet_name: 'Current', prices: [] },
        ]);
    });
});
