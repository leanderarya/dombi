import { Link, usePage } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import { Card } from '@/components/ui/card';
import { isTerminalStatus } from '@/lib/order-status-config';

/* ------------------------------------------------------------------ */
/*  Shared card shell for order cards                                   */
/* ------------------------------------------------------------------ */

interface Props extends PropsWithChildren {
    orderId: number;
    recoveryToken?: string;
    status: string;
    /** Override clickable behavior (default: auto from status) */
    clickable?: boolean;
}

/**
 * The kanvas draws the order card as a surface fill with a 1px border and
 * no shadow; `Card` already carries that — surface, `--radius-card`,
 * `ring-border`. The previous shell hardcoded its own radius and a soft
 * drop shadow, so it disagreed with every other card in the app.
 *
 * Padding is set by overriding the card's own spacing variable rather
 * than passing `p-4`. `Card` ships `py-(--card-spacing)` and that utility
 * is emitted after `.p-4` in the stylesheet, so a plain `p-4` loses on
 * block padding and the card silently becomes 24px tall. Overriding
 * `--card-spacing` moves padding and gap together, which is what the
 * kanvas draws: 16px padding, 12px between rows.
 */
export default function OrderCardShell({
    orderId,
    recoveryToken,
    status,
    clickable,
    children,
}: Props) {
    const { auth } = usePage<any>().props;
    const isLoggedIn = !!auth?.user;

    const isDead = isTerminalStatus(status);
    const isClickable = clickable ?? !isDead;

    const href = isLoggedIn
        ? `/customer/orders/${orderId}`
        : `/track/${recoveryToken}`;

    const cardClass = '[--card-spacing:--spacing(4)] gap-3';

    if (isClickable) {
        return (
            <Link href={href} className="block active:opacity-80">
                <Card className={cardClass}>{children}</Card>
            </Link>
        );
    }

    return <Card className={cardClass}>{children}</Card>;
}
