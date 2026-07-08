import {  useEffect, useRef } from 'react';
import type {RefObject} from 'react';

/**
 * IntersectionObserver that adds 'visible' class to observed elements (once).
 * Returns a callback ref to attach to each section element.
 */
export function useSectionReveal(deps: unknown[]) {
    const mapRef = useRef<Map<number, HTMLDivElement>>(new Map());

    const setRef = (id: number, el: HTMLDivElement | null) => {
        if (el) {
mapRef.current.set(id, el);
}
    };

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    if (e.isIntersecting) {
                        e.target.classList.add('visible');
                        observer.unobserve(e.target);
                    }
                }
            },
            { threshold: 0.1 },
        );

        mapRef.current.forEach((el) => observer.observe(el));

        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return setRef;
}
