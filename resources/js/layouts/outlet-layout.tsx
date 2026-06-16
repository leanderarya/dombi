import { router, usePage } from '@inertiajs/react';
import { LogOut } from 'lucide-react';
import { useState  } from 'react';
import type { ReactNode } from 'react';
import type {PropsWithChildren} from 'react';
import NotificationBell from '@/components/notification-bell';
import NotificationSheet from '@/components/notification-sheet';
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

    const rightSlot = headerRight ?? (
        <div className="flex items-center gap-1">
            <NotificationBell onClick={() => setNotificationOpen(true)} />
            <button
                onClick={() => router.post('/logout')}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 active:bg-zinc-100"
                aria-label="Logout"
            >
                <LogOut className="h-4 w-4" />
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
        </MobileRoleLayout>
    );
}
