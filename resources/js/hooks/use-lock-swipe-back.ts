import { useEffect, useRef } from 'react';

/**
 * Lock swipe-back on main nav pages (Beranda, Pesanan, Akun).
 *
 * Uses history.pushState trap with a persistent overlay to eliminate flash.
 * Overlay is always in DOM (transparent, non-blocking).
 * During popstate → overlay becomes opaque + blocks all interaction.
 * After re-push → overlay returns to transparent.
 * User never sees the previous page, can't tap wrong elements.
 */
export function useLockSwipeBack() {
    const overlayRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        // Create persistent overlay
        const overlay = document.createElement('div');
        overlay.setAttribute('data-backdrop', '');
        Object.assign(overlay.style, {
            position: 'fixed',
            inset: '0',
            zIndex: '99999',
            background: 'var(--color-background, #fff)',
            opacity: '0',
            pointerEvents: 'none',
            transition: 'opacity 0ms',
        });
        document.body.appendChild(overlay);
        overlayRef.current = overlay;

        // Push dummy state
        history.pushState(null, '', location.href);

        const onPopState = () => {
            // Show overlay — blocks everything instantly
            overlay.style.opacity = '1';
            overlay.style.pointerEvents = 'auto';

            // Re-push state
            history.pushState(null, '', location.href);

            // Hide overlay on next frame
            requestAnimationFrame(() => {
                overlay.style.opacity = '0';
                overlay.style.pointerEvents = 'none';
            });
        };

        window.addEventListener('popstate', onPopState);
        return () => {
            window.removeEventListener('popstate', onPopState);
            overlay.remove();
        };
    }, []);
}
