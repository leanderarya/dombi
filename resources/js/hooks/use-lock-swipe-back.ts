import { useEffect } from 'react';

/**
 * Lock iOS swipe-back gesture on main nav pages.
 * Pushes a dummy history state so swipe-back hits a dead end.
 */
export function useLockSwipeBack() {
    useEffect(() => {
        window.history.pushState(null, '', window.location.href);

        const onPopState = () => {
            window.history.pushState(null, '', window.location.href);
        };
        window.addEventListener('popstate', onPopState);

        return () => window.removeEventListener('popstate', onPopState);
    }, []);
}
