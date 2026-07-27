export function getInitialOwnerTab<T extends string>(
    tabs: readonly T[],
    fallback: T,
    serverTab?: string,
    search = typeof window === 'undefined' ? '' : window.location.search,
): T {
    const urlTab = new URLSearchParams(search).get('tab');

    if (urlTab && tabs.includes(urlTab as T)) {
        return urlTab as T;
    }

    if (serverTab && tabs.includes(serverTab as T)) {
        return serverTab as T;
    }

    return fallback;
}
