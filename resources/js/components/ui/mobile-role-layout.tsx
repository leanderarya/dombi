import type { PropsWithChildren, ReactNode } from 'react';
import OfflineBanner from '@/components/offline-banner';
import { useFlashToast } from '@/hooks/use-flash-toast';

interface Props extends PropsWithChildren {
    /** Optional floating footer slot (e.g. active order bar) */
    footerSlot?: ReactNode;
}

export default function MobileRoleLayout({ children, footerSlot }: Props) {
    useFlashToast();

    const bottomPad = footerSlot
        ? 'pb-[calc(8rem+env(safe-area-inset-bottom))]'
        : 'pb-[calc(2rem+env(safe-area-inset-bottom))]';

    return (
        <div className="min-h-dvh bg-surface text-text">
            <OfflineBanner />

            <main className={`mx-auto max-w-lg px-4 ${bottomPad}`}>
                {children}
            </main>

            {footerSlot}
        </div>
    );
}
