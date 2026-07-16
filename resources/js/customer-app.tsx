import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import CartConfirmationProvider from '@/providers/cart-confirmation-provider';

const appName = import.meta.env.VITE_APP_NAME || 'Dombi';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    progress: {
        color: '#047857',
    },
    resolve: (name) => {
        const customerPages = import.meta.glob('./pages/customer/**/*.tsx', {
            eager: true,
        });
        const authPages = import.meta.glob('./pages/auth/**/*.tsx', {
            eager: true,
        });
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
