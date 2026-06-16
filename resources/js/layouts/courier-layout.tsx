import { router, usePage } from '@inertiajs/react';
import { LogOut } from 'lucide-react';
import { useState  } from 'react';
import type { ReactNode } from 'react';
import type {PropsWithChildren} from 'react';
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

    const rightSlot = (
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

    const brandSlot = backHref ? undefined : (
        <div className="flex items-center gap-2">
            <div className="font-semibold text-emerald-800">Dombi</div>
            {auth?.user?.is_online !== undefined && (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    auth.user.is_online
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                        : 'bg-slate-50 text-slate-500 ring-1 ring-slate-200'
                }`}>
                    {auth.user.is_online ? 'Online' : 'Offline'}
                </span>
            )}
        </div>
    );

    return (
        <MobileRoleLayout
            bottomNav={!hideNav ? <CourierBottomNav /> : undefined}
            hideBottomNav={hideNav}
        >
            <PageHeader
                title={title ?? (backHref ? undefined : '')}
                subtitle={subtitle}
                backHref={backHref}
                right={backHref ? rightSlot : brandSlot ? undefined : rightSlot}
                below={headerBelow}
            />
            {/* When there's no title, render brand in the header */}
            {!title && !backHref && (
                <div className="mb-4 flex items-center justify-between">
                    {brandSlot}
                    {rightSlot}
                </div>
            )}
            {children}
            <NotificationSheet open={notificationOpen} onClose={() => setNotificationOpen(false)} />
        </MobileRoleLayout>
    );
}
