import type { PropsWithChildren, ReactNode } from 'react';
import OfflineBanner from '@/components/offline-banner';
import { useFlashToast } from '@/hooks/use-flash-toast';
import { useHideOnScroll } from '@/hooks/use-hide-on-scroll';

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
    const { visible } = useHideOnScroll();
    const hasFloatingBar = !!footerSlot;
    const hasBottomNav = !hideBottomNav && !!bottomNav;

    // Bottom padding: need space for bottom nav (5rem) or floating bar (8rem), but not when hidden
    const bottomPad = !hasBottomNav && !hasFloatingBar
        ? 'pb-8' // Just enough for sticky action bar
        : hasFloatingBar
            ? 'pb-[calc(8rem+env(safe-area-inset-bottom))]'
            : 'pb-[calc(5rem+env(safe-area-inset-bottom))]';

    return (
        <div className="min-h-dvh bg-surface text-text">
            <OfflineBanner />

            <main className={`mx-auto max-w-lg px-4 ${bottomPad}`}>
                {children}
            </main>

            {footerSlot}
            {hasBottomNav && (
                <div
                    style={{
                        transform: visible ? 'translateY(0)' : 'translateY(100%)',
                        transition: 'transform 200ms ease',
                    }}
                >
                    {bottomNav}
                </div>
            )}
        </div>
    );
}
