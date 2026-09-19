import { Link } from '@inertiajs/react';
import { ChevronLeft, Menu } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
    title?: string;
    titleClassName?: string;
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
    /**
     * `customer` follows the canvas `Page Header/Customer` component:
     * 16/700 centred title, 12/20/16/20 padding, no bottom border.
     */
    variant?: 'default' | 'customer';
}

export default function PageHeader({ title, titleClassName, subtitle, backHref, right, below, transparent, onMenuClick, variant = 'default' }: Props) {
    const isCustomer = variant === 'customer';
    const background = transparent
        ? ''
        : isCustomer
          ? 'bg-surface/95 backdrop-blur'
          : 'border-b border-border bg-surface/95 backdrop-blur';

    return (
        <header className={`sticky top-0 z-30 ${isCustomer ? 'pt-safe-header' : 'pt-safe'} ${background}`}>
            <div className={`mx-auto flex max-w-2xl items-center justify-between lg:max-w-4xl ${isCustomer ? 'px-5 pb-4' : 'px-4 py-3'}`}>
                {/* Left side: back button, hamburger, or spacer */}
                <div className="flex items-center gap-1">
                    {backHref && (
                        <Link href={backHref} className="flex h-11 w-11 items-center justify-center rounded-lg text-text-muted active:bg-surface-muted">
                            <ChevronLeft className="h-5 w-5" />
                        </Link>
                    )}
                    {!backHref && onMenuClick && (
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
                        <div className={`${isCustomer ? 'text-base font-bold' : 'text-sm font-semibold'} text-text ${titleClassName ?? ''}`}>{title}</div>
                        {subtitle && <div className="text-xs text-text-muted">{subtitle}</div>}
                    </div>
                ) : (
                    <div />
                )}

                {right ?? <div className="w-11" />}
            </div>
            {below && (
                <div className={`mx-auto max-w-2xl lg:max-w-4xl ${isCustomer ? 'px-5 pb-4' : 'px-4 pb-3'}`}>
                    {below}
                </div>
            )}
        </header>
    );
}
