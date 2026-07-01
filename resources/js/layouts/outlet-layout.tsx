import { usePage } from '@inertiajs/react';
import { User } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { PropsWithChildren } from 'react';
import NotificationBell from '@/components/notification-bell';
import NotificationSheet from '@/components/notification-sheet';
import OutletMoreSheet from '@/components/outlet/outlet-more-sheet';
import OutletBottomNav from '@/components/outlet-bottom-nav';
import MobileRoleLayout from '@/components/ui/mobile-role-layout';
import PageHeader from '@/components/ui/page-header';
import { useOrderAlert } from '@/hooks/use-order-alert';
import { usePushNotification } from '@/hooks/use-push-notification';
import type { OutletMoreBadgeCounts } from '@/pages/outlet/more';

interface Props extends PropsWithChildren {
    title?: string;
    subtitle?: string;
    backHref?: string;
    hideNav?: boolean;
    /** Extra content below the header (e.g. filter chips) */
    headerBelow?: ReactNode;
    /** Right-side header actions */
    headerRight?: ReactNode;
}

export default function OutletLayout({ children, title, subtitle, backHref, hideNav = false, headerBelow, headerRight }: Props) {
    const page = usePage<any>();
    const { auth } = page.props;
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const { pendingCount } = useOrderAlert();
    usePushNotification();

    // Extract badge counts from page props (available on dashboard/more pages)
    const badgeCounts: OutletMoreBadgeCounts = useMemo(() => {
        const p = page.props;
        return {
            returns: p.pendingReturns ?? p.stats?.pendingReturns ?? 0,
            exchanges: p.pendingExchanges ?? p.stats?.pendingExchanges ?? 0,
            restocks: p.pendingRestocks ?? p.stats?.pendingRestocks ?? 0,
            deliveries: p.activeDeliveries ?? p.deliveryStats?.inTransit ?? 0,
            payments: p.pendingSettlementPayments ?? 0,
            reports: p.pendingReports ?? 0,
        };
    }, [page.props]);

    const rightSlot = headerRight ?? (
        <div className="flex items-center gap-1">
            <NotificationBell onClick={() => setNotificationOpen(true)} />
            <button
                type="button"
                onClick={() => setMoreOpen(true)}
                aria-label="Menu"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-text-muted active:bg-surface-muted"
            >
                <User className="h-5 w-5" />
            </button>
        </div>
    );

    return (
        <MobileRoleLayout
            bottomNav={!hideNav ? <OutletBottomNav pendingCount={pendingCount} badgeCounts={badgeCounts} /> : undefined}
            hideBottomNav={hideNav}
        >
            <PageHeader
                title={title}
                subtitle={subtitle}
                backHref={backHref}
                right={rightSlot}
                below={headerBelow}
            />
            {children}
            <NotificationSheet open={notificationOpen} onClose={() => setNotificationOpen(false)} />
            <OutletMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
        </MobileRoleLayout>
    );
}
