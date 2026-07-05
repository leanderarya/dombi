import { Link } from '@inertiajs/react';
import { ChevronLeft, Menu } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
    title?: string;
    subtitle?: string;
    backHref?: string;
    /** Rendered on the right side of the header */
    right?: ReactNode;
    /** Rendered below the title row (e.g. filter chips) */
    below?: ReactNode;
    /** Make header transparent (no background/border) */
    transparent?: boolean;
    /** Show hamburger menu icon */
    onMenuClick?: () => void;
}

export default function PageHeader({ title, subtitle, backHref, right, below, transparent, onMenuClick }: Props) {
    return (
        <header className={`sticky top-0 z-30 pt-safe ${transparent ? '' : 'border-b border-border bg-surface/95 backdrop-blur'}`}>
            <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                {/* Left side: back button, hamburger, or spacer */}
                <div className="flex items-center gap-1">
                    {backHref && (
                        <Link href={backHref} className="flex h-11 w-11 items-center justify-center rounded-lg text-text-muted active:bg-surface-muted">
                            <ChevronLeft className="h-5 w-5" />
                        </Link>
                    )}
                    {onMenuClick && (
                        <button
                            type="button"
                            onClick={onMenuClick}
                            aria-label="Menu"
                            className="flex h-11 w-11 items-center justify-center rounded-lg text-text-muted active:bg-surface-muted"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                    )}
                    {!backHref && !onMenuClick && <div className="w-11" />}
                </div>

                {title ? (
                    <div className="text-center">
                        <div className="text-sm font-semibold text-text">{title}</div>
                        {subtitle && <div className="text-[11px] text-text-muted">{subtitle}</div>}
                    </div>
                ) : (
                    <div />
                )}

                {right ?? <div className="w-11" />}
            </div>
            {below && (
                <div className="mx-auto max-w-lg px-4 pb-3">
                    {below}
                </div>
            )}
        </header>
    );
}
