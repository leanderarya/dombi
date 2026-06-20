import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import type { PropsWithChildren, ReactNode } from 'react';
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
 * Wraps OwnerLayout with a page header (title, subtitle, back, actions).
 */
export default function OwnerPageShell({ title, subtitle, backHref, headerRight, children }: Props) {
    return (
        <OwnerLayout>
            <Head title={title} />
            {/* Page header */}
            <div className="mb-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    {backHref && (
                        <Link href={backHref} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-slate-600 hover:bg-surface-muted">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    )}
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight text-text">{title}</h1>
                        {subtitle && <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p>}
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
    );
}
