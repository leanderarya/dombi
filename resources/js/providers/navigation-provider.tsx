import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { useNavigationHistory } from '@/hooks/use-navigation-history';

interface NavigationContextValue {
    back: () => void;
    pruneToRoot: () => void;
}

const NavigationContext = createContext<NavigationContextValue>({
    back: () => {},
    pruneToRoot: () => {},
});

export function useNavigation(): NavigationContextValue {
    return useContext(NavigationContext);
}

export function NavigationProvider({
    children,
    rootUrl,
}: {
    children: ReactNode;
    rootUrl?: string;
}) {
    const nav = useNavigationHistory(rootUrl);

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        const listener = App.addListener('backButton', () => {
            if (nav.stackSize() <= 1) {
                App.exitApp();
            } else {
                nav.back();
            }
        });

        return () => {
            listener.then((l) => l.remove());
        };
    }, [nav]);

    return (
        <NavigationContext.Provider value={{ back: nav.back, pruneToRoot: nav.pruneToRoot }}>
            {children}
        </NavigationContext.Provider>
    );
}
