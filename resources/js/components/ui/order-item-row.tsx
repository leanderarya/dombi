import type { LucideIcon } from 'lucide-react';

/**
 * The product row the approved kanvas repeats in every order card:
 * a 54px thumbnail tile, the product name, and an optional sub-line.
 *
 * The tile radius is `--radius-thumb` (12) — the kanvas draws it at 12,
 * between the card's 16 and the control's 10.
 */
interface Props {
    title: string;
    subtitle?: string | null;
    icon?: LucideIcon;
    /** Renders the tile in a muted dead-state palette. */
    muted?: boolean;
    className?: string;
}

export default function OrderItemRow({
    title,
    subtitle,
    icon: Icon,
    muted = false,
    className,
}: Props) {
    return (
        <div className={`flex items-center gap-3 ${className ?? ''}`}>
            <div
                className={`flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-thumb ${
                    muted ? 'bg-surface-muted/60' : 'bg-surface-muted'
                }`}
            >
                {Icon && (
                    <Icon
                        className={`h-[22px] w-[22px] ${
                            muted ? 'text-text-subtle' : 'text-primary'
                        }`}
                    />
                )}
            </div>
            <div className="min-w-0">
                <div
                    className={`truncate text-control font-semibold ${
                        muted ? 'text-text-muted' : 'text-text'
                    }`}
                >
                    {title}
                </div>
                {subtitle && (
                    <div className="text-caption text-text-muted">
                        {subtitle}
                    </div>
                )}
            </div>
        </div>
    );
}
