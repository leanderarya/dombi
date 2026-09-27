import { afterEach, describe, expect, it, vi } from 'vitest';

import { reportCourierLocation } from './use-courier-location';

const position = { coords: { latitude: -7.0568, longitude: 110.4381 } };

function stubGeolocation(
    implementation: (
        success: (position: unknown) => void,
        failure: (error: unknown) => void,
    ) => void,
) {
    vi.stubGlobal('navigator', {
        geolocation: { getCurrentPosition: vi.fn(implementation) },
    });
}

function stubDocument() {
    vi.stubGlobal('document', {
        querySelector: () => ({ getAttribute: () => 'csrf-token' }),
    });
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('reportCourierLocation', () => {
    it('posts the coordinates for the picker to rank by', () => {
        const fetch = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal('fetch', fetch);
        stubDocument();
        stubGeolocation((success) => success(position));

        reportCourierLocation();

        expect(fetch).toHaveBeenCalledWith(
            '/courier/location',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                }),
            }),
        );
    });

    it('stays quiet when geolocation is unavailable', () => {
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);
        vi.stubGlobal('navigator', {});

        expect(() => reportCourierLocation()).not.toThrow();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('does not post when the courier denies permission', () => {
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);
        stubDocument();
        stubGeolocation((_success, failure) => failure({ code: 1 }));

        expect(() => reportCourierLocation()).not.toThrow();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('does not throw when the request itself fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
        stubDocument();
        stubGeolocation((success) => success(position));

        expect(() => reportCourierLocation()).not.toThrow();

        // Let the rejected promise settle so an unhandled rejection would surface.
        await Promise.resolve();
    });
});
