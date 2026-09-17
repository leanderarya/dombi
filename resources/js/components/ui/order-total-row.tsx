import type { ReactNode } from 'react';

/**
 * The summary line the approved kanvas repeats at the bottom of every order
 * card: the item count and total on the left, the card's actions on the
 * right.
 */
interface Props {
    label: string;
    children?: ReactNode;
    muted?: boolean;
    className?: string;
}

export default function OrderTotalRow({
    label,
    children,
    muted = false,
    className,
}: Props) {
    return (
        <div
            className={`flex items-center justify-between gap-2 ${className ?? ''}`}
        >
            <div
                className={`text-control tabular-nums ${
                    muted ? 'text-text-subtle' : 'text-text-muted'
                }`}
            >
                {label}
            </div>
            {children}
        </div>
    );
}
