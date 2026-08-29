import { describe, expect, it, vi } from 'vitest';
import { CheckoutLocationSaver } from './checkout-location-save';

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((nextResolve) => {
        resolve = nextResolve;
    });

    return { promise, resolve };
}

describe('CheckoutLocationSaver', () => {
    it('waits for an older save before persisting and continuing with current location', async () => {
        const olderSave = deferred();
        const save = vi
            .fn<(location: string) => Promise<void>>()
            .mockReturnValueOnce(olderSave.promise)
            .mockResolvedValueOnce();
        const continueCheckout = vi.fn();
        const saver = new CheckoutLocationSaver(save);

        void saver.persist('older');
        const continuing = saver.persist('current').then(continueCheckout);
        await Promise.resolve();

        expect(save).toHaveBeenCalledTimes(1);
        expect(continueCheckout).not.toHaveBeenCalled();

        olderSave.resolve();
        await continuing;

        expect(save).toHaveBeenCalledTimes(2);
        expect(continueCheckout).toHaveBeenCalledOnce();
    });
});
