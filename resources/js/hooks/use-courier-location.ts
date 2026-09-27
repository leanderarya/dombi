import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';

/**
 * Comfortably inside CourierLocationService::FRESH_MINUTES so a report that lands
 * slightly late still counts, without asking for a new fix more often than needed.
 */
const REFRESH_MS = 3 * 60 * 1000;

/**
 * Sends one position report to /courier/location.
 *
 * A denied permission, an unavailable fix or a dropped request are all silent:
 * the picker only uses this to rank couriers by distance, so failing to report
 * costs the courier their place in the order, never their visibility.
 */
export function reportCourierLocation(): void {
    if (!('geolocation' in navigator)) {
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            void fetch('/courier/location', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN':
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute('content') ?? '',
                },
                body: JSON.stringify({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                }),
            }).catch(() => {
                // A dropped report just means a staler distance.
            });
        },
        () => {
            // Denied or unavailable: the courier stays online, just unranked.
        },
        { maximumAge: 60_000, timeout: 10_000 },
    );
}

/**
 * Keeps the outlet's courier picker ranking this courier by distance, for as long
 * as they are online.
 */
export function useCourierLocation() {
    const { auth } = usePage<any>().props;
    const isOnlineCourier =
        auth?.user?.role === 'courier' && Boolean(auth?.user?.is_online);

    useEffect(() => {
        if (!isOnlineCourier) {
            return;
        }

        reportCourierLocation();
        const timer = window.setInterval(reportCourierLocation, REFRESH_MS);

        return () => window.clearInterval(timer);
    }, [isOnlineCourier]);
}

export default useCourierLocation;
