import { useState } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';
import ActiveOrderBar, {
    getDismissedOrderCode,
} from '@/components/customer/active-order-bar';
import CustomerBottomNav from '@/components/customer/bottom-nav';
import CustomerLocationBootstrap from '@/components/customer/customer-location-bootstrap';
import CustomerTopBar from '@/components/customer/customer-top-bar';
import FloatingCartBar from '@/components/customer/floating-cart-bar';
import OfflineBanner from '@/components/shared/offline-banner';
import { useFlashToast } from '@/hooks/use-flash-toast';
import { useRoleTheme } from '@/hooks/use-role-theme';
import { useCart } from '@/lib/use-cart';
import FavoritesProvider from '@/providers/favorites-provider';
import { NavigationProvider } from '@/providers/navigation-provider';
import {
    customerContentBottomPadding,
    customerHasFloatingBar,
} from './customer-mobile-layout-state';

interface Props extends PropsWithChildren {
    activeOrder?: any;
    topAddress?: string | null;
    customerName?: string | null;
    footerSlot?: ReactNode;
    hideTopBar?: boolean;
    hideCartBar?: boolean;
    hideBottomNav?: boolean;
    /**
     * Background of the page plane. Defaults to `bg-background` so every
     * existing caller is unaffected; the Orders screens opt into
     * `bg-canvas` because the kanvas raises its section labels off a
     * `#F7F7F5` plane instead of a white one.
     */
    pageClassName?: string;
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
    pageClassName = 'bg-background',
}: Props) {
    useFlashToast();
    useRoleTheme('customer');
    const { totalItems } = useCart();
    const [dismissedOrderCode, setDismissedOrderCode] = useState(
        getDismissedOrderCode,
    );
    const showActiveOrderBar =
        !!activeOrder && dismissedOrderCode !== activeOrder.order_code;

    const showCartBar = !hideCartBar && !footerSlot && totalItems > 0;
    const hasFloatingBar = customerHasFloatingBar({
        hasFooterSlot: !!footerSlot,
        showCartBar,
        showActiveOrderBar: !footerSlot && !showCartBar && showActiveOrderBar,
    });

    return (
        <FavoritesProvider>
            <NavigationProvider rootUrl="/customer/home">
                <div className={`min-h-dvh text-text ${pageClassName}`}>
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
                        className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${hideTopBar ? '' : 'pt-5'} ${customerContentBottomPadding({ hasFloatingBar, hideBottomNav })}`}
                    >
                        {children}
                    </main>

                    {footerSlot ??
                        (showCartBar ? (
                            <FloatingCartBar hideBottomNav={hideBottomNav} />
                        ) : activeOrder ? (
                            <ActiveOrderBar
                                order={activeOrder}
                                hideBottomNav={hideBottomNav}
                                onVisibilityChange={(visible) =>
                                    !visible &&
                                    setDismissedOrderCode(
                                        activeOrder.order_code,
                                    )
                                }
                            />
                        ) : null)}
                    {!hideBottomNav && <CustomerBottomNav />}
                </div>
            </NavigationProvider>
        </FavoritesProvider>
    );
}
