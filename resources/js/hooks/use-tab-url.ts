import { router } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';

/**
 * Sync a tab state with URL query params.
 * Reads initial tab from URL, updates URL on tab change.
 */
export function useTabUrl<T extends string>(
    tabs: readonly { key: T; label: string }[],
    defaultTab: T,
    param = 'tab',
): [T, (key: T) => void] {
    const getInitial = (): T => {
        if (typeof window === 'undefined') {
return defaultTab;
}

        const url = new URL(window.location.href);
        const val = url.searchParams.get(param) as T;

        return tabs.some((t) => t.key === val) ? val : defaultTab;
    };

    const [activeTab, setActiveTab] = useState<T>(getInitial);

    const handleTabChange = useCallback(
        (key: T) => {
            setActiveTab(key);
            const url = new URL(window.location.href);
            url.searchParams.set(param, key);
            router.get(url.pathname + url.search, {}, { preserveState: true, replace: true });
        },
        [param],
    );

    return [activeTab, handleTabChange];
}
