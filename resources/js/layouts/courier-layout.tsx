import { router, usePage } from '@inertiajs/react';
import { LogOut } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { PropsWithChildren } from 'react';
import CourierBottomNav from '@/components/courier-bottom-nav';
import NotificationBell from '@/components/notification-bell';
import NotificationSheet from '@/components/notification-sheet';
import MobileRoleLayout from '@/components/ui/mobile-role-layout';
import PageHeader from '@/components/ui/page-header';

interface Props extends PropsWithChildren {
    title?: string;
    subtitle?: string;
    backHref?: string;
    hideNav?: boolean;
    /** Extra content below the header (e.g. filter chips) */
    headerBelow?: ReactNode;
}

export default function CourierLayout({ children, title, subtitle, backHref, hideNav = false, headerBelow }: Props) {
    const page = usePage<any>();
    const { auth } = page.props;
    const [notificationOpen, setNotificationOpen] = useState(false);

    const isOnline = auth?.user?.is_online;
    const onlineLabel = isOnline !== undefined ? (isOnline ? 'Online' : 'Offline') : undefined;

    const rightSlot = (
        <div className="flex items-center gap-1">
            <NotificationBell onClick={() => setNotificationOpen(true)} />
            <button
                onClick={() => router.post('/logout')}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-text-muted active:bg-surface-muted"
                aria-label="Logout"
            >
                <LogOut className="h-4 w-4" />
            </button>
        </div>
    );

    // Dashboard (no title): use brand as title, online status as subtitle
    // Other pages: use provided title/subtitle
    const headerTitle = title ?? 'Dombi';
    const headerSubtitle = subtitle ?? (title ? undefined : onlineLabel);

    return (
        <MobileRoleLayout
            bottomNav={!hideNav ? <CourierBottomNav /> : undefined}
            hideBottomNav={hideNav}
        >
            <PageHeader
                title={headerTitle}
                subtitle={headerSubtitle}
                backHref={backHref}
                right={rightSlot}
                below={headerBelow}
            />
            {children}
            <NotificationSheet open={notificationOpen} onClose={() => setNotificationOpen(false)} />
        </MobileRoleLayout>
    );
}
