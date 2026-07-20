import { useEffect } from 'react';

/**
 * Lock iOS swipe-back gesture on main nav pages.
 * Prevents horizontal swipe from triggering browser navigation
 * by applying touch-action: pan-y to body (vertical scroll only).
 */
export function useLockSwipeBack() {
    useEffect(() => {
        const prev = document.body.style.touchAction;
        document.body.style.touchAction = 'pan-y';

        return () => {
            document.body.style.touchAction = prev;
        };
    }, []);
}
