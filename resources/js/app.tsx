import { createInertiaApp } from '@inertiajs/react';
import { lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import CartConfirmationProvider from '@/providers/cart-confirmation-provider';
import FavoritesProvider from '@/providers/favorites-provider';

const appName = import.meta.env.VITE_APP_NAME || 'Dombi';

const DevToolbar =
    import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLBAR === 'true'
        ? lazy(() => import('@/components/dev-toolbar'))
        : null;

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    progress: {
        color: '#047857',
    },
    resolve: (name) => {
        const pages = import.meta.glob<{ default: ComponentType }>([
            './pages/**/*.tsx',
            '!./pages/**/*.test.tsx',
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
                <FavoritesProvider>
                    <CartConfirmationProvider>
                        <App {...props} />
                    </CartConfirmationProvider>
                </FavoritesProvider>
                <Toaster
                    position="top-center"
                    richColors
                    closeButton
                    style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
                />
                {DevToolbar &&
                    (props.initialPage.props.dev as Record<string, unknown>)
                        ?.isLocal && (
                        <Suspense fallback={null}>
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
                        </Suspense>
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
