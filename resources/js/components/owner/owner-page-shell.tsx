import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { PropsWithChildren, ReactNode } from 'react';
import { useSidebar } from '@/contexts/sidebar-context';
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
export default function OwnerPageShell({
    title,
    subtitle,
    backHref,
    headerRight,
    children,
}: Props) {
    return (
        <OwnerLayout>
            <Head title={title} />
            <div className="min-h-full">
                <PageHeader
                    title={title}
                    subtitle={subtitle}
                    backHref={backHref}
                    headerRight={headerRight}
                />
                {children}
            </div>
        </OwnerLayout>
    );
}

function PageHeader({
    title,
    subtitle,
    backHref,
    headerRight,
}: Omit<Props, 'children'>) {
    const { collapsed, toggle } = useSidebar();

    return (
        <div className="mb-4 flex items-center justify-between gap-4 border-b border-border pb-3">
            <div className="flex items-center gap-3">
                <button
                    onClick={toggle}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
                    aria-label={
                        collapsed ? 'Expand sidebar' : 'Collapse sidebar'
                    }
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? (
                        <PanelLeftOpen className="h-4 w-4" />
                    ) : (
                        <PanelLeftClose className="h-4 w-4" />
                    )}
                </button>
                {backHref && (
                    <Link
                        href={backHref}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border p-1.5 text-slate-600 hover:bg-surface-muted"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                )}
                <div>
                    <h1 className="text-lg font-semibold tracking-tight text-text lg:text-xl">
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="mt-0.5 text-sm text-text-muted">
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>
            {headerRight && (
                <div className="flex items-center gap-2">{headerRight}</div>
            )}
        </div>
    );
}
