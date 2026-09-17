/**
 * The meta line the approved kanvas repeats in every order card: a primary
 * value on the left (the outlet) and a quiet qualifier on the right
 * ("via Store" / "via Aplikasi").
 *
 * `secondary` can carry an optional icon — the detail kanvas draws the
 * delivery line with an address picker icon, the list kanvas draws it bare.
 */
import type { LucideIcon } from 'lucide-react';

interface Props {
    primary: string;
    secondary: string;
    secondaryIcon?: LucideIcon;
    muted?: boolean;
    className?: string;
}

export default function OrderMetaRow({
    primary,
    secondary,
    secondaryIcon: SecondaryIcon,
    muted = false,
    className,
}: Props) {
    return (
        <div
            className={`flex items-center justify-between gap-2 ${className ?? ''}`}
        >
            <div
                className={`min-w-0 truncate text-xs font-semibold ${
                    muted ? 'text-text-subtle' : 'text-text'
                }`}
            >
                {primary}
            </div>
            <div className="flex shrink-0 items-center gap-1 text-caption text-text-muted">
                {SecondaryIcon && <SecondaryIcon className="h-3.5 w-3.5" />}
                {secondary}
            </div>
        </div>
    );
}
