import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'dombi_fulfillment_type';

function loadFulfillmentType(): 'pickup' | 'delivery' {
    if (typeof window === 'undefined') {
        return 'pickup';
    }

    const stored = localStorage.getItem(STORAGE_KEY);

    return stored === 'delivery' ? 'delivery' : 'pickup';
}

function saveFulfillmentType(type: 'pickup' | 'delivery') {
    localStorage.setItem(STORAGE_KEY, type);
}

type OverlayState = 'hidden' | 'entering' | 'visible' | 'exiting';

/**
 * Manages full-page overlay animation when switching fulfillment type.
 * Persists selection to localStorage so it survives navigation.
 * Sequence: entering (400ms) → visible (300ms) → exiting (400ms) → hidden
 */
export function useFulfillmentOverlay() {
    const [fulfillmentType, setFulfillmentType] = useState<
        'pickup' | 'delivery'
    >(loadFulfillmentType);
    const [overlayState, setOverlayState] = useState<OverlayState>('hidden');
    const [overlayTarget, setOverlayTarget] = useState<'pickup' | 'delivery'>(
        'pickup',
    );
    const timerRef = useRef<ReturnType<typeof setTimeout>>();

    // Inject keyframes once
    useEffect(() => {
        const s = document.createElement('style');
        s.textContent = `@keyframes overlaySlideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}`;
        document.head.appendChild(s);

        return () => {
            s.remove();
        };
    }, []);

    const switchTo = (target: 'pickup' | 'delivery') => {
        if (target === fulfillmentType) {
            return;
        }

        clearTimeout(timerRef.current);

        setOverlayTarget(target);
        setOverlayState('entering');

        timerRef.current = setTimeout(() => {
            setFulfillmentType(target);
            saveFulfillmentType(target);
            setOverlayState('visible');

            timerRef.current = setTimeout(() => {
                setOverlayState('exiting');

                timerRef.current = setTimeout(() => {
                    setOverlayState('hidden');
                }, 400);
            }, 300);
        }, 400);
    };

    // Cleanup on unmount
    useEffect(() => () => clearTimeout(timerRef.current), []);

    return { fulfillmentType, overlayState, overlayTarget, switchTo };
}
