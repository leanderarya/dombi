import type { PropsWithChildren, ReactNode } from 'react';
import OfflineBanner from '@/components/offline-banner';
import { useFlashToast } from '@/hooks/use-flash-toast';

interface Props extends PropsWithChildren {
    /** Optional bottom navigation component */
    bottomNav?: ReactNode;
    /** Optional floating footer slot (e.g. active order bar) */
    footerSlot?: ReactNode;
    /** Hide bottom navigation */
    hideBottomNav?: boolean;
}

export default function MobileRoleLayout({ children, bottomNav, footerSlot, hideBottomNav = false }: Props) {
    useFlashToast();
    const hasFloatingBar = !!footerSlot;

    return (
        <div className="min-h-dvh bg-surface text-text">
            <OfflineBanner />

            <main className={`mx-auto max-w-lg px-4 ${hasFloatingBar ? 'pb-[calc(8rem+env(safe-area-inset-bottom))]' : 'pb-[calc(5rem+env(safe-area-inset-bottom))]'}`}>
                {children}
            </main>

            {footerSlot}
            {!hideBottomNav && bottomNav}
        </div>
    );
}
