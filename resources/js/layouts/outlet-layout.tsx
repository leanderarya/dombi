import { Link, router, usePage } from '@inertiajs/react';
import { QrCode } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { PropsWithChildren } from 'react';
import OutletNavigationSheet from '@/components/outlet/navigation-sheet';
import NotificationBell from '@/components/shared/notification-bell';
import NotificationSheet from '@/components/shared/notification-sheet';
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
    /** Fixed action bar rendered outside <main> — position:fixed works correctly */
    actionBarSlot?: ReactNode;
}

export default function OutletLayout({
    children,
    title,
    subtitle,
    backHref,
    headerBelow,
    headerRight,
    actionBarSlot,
}: Props) {
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
        <MobileRoleLayout actionBarSlot={actionBarSlot}>
            <PageHeader
                title={title}
                subtitle={subtitle}
                backHref={backHref}
                onMenuClick={() => setNavOpen(true)}
                right={rightSlot}
                below={headerBelow}
            />
            {children}
            <NotificationSheet
                open={notificationOpen}
                onClose={() => setNotificationOpen(false)}
                onNavigate={(type, data) => {
                    const outletId = (data as any)?.outlet_id;
                    if (type.startsWith('inventory.')) {
                        router.visit('/outlet/restocks');
                    }
                }}
            />
            <OutletNavigationSheet
                open={navOpen}
                onClose={() => setNavOpen(false)}
                pendingCount={pendingCount}
                badgeCounts={badgeCounts}
                outletName={auth?.outlet?.name}
                userName={auth?.user?.name}
            />

            {/* Quick Scan FAB — always accessible */}
            <Link
                href="/outlet/scan"
                className="fixed right-4 bottom-[calc(1.5rem+env(safe-area-inset-bottom,0))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform active:scale-95"
                aria-label="Scan QR"
            >
                <QrCode className="h-6 w-6" />
            </Link>
        </MobileRoleLayout>
    );
}
