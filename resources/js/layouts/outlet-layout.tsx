import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { PropsWithChildren } from 'react';
import NotificationBell from '@/components/notification-bell';
import NotificationSheet from '@/components/notification-sheet';
import OutletNavigationSheet from '@/components/outlet-navigation-sheet';
import MobileRoleLayout from '@/components/ui/mobile-role-layout';
import PageHeader from '@/components/ui/page-header';
import { useOrderAlert } from '@/hooks/use-order-alert';
import { useOutletBadges } from '@/hooks/use-outlet-badges';
import { usePushNotification } from '@/hooks/use-push-notification';

interface Props extends PropsWithChildren {
    title?: string;
    subtitle?: string;
    backHref?: string;
    /** @deprecated No longer used — hamburger nav is always visible. Kept for backward compatibility. */
    hideNav?: boolean;
    /** Extra content below the header (e.g. filter chips) */
    headerBelow?: ReactNode;
    /** Right-side header actions */
    headerRight?: ReactNode;
}

export default function OutletLayout({ children, title, subtitle, backHref, headerBelow, headerRight }: Props) {
    const page = usePage<any>();
    const { auth } = page.props;
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [navOpen, setNavOpen] = useState(false);
    const { pendingCount } = useOrderAlert();
    const { badgeCounts } = useOutletBadges();
    usePushNotification();

    const rightSlot = headerRight ?? (
        <NotificationBell onClick={() => setNotificationOpen(true)} />
    );

    return (
        <MobileRoleLayout>
            <PageHeader
                title={title}
                subtitle={subtitle}
                backHref={backHref}
                onMenuClick={() => setNavOpen(true)}
                right={rightSlot}
                below={headerBelow}
            />
            {children}
            <NotificationSheet open={notificationOpen} onClose={() => setNotificationOpen(false)} />
            <OutletNavigationSheet
                open={navOpen}
                onClose={() => setNavOpen(false)}
                pendingCount={pendingCount}
                badgeCounts={badgeCounts}
                outletName={auth?.outlet?.name}
                userName={auth?.user?.name}
            />
        </MobileRoleLayout>
    );
}
