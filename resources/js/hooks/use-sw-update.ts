import { useEffect } from 'react';

export function useSwUpdate() {
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (confirm('Update tersedia. Muat ulang?')) {
                window.location.reload();
            }
        });
    }, []);
}
