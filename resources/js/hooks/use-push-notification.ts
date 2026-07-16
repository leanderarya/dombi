import { useEffect } from 'react';

function urlBase64ToUint8Array(base64String: string): BufferSource {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const rawData = window.atob(base64);

    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function getCsrfToken(): string {
    return (
        document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute('content') ?? ''
    );
}

export function usePushNotification() {
    useEffect(() => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return;
        }

        const subscribe = async () => {
            try {
                const registration = await navigator.serviceWorker.ready;

                // Check if already subscribed
                const existing =
                    await registration.pushManager.getSubscription();

                if (existing) {
                    return;
                }

                // Get VAPID public key from meta tag
                const vapidKey = document
                    .querySelector('meta[name="vapid-public-key"]')
                    ?.getAttribute('content');

                if (!vapidKey) {
                    return;
                }

                // Subscribe to push
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidKey),
                });

                // Send subscription to backend
                await fetch('/outlet/push-subscribe', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': getCsrfToken(),
                    },
                    body: JSON.stringify(subscription.toJSON()),
                });
            } catch {
                // Silently fail — push is best-effort
            }
        };

        subscribe();
    }, []);
}
