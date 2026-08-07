import { Link, router, usePage } from '@inertiajs/react';
import { ChevronLeft, LogOut } from 'lucide-react';
import { useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { PropsWithChildren } from 'react';
import CourierBottomNav from '@/components/courier/bottom-nav';
import NotificationBell from '@/components/shared/notification-bell';
import NotificationSheet from '@/components/shared/notification-sheet';
import MobileRoleLayout from '@/components/ui/mobile-role-layout';
import { useHideOnScroll } from '@/hooks/use-hide-on-scroll';

interface Props extends PropsWithChildren {
    title?: string;
    subtitle?: string;
    backHref?: string;
    hideNav?: boolean;
    /** Extra content below the header (e.g. filter chips) */
    headerBelow?: ReactNode;
    /** Fixed action bar rendered outside <main> — position:fixed works correctly */
    actionBarSlot?: ReactNode;
}

export default function CourierLayout({
    children,
    title,
    subtitle,
    backHref,
    hideNav = false,
    headerBelow,
    actionBarSlot,
}: Props) {
    const page = usePage<any>();
    const { auth } = page.props;
    const [notificationOpen, setNotificationOpen] = useState(false);
    const { visible } = useHideOnScroll();

    useLayoutEffect(() => {
        const root = document.documentElement;
        const previousRole = root.dataset.role;

        root.dataset.role = 'courier';

        return () => {
            if (previousRole) {
                root.dataset.role = previousRole;
            } else {
                delete root.dataset.role;
            }
        };
    }, []);

    const isOnline = auth?.user?.is_online;
    const onlineLabel =
        isOnline !== undefined ? (isOnline ? 'Online' : 'Offline') : undefined;

    const name = (auth?.user?.name as string) ?? 'Kurir';
    const firstName = name.split(' ')[0];

    const rightSlot = (
        <div className="flex items-center gap-1">
            <NotificationBell
                onClick={() => setNotificationOpen(true)}
                className="rounded-full text-white active:bg-white/20"
            />
            <button
                onClick={() => router.post('/logout')}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-current active:bg-white/20"
                aria-label="Logout"
            >
                <LogOut className="h-4 w-4" />
            </button>
        </div>
    );

    // Dashboard (no title): use brand as title, online status as subtitle
    // Other pages: use provided title/subtitle
    const headerSubtitle = subtitle ?? (title ? undefined : onlineLabel);

    const headerSlot = (
        <header className="bg-primary text-white">
            <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3 lg:max-w-4xl">
                <div className="flex min-w-0 items-center gap-3">
                    {backHref ? (
                        <Link
                            href={backHref}
                            className="flex h-11 w-11 items-center justify-center rounded-lg text-white active:bg-white/20"
                            aria-label="Kembali"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Link>
                    ) : (
                        <>
                            {auth?.user?.avatar?.trim() ? (
                                <img
                                    src={auth.user.avatar}
                                    alt="Foto profil"
                                    className="h-11 w-11 shrink-0 rounded-full border-2 border-white/50 object-cover"
                                />
                            ) : (
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white">
                                    {name.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </>
                    )}
                    <div className="min-w-0">
                        <div className="truncate text-base font-bold text-white">
                            {title ?? `Halo, ${firstName}`}
                        </div>
                        {headerSubtitle && (
                            <div className="truncate text-xs text-white/80">
                                {headerSubtitle}
                            </div>
                        )}
                    </div>
                </div>
                {rightSlot}
            </div>
        </header>
    );

    return (
        <MobileRoleLayout
            footerSlot={
                !hideNav ? <CourierBottomNav visible={visible} /> : undefined
            }
            actionBarSlot={actionBarSlot}
            headerSlot={headerSlot}
        >
            {headerBelow && (
                <div className="mx-auto max-w-2xl px-4 lg:max-w-4xl">
                    {headerBelow}
                </div>
            )}
            <div className="pt-4">{children}</div>
            <NotificationSheet
                open={notificationOpen}
                onClose={() => setNotificationOpen(false)}
                onNavigate={(type) => {
                    if (type.startsWith('delivery.')) {
                        router.visit('/courier/deliveries');
                    }
                }}
            />
        </MobileRoleLayout>
    );
}
