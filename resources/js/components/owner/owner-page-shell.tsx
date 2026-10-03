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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
            <div className="flex min-w-0 items-center gap-3">
                <button
                    onClick={toggle}
                    className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:bg-surface-muted hover:text-text md:flex"
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
                        aria-label="Kembali"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-text-muted hover:bg-surface-muted"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                )}
                {/*
                 * `min-w-0` is what lets this block shrink. Without it its
                 * automatic minimum is its own content width, so a long title
                 * pushed the `headerRight` actions past the right edge:
                 * /owner/products/1 overflowed to 440px at 100% text on a
                 * 390px viewport, with "Hapus" ending at x=440 and out of
                 * reach. The icon slots above carry `shrink-0` so the release
                 * lands on the text, which can wrap, and not on the controls,
                 * which cannot. `flex-wrap` on the row lets the actions drop
                 * to their own line when even a wrapped title leaves no room.
                 * Same fix as components/ui/page-header.tsx; this is the owner
                 * copy that never received it.
                 */}
                <div className="min-w-0">
                    <h1 className="text-lg font-semibold tracking-tight break-words text-text lg:text-xl">
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="mt-0.5 text-sm break-words text-text-muted">
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>
            {headerRight && (
                <div className="flex flex-wrap items-center gap-2">
                    {headerRight}
                </div>
            )}
        </div>
    );
}
