import { createInertiaApp, router } from '@inertiajs/react';
import { Component, lazy, Suspense, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { usePushSubscription } from '@/hooks/use-push-subscription';

const appName = import.meta.env.VITE_APP_NAME || 'Dombi';

const DevToolbar =
    import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLBAR === 'true'
        ? lazy(() => import('@/components/dev-toolbar'))
        : null;

class ErrorBoundary extends Component<
    { children: ReactNode },
    { hasError: boolean; error: Error | null }
> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen flex-col items-center justify-center bg-white p-6 text-center">
                    <h1 className="mb-2 text-lg font-bold">
                        Terjadi kesalahan
                    </h1>
                    <p className="mb-4 text-sm text-gray-500">
                        {this.state.error?.message || 'Unknown error'}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
                    >
                        Muat ulang
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

const PushInit = () => {
    usePushSubscription();

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'NAVIGATE' && event.data?.url) {
                router.visit(event.data.url);
            }
        };
        navigator.serviceWorker.addEventListener('message', handleMessage);

        return () =>
            navigator.serviceWorker.removeEventListener(
                'message',
                handleMessage,
            );
    }, []);

    return null;
};

createInertiaApp({
    title: (title) =>
        title ? `${title} - ${appName} Admin` : `${appName} Admin`,
    progress: {
        color: '#047857',
    },
    resolve: (name) => {
        const pages = import.meta.glob<{ default: ComponentType }>([
            './pages/{owner,outlet,courier,auth}/**/*.tsx',
            '!./pages/**/*.test.tsx',
        ]);
        const page = pages[`./pages/${name}.tsx`];

        if (!page) {
            throw new Error(`Page not found: ${name}`);
        }

        return page().then(({ default: component }) => component);
    },
    setup({ el, App, props }) {
        const devValue = props.initialPage.props.dev;
        const dev =
            typeof devValue === 'object' && devValue !== null
                ? (devValue as {
                      isLocal?: boolean;
                      currentRole?: string | null;
                      env?: string;
                  })
                : null;
        const root = createRoot(el!);
        root.render(
            <ErrorBoundary>
                <PushInit />
                <App {...props} />
                <Toaster
                    position="top-center"
                    richColors
                    closeButton
                    style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
                />
                {DevToolbar && dev?.isLocal && (
                    <Suspense fallback={null}>
                        <DevToolbar
                            currentRole={dev.currentRole ?? null}
                            env={dev.env ?? ''}
                        />
                    </Suspense>
                )}
            </ErrorBoundary>,
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
