import { useEffect } from 'react';

/**
 * Lock iOS swipe-back gesture on main nav pages.
 *
 * Three-layer approach to prevent browser-level swipe navigation:
 * 1. overscroll-behavior-x: none on <html> — prevents overscroll navigation
 * 2. touch-action: pan-y on <body> — horizontal touch ignored
 * 3. Left-edge overlay — captures touchstart on left 20px before browser intercept
 */
export function useLockSwipeBack() {
    useEffect(() => {
        const html = document.documentElement;
        const body = document.body;

        // Layer 1: overscroll-behavior
        const prevOverscroll = html.style.overscrollBehaviorX;
        html.style.overscrollBehaviorX = 'none';

        // Layer 2: touch-action
        const prevTouchAction = body.style.touchAction;
        body.style.touchAction = 'pan-y';

        // Layer 3: left-edge overlay (captures swipe gesture before browser)
        const overlay = document.createElement('div');
        overlay.setAttribute('data-swipe-lock', '');
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '25px',
            height: '100%',
            zIndex: '9999',
            touchAction: 'none',
            background: 'transparent',
        });
        // Prevent touch events from propagating to browser
        overlay.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: false });
        overlay.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: false });
        body.appendChild(overlay);

        return () => {
            html.style.overscrollBehaviorX = prevOverscroll;
            body.style.touchAction = prevTouchAction;
            overlay.remove();
        };
    }, []);
}
