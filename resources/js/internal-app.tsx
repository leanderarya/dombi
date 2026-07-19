import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { Component, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import DevToolbar from '@/components/dev-toolbar';

const appName = import.meta.env.VITE_APP_NAME || 'Dombi';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
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
                    <h1 className="mb-2 text-lg font-bold">Terjadi kesalahan</h1>
                    <p className="mb-4 text-sm text-gray-500">{this.state.error?.message || 'Unknown error'}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
                    >
                        Muat ulang
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

createInertiaApp({
    title: (title) =>
        title ? `${title} - ${appName} Admin` : `${appName} Admin`,
    progress: {
        color: '#047857',
    },
    resolve: (name) => {
        const pages = import.meta.glob(
            './pages/{owner,outlet,courier,auth}/**/*.tsx',
            { eager: true },
        );
        const page = pages[`./pages/${name}.tsx`];

        if (!page) {
            throw new Error(`Page not found: ${name}`);
        }

        return page;
    },
    setup({ el, App, props }) {
        const root = createRoot(el!);
        root.render(
            <ErrorBoundary>
                <App {...props} />
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
