import { createContext, useCallback, useContext, useState } from 'react';
import type { PropsWithChildren } from 'react';

interface SidebarContextValue {
    collapsed: boolean;
    toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
    collapsed: false,
    toggle: () => {},
});

const STORAGE_KEY = 'dombi:sidebar-collapsed';

export function SidebarProvider({ children }: PropsWithChildren) {
    const [collapsed, setCollapsed] = useState<boolean>(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) === 'true';
        } catch {
            return false;
        }
    });

    const toggle = useCallback(() => {
        setCollapsed((prev) => {
            const next = !prev;

            try {
                localStorage.setItem(STORAGE_KEY, String(next));
            } catch {
                // ignore
            }

            return next;
        });
    }, []);

    return (
        <SidebarContext.Provider value={{ collapsed, toggle }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    return useContext(SidebarContext);
}
