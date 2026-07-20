import { useCallback, useEffect, useState } from 'react';

export type PushState = 'active' | 'denied' | 'unsupported' | 'loading';

const CSRF_TOKEN =
  typeof document !== 'undefined'
    ? document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? ''
    : '';

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function doSubscribe(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) return true;

    const vapidKey = document.querySelector('meta[name="vapid-public-key"]')?.getAttribute('content');
    if (!vapidKey) return false;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const res = await fetch('/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': CSRF_TOKEN },
      body: JSON.stringify(subscription.toJSON()),
    });

    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Auto-subscribe on mount when permission is already granted.
 * For `default` state (iOS PWA), we DON'T auto-prompt — caller must invoke `requestEnable()` on user gesture.
 */
export function usePushSubscription(): { pushState: PushState; requestEnable: () => Promise<boolean> } {
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

    if (Notification.permission === 'granted') {
      doSubscribe().then((ok) => setPushState(ok ? 'active' : 'denied'));
      return;
    }

    // default — wait for user gesture
    setPushState('loading');
  }, []);

  const requestEnable = useCallback(async (): Promise<boolean> => {
    if (pushState === 'active') return true;
    if (pushState === 'unsupported') return false;

    let perm = Notification.permission;
    if (perm === 'default') {
      perm = await Notification.requestPermission();
    }
    if (perm !== 'granted') {
      setPushState('denied');
      return false;
    }

    const ok = await doSubscribe();
    setPushState(ok ? 'active' : 'denied');
    return ok;
  }, [pushState]);

  return { pushState, requestEnable };
}
