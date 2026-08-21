import { describe, expect, it, vi } from 'vitest';
import { runAutoRecovery } from './recovery-auto-submit';

type SuccessfulResult = {
    found: true;
    active_orders: { order_code: string }[];
    recent_orders: { order_code: string }[];
};

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });

    return { promise, resolve };
}

describe('runAutoRecovery', () => {
    it('finishes with the latest callbacks when they change in flight', async () => {
        const recovery = deferred<SuccessfulResult>();
        const firstCallbacks = {
            onLoadingChange: vi.fn(),
            onRecovered: vi.fn(),
        };
        const latestCallbacks = {
            onLoadingChange: vi.fn(),
            onRecovered: vi.fn(),
        };
        let callbacks = firstCallbacks;

        const running = runAutoRecovery({
            phone: '628123456789',
            recover: () => recovery.promise,
            isCancelled: () => false,
            getEvents: () => ({
                onLoadingChange: callbacks.onLoadingChange,
                onNotFound: vi.fn(),
                onVerificationRequired: vi.fn(),
                onRecovered: (_phone, result, orderCodes) =>
                    callbacks.onRecovered(result, orderCodes),
                onError: vi.fn(),
            }),
        });

        expect(firstCallbacks.onLoadingChange).toHaveBeenCalledWith(true);

        callbacks = latestCallbacks;
        recovery.resolve({
            found: true,
            active_orders: [{ order_code: 'ORD-1' }],
            recent_orders: [{ order_code: 'ORD-2' }],
        });
        await running;

        expect(firstCallbacks.onRecovered).not.toHaveBeenCalled();
        expect(latestCallbacks.onRecovered).toHaveBeenCalledWith(
            {
                found: true,
                active_orders: [{ order_code: 'ORD-1' }],
                recent_orders: [{ order_code: 'ORD-2' }],
            },
            ['ORD-1', 'ORD-2'],
        );
        expect(latestCallbacks.onLoadingChange).toHaveBeenCalledWith(false);
    });
});
