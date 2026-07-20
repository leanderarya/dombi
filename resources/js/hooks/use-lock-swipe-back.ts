import { useEffect } from 'react';

/**
 * Lock swipe-back on main nav pages (Beranda, Pesanan, Akun).
 *
 * Simple pushState trap: re-pushes state on popstate.
 * iOS shows swipe animation but user stays on same page.
 * No flash, no accidental taps.
 */
export function useLockSwipeBack() {
    useEffect(() => {
        history.pushState(null, '', location.href);

        const onPopState = () => {
            history.pushState(null, '', location.href);
        };

        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);
}
