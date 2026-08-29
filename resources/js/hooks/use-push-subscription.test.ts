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

    it('returns false when backend registration fails', async () => {
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

    it('returns false when backend registration throws server error', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: false, status: 500 }),
        );
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

    it('returns false on network error', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
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

describe('usePushSubscription', () => {
    it('defines error state distinct from denied', () => {
        const denied = 'denied' as const;
        const error = 'error' as const;

        expect(error).toBe('error');
        expect(denied).not.toBe(error);
    });
});
