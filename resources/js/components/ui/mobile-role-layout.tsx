import type { PropsWithChildren, ReactNode } from 'react';
import OfflineBanner from '@/components/shared/offline-banner';
import { useFlashToast } from '@/hooks/use-flash-toast';

interface Props extends PropsWithChildren {
    /** Optional floating footer slot (e.g. active order bar) */
    footerSlot?: ReactNode;
    /** Optional fixed action bar slot — rendered outside <main> so position:fixed works */
    actionBarSlot?: ReactNode;
    /** Optional full-width header slot — rendered above <main> (outside max-w wrapper) */
    headerSlot?: ReactNode;
}

export default function MobileRoleLayout({ children, footerSlot, actionBarSlot, headerSlot }: Props) {
    useFlashToast();

    const bottomPad = footerSlot
        ? 'pb-[calc(8rem+env(safe-area-inset-bottom,0))]'
        : actionBarSlot
            ? 'pb-[calc(5rem+env(safe-area-inset-bottom,0))]'
            : 'pb-[calc(2rem+env(safe-area-inset-bottom,0))]';

    return (
        <div className="min-h-dvh bg-surface text-text">
            <OfflineBanner />

            {headerSlot && <div className="w-full">{headerSlot}</div>}

            <main className={`mx-auto max-w-2xl px-4 lg:max-w-4xl xl:max-w-5xl ${bottomPad}`}>
                {children}
            </main>

            {actionBarSlot}
            {footerSlot}
        </div>
    );
}
