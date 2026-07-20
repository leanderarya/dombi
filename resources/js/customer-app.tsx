import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { useEffect } from 'react';
import { Toaster } from 'sonner';
import CartConfirmationProvider from '@/providers/cart-confirmation-provider';
import { usePushSubscription } from '@/hooks/use-push-subscription';

const appName = import.meta.env.VITE_APP_NAME || 'Dombi';

function getCsrfToken(): string {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
}

const PushInit = () => {
  usePushSubscription();

  useEffect(() => {
    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== 'granted') return;

        await PushNotifications.register();

        const regListener = PushNotifications.addListener('registration', (token) => {
          fetch('/push/fcm-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrfToken() },
            body: JSON.stringify({ token: token.value, device_type: 'android' }),
          });
        });

        const actionListener = PushNotifications.addListener('pushNotificationActionPerformed', (notif) => {
          const url = notif.notification.data?.url;
          if (url) window.location.href = url;
        });

        cleanup = () => {
          regListener.remove();
          actionListener.remove();
        };
      } catch {
        // Not running in Capacitor — skip native push
      }
    })();

    return () => { cleanup?.(); };
  }, []);

  return null;
};

createInertiaApp({
  title: (title) => (title ? `${title} - ${appName}` : appName),
  progress: {
    color: '#047857',
  },
  resolve: (name) => {
    const customerPages = import.meta.glob('./pages/customer/**/*.tsx', { eager: true });
    const authPages = import.meta.glob('./pages/auth/**/*.tsx', { eager: true });
    const rootPages = import.meta.glob('./pages/*.tsx', { eager: true });
    const pages = { ...customerPages, ...authPages, ...rootPages };
    const page = pages[`./pages/${name}.tsx`];

    if (!page) {
      throw new Error(`Page not found: ${name}`);
    }

    return page;
  },
  setup({ el, App, props }) {
    const root = createRoot(el!);
    root.render(
      <>
        <CartConfirmationProvider>
          <App {...props} />
        </CartConfirmationProvider>
        <Toaster position="top-center" richColors closeButton />
        <PushInit />
      </>,
    );
  },
});

// Register service worker for PWA
if (
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  import.meta.env.PROD
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed - non-critical
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (confirm('Update tersedia. Muat ulang?')) {
        window.location.reload();
      }
    });
  });
}

// Global offline navigation — redirect to /offline when connectivity lost
if (typeof window !== 'undefined') {
  let onOfflinePage = false;

  window.addEventListener('offline', () => {
    if (onOfflinePage) return;
    onOfflinePage = true;
    window.location.href = '/offline';
  });

  window.addEventListener('online', () => {
    onOfflinePage = false;
  });
}
