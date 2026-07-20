import { useEffect } from 'react';

/**
 * Lock swipe-back on main nav pages (Beranda, Pesanan, Akun).
 *
 * Uses history.pushState trap — the proven approach for PWA.
 * Minimizes flash by hiding content during the popstate → re-push cycle.
 * Total delay: ~16ms (1 frame), imperceptible to user.
 */
export function useLockSwipeBack() {
    useEffect(() => {
        history.pushState(null, '', location.href);

        const onPopState = () => {
            // Hide content immediately — prevents flash of previous page
            document.body.style.visibility = 'hidden';

            // Re-push state to cancel the back navigation
            history.pushState(null, '', location.href);

            // Restore visibility on next frame (~16ms)
            requestAnimationFrame(() => {
                document.body.style.visibility = '';
            });
        };

        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);
}
