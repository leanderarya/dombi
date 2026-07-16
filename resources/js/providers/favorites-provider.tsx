import { usePage } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { favoritesStore } from '@/lib/use-favorites';

interface Props {
    children: ReactNode;
}

export default function FavoritesProvider({ children }: Props) {
    const { auth } = usePage<any>().props;
    const isLoggedIn = !!auth?.user;
    const prevLoggedIn = useRef(isLoggedIn);

    useEffect(() => {
        // Detect logout (was logged in, now not)
        if (prevLoggedIn.current && !isLoggedIn) {
            favoritesStore.logout();
        }

        prevLoggedIn.current = isLoggedIn;

        // Always init — store handles idempotency internally
        favoritesStore.init(isLoggedIn);
    }, [isLoggedIn]);

    return <>{children}</>;
}
