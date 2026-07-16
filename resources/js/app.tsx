import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import DevToolbar from '@/components/dev-toolbar';
import CartConfirmationProvider from '@/providers/cart-confirmation-provider';
import FavoritesProvider from '@/providers/favorites-provider';

const appName = import.meta.env.VITE_APP_NAME || 'Dombi';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    progress: {
        color: '#047857',
    },
    setup({ el, App, props }) {
        const root = createRoot(el!);

        root.render(
            <>
                <FavoritesProvider>
                    <CartConfirmationProvider>
                        <App {...props} />
                    </CartConfirmationProvider>
                </FavoritesProvider>
                <Toaster position="top-center" richColors closeButton />
                {(props.initialPage.props.dev as Record<string, unknown>)
                    ?.isLocal && (
                    <DevToolbar
                        currentRole={
                            (
                                props.initialPage.props.dev as Record<
                                    string,
                                    unknown
                                >
                            ).currentRole as string | null
                        }
                        env={
                            (
                                props.initialPage.props.dev as Record<
                                    string,
                                    unknown
                                >
                            ).env as string
                        }
                    />
                )}
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
    });
}

// Detect standalone PWA mode
if (
    typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: standalone)').matches
) {
    document.documentElement.classList.add('pwa-standalone');
}
