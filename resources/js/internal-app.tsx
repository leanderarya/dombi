import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import DevToolbar from '@/components/dev-toolbar';

const appName = import.meta.env.VITE_APP_NAME || 'Dombi';

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
            <>
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
            </>,
        );
    },
});
