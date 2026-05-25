import { usePage } from '@inertiajs/react';
import type { PropsWithChildren, ReactNode } from 'react';
import OfflineBanner from '@/components/offline-banner';
import ActiveOrderBar from '@/components/customer/active-order-bar';
import CustomerBottomNav from '@/components/customer/bottom-nav';
import CustomerTopBar from '@/components/customer/customer-top-bar';
import FloatingCartBar from '@/components/customer/floating-cart-bar';
import { useCart } from '@/lib/use-cart';

interface Props extends PropsWithChildren {
    activeOrder?: any;
    /** Override address display in top bar (optional — defaults to shared auth.defaultAddress) */
    topAddress?: string | null;
    footerSlot?: ReactNode;
    hideTopBar?: boolean;
    products?: { id: number; price: number | string }[];
    hideCartBar?: boolean;
}

export default function CustomerMobileLayout({ children, activeOrder, topAddress, footerSlot, hideTopBar = false, products, hideCartBar = false }: Props) {
    const { flash } = usePage<any>().props;
    const { totalItems } = useCart();

    const showCartBar = !hideCartBar && !footerSlot && !activeOrder && totalItems > 0;
    const hasFloatingBar = !!footerSlot || !!activeOrder || showCartBar;

    return (
        <div className="min-h-dvh bg-[#fbf9f7] text-slate-950">
            <OfflineBanner />
            {!hideTopBar && <CustomerTopBar addressOverride={topAddress} />}

            <main className={`mx-auto max-w-lg px-4 pt-5 ${hasFloatingBar ? 'pb-[calc(8rem+env(safe-area-inset-bottom))]' : 'pb-[calc(5rem+env(safe-area-inset-bottom))]'}`}>
                {flash?.success && (
                    <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                        {flash.success}
                    </div>
                )}
                {children}
            </main>

            {footerSlot ?? (activeOrder ? <ActiveOrderBar order={activeOrder} /> : showCartBar ? <FloatingCartBar products={products} /> : null)}
            <CustomerBottomNav />
        </div>
    );
}
