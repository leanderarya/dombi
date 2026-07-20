import { useEffect, useState } from 'react';

export type PushState = 'active' | 'denied' | 'unsupported' | 'loading';

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function getCsrfToken(): string {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
}

export function usePushSubscription(): { pushState: PushState } {
  const [pushState, setPushState] = useState<PushState>('loading');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushState('unsupported');
      return;
    }

    if (Notification.permission === 'denied') {
      setPushState('denied');
      return;
    }

    if (Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => {
        if (perm !== 'granted') {
          setPushState('denied');
          return;
        }
        subscribe();
      });
      return;
    }

    subscribe();

    async function subscribe() {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          setPushState('active');
          return;
        }

        const vapidKey = document.querySelector('meta[name="vapid-public-key"]')?.getAttribute('content');
        if (!vapidKey) {
          setPushState('unsupported');
          return;
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });

        await fetch('/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrfToken() },
          body: JSON.stringify(subscription.toJSON()),
        });

        setPushState('active');
      } catch {
        setPushState('denied');
      }
    }
  }, []);

  return { pushState };
}
