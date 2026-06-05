import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
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
 * Desktop: OwnerLayout sidebar + desktop page header with title/actions.
 */
export default function OwnerPageShell({ title, subtitle, backHref, headerRight, children }: Props) {
    return (
        <>
            {/* Desktop */}
            <div className="hidden lg:block">
                <OwnerLayout>
                    <Head title={title} />
                    {/* Desktop page header */}
                    <div className="mb-5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            {backHref && (
                                <Link href={backHref} className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-slate-600 hover:bg-zinc-50">
                                    <ArrowLeft className="h-4 w-4" />
                                </Link>
                            )}
                            <div>
                                <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
                                {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
                            </div>
                        </div>
                        {headerRight && (
                            <div className="flex items-center gap-2">
                                {headerRight}
                            </div>
                        )}
                    </div>
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
