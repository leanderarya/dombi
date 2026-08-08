import type { PluginListenerHandle } from '@capacitor/core';
import { useEffect } from 'react';

const CRITICAL_RX = /\/checkout|\/payment/;

export function useCapacitorBackButton() {
    useEffect(() => {
        let listener: Promise<PluginListenerHandle> | null = null;
        let enabled = true;

        const setup = () => {
            import('@capacitor/app').then(({ App }) => {
                if (!enabled) {
                    return;
                }

                listener = App.addListener('backButton', ({ canGoBack }) => {
                    const { pathname } = window.location;

                    if (CRITICAL_RX.test(pathname)) {
                        const leave = window.confirm(
                            'Apakah Anda yakin ingin meninggalkan halaman ini?',
                        );

                        if (!leave) {
                            return;
                        }
                    }

                    if (canGoBack) {
                        window.history.back();
                    } else {
                        App.exitApp();
                    }
                });
            });
        };

        setup();

        return () => {
            enabled = false;

            if (listener) {
                void listener.then((handle) => handle.remove());
            }
        };
    }, []);
}