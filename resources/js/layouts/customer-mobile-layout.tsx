import type { PropsWithChildren, ReactNode } from 'react';
import ActiveOrderBar from '@/components/customer/active-order-bar';
import CustomerBottomNav from '@/components/customer/bottom-nav';
import CustomerLocationBootstrap from '@/components/customer/customer-location-bootstrap';
import CustomerTopBar from '@/components/customer/customer-top-bar';
import FloatingCartBar from '@/components/customer/floating-cart-bar';
import OfflineBanner from '@/components/shared/offline-banner';
import { useFlashToast } from '@/hooks/use-flash-toast';
import { useCart } from '@/lib/use-cart';
import FavoritesProvider from '@/providers/favorites-provider';
import { NavigationProvider } from '@/providers/navigation-provider';

interface Props extends PropsWithChildren {
    activeOrder?: any;
    topAddress?: string | null;
    customerName?: string | null;
    footerSlot?: ReactNode;
    hideTopBar?: boolean;
    hideCartBar?: boolean;
    hideBottomNav?: boolean;
}

export default function CustomerMobileLayout({
    children,
    activeOrder,
    topAddress,
    customerName,
    footerSlot,
    hideTopBar = false,
    hideCartBar = false,
    hideBottomNav = false,
}: Props) {
    useFlashToast();
    const { totalItems } = useCart();

    const showCartBar =
        !hideCartBar && !footerSlot && !activeOrder && totalItems > 0;
    const hasFloatingBar = !!footerSlot || !!activeOrder || showCartBar;

    return (
        <FavoritesProvider>
            <NavigationProvider rootUrl="/customer/home">
                <div className="min-h-dvh bg-background text-text">
                    <CustomerLocationBootstrap />
                    <OfflineBanner />
                    {!hideTopBar && (
                        <CustomerTopBar
                            addressOverride={topAddress}
                            customerName={customerName}
                        />
                    )}

                    <main
                        data-page
                        className={`mx-auto max-w-lg px-4 ${hideTopBar ? '' : 'pt-5'} ${hasFloatingBar ? 'pb-[calc(10rem+env(safe-area-inset-bottom,0))]' : 'pb-[calc(5.5rem+env(safe-area-inset-bottom,0))]'}`}
                    >
                        {children}
                    </main>

                    {footerSlot ??
                        (activeOrder ? (
                            <ActiveOrderBar order={activeOrder} />
                        ) : showCartBar ? (
                            <FloatingCartBar />
                        ) : null)}
                    {!hideBottomNav && <CustomerBottomNav />}
                </div>
            </NavigationProvider>
        </FavoritesProvider>
    );
}
