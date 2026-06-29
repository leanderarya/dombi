import { useEffect, useState } from 'react';

export function useHideOnScroll(threshold = 10) {
    const [visible, setVisible] = useState(true);
    const [lastY, setLastY] = useState(0);

    useEffect(() => {
        let ticking = false;

        const handleScroll = () => {
            if (ticking) return;
            ticking = true;

            requestAnimationFrame(() => {
                const currentY = window.scrollY;
                const delta = currentY - lastY;

                if (currentY < 50) {
                    setVisible(true);
                } else if (delta > threshold) {
                    setVisible(false);
                } else if (delta < -threshold) {
                    setVisible(true);
                }

                setLastY(currentY);
                ticking = false;
            });
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastY, threshold]);

    return { visible };
}
