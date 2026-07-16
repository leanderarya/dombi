import { router } from '@inertiajs/react';
import { useEffect } from 'react';

/**
 * Redirect to a default status tab if no status query param is present.
 * Used by list pages that default to a specific status tab.
 */
export function useDefaultRedirect(defaultStatus: string, basePath: string) {
    useEffect(() => {
        const url = new URL(window.location.href);

        if (!url.searchParams.has('status')) {
            url.searchParams.set('status', defaultStatus);
            router.get(
                url.pathname + url.search,
                {},
                { preserveState: true, replace: true },
            );
        }
    }, [defaultStatus, basePath]);
}
