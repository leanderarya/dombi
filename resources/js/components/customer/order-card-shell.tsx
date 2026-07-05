import { Link, usePage } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
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

export default function OrderCardShell({ orderId, recoveryToken, status, clickable, children }: Props) {
    const { auth } = usePage<any>().props;
    const isLoggedIn = !!auth?.user;

    const isDead = isTerminalStatus(status);
    const isClickable = clickable ?? !isDead;

    const href = isLoggedIn
        ? `/customer/orders/${orderId}`
        : `/track/${recoveryToken}`;

    const cardClass = [
        'rounded-2xl border bg-white p-4',
        'shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]',
        isDead ? 'border-border/60 opacity-70' : 'border-border',
    ].join(' ');

    if (isClickable) {
        return (
            <Link href={href} className={`block ${cardClass} active:opacity-80`}>
                {children}
            </Link>
        );
    }

    return (
        <div className={cardClass}>
            {children}
        </div>
    );
}
