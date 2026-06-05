import { usePage } from '@inertiajs/react';
import type { PropsWithChildren, ReactNode } from 'react';
import OfflineBanner from '@/components/offline-banner';

interface Props extends PropsWithChildren {
    /** Optional bottom navigation component */
    bottomNav?: ReactNode;
    /** Optional floating footer slot (e.g. active order bar) */
    footerSlot?: ReactNode;
    /** Hide bottom navigation */
    hideBottomNav?: boolean;
}

export default function MobileRoleLayout({ children, bottomNav, footerSlot, hideBottomNav = false }: Props) {
    const { flash } = usePage<any>().props;
    const hasFloatingBar = !!footerSlot;

    return (
        <div className="min-h-dvh bg-[#fbf9f7] text-slate-950">
            <OfflineBanner />

            <main className={`mx-auto max-w-lg px-4 pt-4 ${hasFloatingBar ? 'pb-[calc(8rem+env(safe-area-inset-bottom))]' : 'pb-[calc(5rem+env(safe-area-inset-bottom))]'}`}>
                {flash?.success && (
                    <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                        {flash.success}
                    </div>
                )}
                {children}
            </main>

            {footerSlot}
            {!hideBottomNav && bottomNav}
        </div>
    );
}
