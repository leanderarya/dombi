import { router } from '@inertiajs/react';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

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
    rootUrl = '/customer/home',
}: {
    children: ReactNode;
    rootUrl?: string;
}) {
    const back = () => {
        if (window.history.length > 1) {
            window.history.back();
        }
    };

    const pruneToRoot = () => {
        router.visit(rootUrl, { replace: true });
    };

    return (
        <NavigationContext.Provider value={{ back, pruneToRoot }}>
            {children}
        </NavigationContext.Provider>
    );
}
