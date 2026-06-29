import type { PropsWithChildren, ReactNode } from 'react';
import ActiveOrderBar from '@/components/customer/active-order-bar';
import CustomerBottomNav from '@/components/customer/bottom-nav';
import CustomerLocationBootstrap from '@/components/customer/customer-location-bootstrap';
import CustomerTopBar from '@/components/customer/customer-top-bar';
import FloatingCartBar from '@/components/customer/floating-cart-bar';
import OfflineBanner from '@/components/offline-banner';
import { useFlashToast } from '@/hooks/use-flash-toast';
import { useHideOnScroll } from '@/hooks/use-hide-on-scroll';
import { useCart } from '@/lib/use-cart';
import FavoritesProvider from '@/providers/favorites-provider';

interface Props extends PropsWithChildren {
    activeOrder?: any;
    topAddress?: string | null;
    footerSlot?: ReactNode;
    hideTopBar?: boolean;
    hideCartBar?: boolean;
    hideBottomNav?: boolean;
}

export default function CustomerMobileLayout({ children, activeOrder, topAddress, footerSlot, hideTopBar = false, hideCartBar = false, hideBottomNav = false }: Props) {
    useFlashToast();
    const { visible } = useHideOnScroll();
    const { totalItems } = useCart();

    const showCartBar = !hideCartBar && !footerSlot && !activeOrder && totalItems > 0;
    const hasFloatingBar = !!footerSlot || !!activeOrder || showCartBar;

    return (
        <FavoritesProvider>
            <div className="min-h-dvh bg-[#fbf9f7] text-slate-950">
                <CustomerLocationBootstrap />
                <OfflineBanner />
                {!hideTopBar && <CustomerTopBar addressOverride={topAddress} />}

                <main className={`mx-auto max-w-lg px-4 pt-5 ${hasFloatingBar ? 'pb-[calc(8rem+env(safe-area-inset-bottom))]' : 'pb-[calc(5rem+env(safe-area-inset-bottom))]'}`}>
                    {children}
                </main>

                {footerSlot ?? (activeOrder ? <ActiveOrderBar order={activeOrder} /> : showCartBar ? <FloatingCartBar /> : null)}
                {!hideBottomNav && (
                    <div
                        style={{
                            transform: visible ? 'translateY(0)' : 'translateY(100%)',
                            transition: 'transform 200ms ease',
                        }}
                    >
                        <CustomerBottomNav />
                    </div>
                )}
            </div>
        </FavoritesProvider>
    );
}
