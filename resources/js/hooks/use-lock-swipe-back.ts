import { useEffect } from 'react';

let overlay: HTMLDivElement | null = null;
let refCount = 0;

function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '99999',
        background: '#f8f7f2',
        opacity: '0',
        pointerEvents: 'none',
        transition: 'opacity 0ms',
    });
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
}

function removeOverlay() {
    if (!overlay || refCount > 0) return;
    overlay.remove();
    overlay = null;
}

function showOverlay() {
    if (!overlay) return;
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';
}

function hideOverlay() {
    if (!overlay) return;
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
}

export function useLockSwipeBack() {
    useEffect(() => {
        ensureOverlay();
        refCount++;

        history.pushState(null, '', location.href);

        const onPopState = () => {
            showOverlay();
            history.pushState(null, '', location.href);
            // Microtask hides overlay before next paint — faster than rAF
            Promise.resolve().then(hideOverlay);
        };

        window.addEventListener('popstate', onPopState);
        return () => {
            window.removeEventListener('popstate', onPopState);
            refCount--;
            removeOverlay();
        };
    }, []);
}
