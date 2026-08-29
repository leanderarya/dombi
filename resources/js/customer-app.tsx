import { createInertiaApp } from '@inertiajs/react';
import { useEffect } from 'react';
import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { useCapacitorBackButton } from '@/hooks/use-capacitor-back-button';
import { usePushSubscription } from '@/hooks/use-push-subscription';
import CartConfirmationProvider from '@/providers/cart-confirmation-provider';

const appName = import.meta.env.VITE_APP_NAME || 'Dombi';

function getCsrfToken(): string {
    return (
        document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute('content') ?? ''
    );
}

const PushInit = () => {
    usePushSubscription();

    useEffect(() => {
        const nativeListenersPromise = (async () => {
            try {
                const { PushNotifications } =
                    await import('@capacitor/push-notifications');
                const perm = await PushNotifications.requestPermissions();

                if (perm.receive !== 'granted') {
                    return [];
                }

                await PushNotifications.register();

                const regListener = await PushNotifications.addListener(
                    'registration',
                    (token) => {
                        fetch('/push/fcm-token', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRF-TOKEN': getCsrfToken(),
                            },
                            body: JSON.stringify({
                                token: token.value,
                                device_type: 'android',
                            }),
                        });
                    },
                );

                const actionListener = await PushNotifications.addListener(
                    'pushNotificationActionPerformed',
                    (notif) => {
                        const url = notif.notification.data?.url;

                        if (url) {
                            window.location.href = url;
                        }
                    },
                );

                return [regListener, actionListener];
            } catch {
                // Not running in Capacitor — skip native push
                return [];
            }
        })();

        // Listen for SW navigation messages (iOS PWA notification tap)
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'NAVIGATE' && event.data?.url) {
                import('@inertiajs/react').then(({ router }) =>
                    router.visit(event.data.url),
                );
            }
        };
        navigator.serviceWorker.addEventListener('message', handleMessage);

        return () => {
            void nativeListenersPromise.then((listeners) =>
                Promise.all(listeners.map((listener) => listener.remove())),
            );
            navigator.serviceWorker.removeEventListener(
                'message',
                handleMessage,
            );
        };
    }, []);

    return null;
};

const BackButtonInit = () => {
    useCapacitorBackButton();

    return null;
};

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    progress: {
        color: '#047857',
    },
    resolve: (name) => {
        const pages = import.meta.glob<{ default: ComponentType }>([
            './pages/customer/**/*.tsx',
            './pages/auth/**/*.tsx',
            './pages/*.tsx',
        ]);
        const page = pages[`./pages/${name}.tsx`];

        if (!page) {
            throw new Error(`Page not found: ${name}`);
        }

        return page().then(({ default: component }) => component);
    },
    setup({ el, App, props }) {
        const root = createRoot(el!);
        root.render(
            <>
                <CartConfirmationProvider>
                    <App {...props} />
                </CartConfirmationProvider>
                <Toaster
                    position="top-center"
                    richColors
                    closeButton
                    style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
                />
                <PushInit />
                <BackButtonInit />
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
        if (onOfflinePage) {
            return;
        }

        onOfflinePage = true;
        window.location.href = '/offline.html';
    });

    window.addEventListener('online', () => {
        onOfflinePage = false;
    });
}
