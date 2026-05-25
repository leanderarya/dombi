import { Head } from '@inertiajs/react';
import type { PropsWithChildren, ReactNode } from 'react';
import OwnerMobileHeader from './owner-mobile-header';
import OwnerBottomNav from './owner-bottom-nav';
import OfflineBanner from '@/components/offline-banner';
import OwnerLayout from '@/layouts/owner-layout';

interface Props extends PropsWithChildren {
    title: string;
    subtitle?: string;
    /** Back navigation href (shows back button) */
    backHref?: string;
    /** Header right action buttons */
    headerRight?: ReactNode;
}

/**
 * Unified owner page shell.
 * Mobile: bg-slate-50 + OwnerMobileHeader + bottom nav.
 * Desktop: existing OwnerLayout sidebar.
 */
export default function OwnerPageShell({ title, subtitle, backHref, headerRight, children }: Props) {
    return (
        <>
            {/* Desktop */}
            <div className="hidden lg:block">
                <OwnerLayout>
                    <Head title={title} />
                    {children}
                </OwnerLayout>
            </div>

            {/* Mobile */}
            <div className="lg:hidden">
                <div className="min-h-dvh bg-slate-50 text-slate-900">
                    <Head title={title} />
                    <OfflineBanner />

                    <OwnerMobileHeader title={title} subtitle={subtitle} backHref={backHref} actions={headerRight} />

                    <main className="px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
                        {children}
                    </main>

                    <OwnerBottomNav />
                </div>
            </div>
        </>
    );
}
