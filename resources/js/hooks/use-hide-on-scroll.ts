import { useEffect, useRef, useState } from 'react';

export function useHideOnScroll(threshold = 10) {
    const [visible, setVisible] = useState(true);
    const lastY = useRef(0);
    const ticking = useRef(false);

    useEffect(() => {
        const handleScroll = () => {
            if (ticking.current) return;
            ticking.current = true;

            requestAnimationFrame(() => {
                const currentY = window.scrollY;
                const delta = currentY - lastY.current;

                // Always show near top
                if (currentY < 50) {
                    setVisible(true);
                }
                // Scrolling down — hide
                else if (delta > threshold) {
                    setVisible(false);
                }
                // Scrolling up — show
                else if (delta < -threshold) {
                    setVisible(true);
                }

                lastY.current = currentY;
                ticking.current = false;
            });
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [threshold]);

    return { visible };
}
