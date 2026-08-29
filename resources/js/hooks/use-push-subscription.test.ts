import { afterEach, describe, expect, it, vi } from 'vitest';

import { subscribeToPush } from './use-push-subscription';

const subscription = {
    toJSON: () => ({ endpoint: 'https://push.example/subscription' }),
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('subscribeToPush', () => {
    it('registers an existing browser subscription with the backend', async () => {
        const fetch = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal('fetch', fetch);
        vi.stubGlobal('navigator', {
            serviceWorker: {
                ready: Promise.resolve({
                    pushManager: {
                        getSubscription: vi
                            .fn()
                            .mockResolvedValue(subscription),
                    },
                }),
            },
        });

        await expect(subscribeToPush()).resolves.toBe(true);
        expect(fetch).toHaveBeenCalledWith(
            '/push/subscribe',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify(subscription.toJSON()),
            }),
        );
    });

    it('does not report an existing subscription active when backend registration fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
        vi.stubGlobal('navigator', {
            serviceWorker: {
                ready: Promise.resolve({
                    pushManager: {
                        getSubscription: vi
                            .fn()
                            .mockResolvedValue(subscription),
                    },
                }),
            },
        });

        await expect(subscribeToPush()).resolves.toBe(false);
    });
});
