import { Link } from '@inertiajs/react';
import { ChevronRight, Package, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { orderStatusLabel } from '@/lib/customer-status';

const DISMISS_KEY = 'dombi_active_order_dismissed';

function getDismissedOrderCode(): string | null {
    try {
        return localStorage.getItem(DISMISS_KEY);
    } catch {
        return null;
    }
}

function setDismissedOrderCode(code: string): void {
    try {
        localStorage.setItem(DISMISS_KEY, code);
    } catch {
        // ignore
    }
}

interface Props {
    order?: any;
    bottomNavVisible?: boolean;
}

export default function ActiveOrderBar({ order, bottomNavVisible = true }: Props) {
    const [dismissed, setDismissed] = useState(() => getDismissedOrderCode() === order?.order_code);

    useEffect(() => {
        setDismissed(getDismissedOrderCode() === order?.order_code);
    }, [order?.order_code]);

    if (!order || dismissed) {
        return null;
    }

    const handleDismiss = () => {
        setDismissedOrderCode(order.order_code);
        setDismissed(true);
    };

    const bottom = bottomNavVisible
        ? 'calc(4.5rem + env(safe-area-inset-bottom, 0px) + 0.75rem)'
        : 'calc(1rem + env(safe-area-inset-bottom, 0px))';

    return (
        <div
            className="fixed inset-x-0 z-30 px-4 transition-[bottom] duration-300 ease-in-out"
            style={{ bottom }}
        >
            <div className="mx-auto flex max-w-lg w-full items-center gap-3 rounded-xl border border-white/10 bg-text px-4 py-3 shadow-lg">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600/20">
                    <Package className="h-4 w-4 text-emerald-400" />
                </div>

                <Link
                    href={`/customer/orders/${order.id}`}
                    className="min-w-0 flex-1"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Pesanan Aktif</span>
                        <span className={order.status === 'pending_confirmation' ? 'text-[11px] font-bold text-amber-400' : 'text-[11px] font-bold text-emerald-400'}>{orderStatusLabel(order.status)}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-white/60 truncate">{order.order_code} · {order.outlet?.name ?? 'Outlet'}</div>
                </Link>

                <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />

                <button
                    type="button"
                    onClick={handleDismiss}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/40 active:bg-white/10"
                    aria-label="Tutup"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}
