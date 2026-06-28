import { usePage } from '@inertiajs/react';
import { User } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { PropsWithChildren } from 'react';
import NotificationBell from '@/components/notification-bell';
import NotificationSheet from '@/components/notification-sheet';
import OutletMoreSheet from '@/components/outlet/outlet-more-sheet';
import OutletBottomNav from '@/components/outlet-bottom-nav';
import MobileRoleLayout from '@/components/ui/mobile-role-layout';
import PageHeader from '@/components/ui/page-header';

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
            bottomNav={!hideNav ? <OutletBottomNav /> : undefined}
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
