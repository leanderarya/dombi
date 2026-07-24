import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';
import OwnerCommandSheet from '@/components/owner/owner-command-sheet';
import OwnerPageSkeleton from '@/components/owner/owner-page-skeleton';
import OwnerSidebarNav from '@/components/owner/owner-sidebar-nav';
import NotificationBell from '@/components/shared/notification-bell';
import NotificationSheet from '@/components/shared/notification-sheet';
import OfflineBanner from '@/components/shared/offline-banner';
import UpdateBanner from '@/components/shared/update-banner';
import { SidebarProvider, useSidebar } from '@/contexts/sidebar-context';
import { useFlashToast } from '@/hooks/use-flash-toast';
import { useInertiaLoading } from '@/hooks/use-inertia-loading';

interface NavGroup {
    label: string;
    icon: ReactNode;
    items: Array<{
        href: string;
        label: string;
        badgeKey?: 'pendingReturns' | 'pendingExchanges';
        isActive?: (url: string) => boolean;
    }>;
}

const navGroups: NavGroup[] = [
    {
        label: 'Dasbor',
        icon: <DashboardIcon />,
        items: [{ href: '/owner/dashboard', label: 'Dasbor' }],
    },
    {
        label: 'Operasional',
        icon: <OperationalIcon />,
        items: [
            { href: '/owner/outlets', label: 'Outlet' },
            { href: '/owner/orders', label: 'Pesanan' },
            { href: '/owner/deliveries', label: 'Pengiriman' },
            { href: '/owner/couriers', label: 'Kurir' },
            {
                href: '/owner/returns',
                label: 'Return & Tukar',
                badgeKey: 'pendingReturns',
            },
            { href: '/owner/delivery-tiers', label: 'Tier Ongkir' },
        ],
    },
    {
        label: 'Keuangan',
        icon: <FinanceIcon />,
        items: [
            {
                href: '/owner/finance',
                label: 'Keuangan',
                isActive: (url: string) => {
                    const path = url.split('?')[0];
                    return path === '/owner/finance' || path === '/owner/refunds';
                },
            },
        ],
    },
    {
        label: 'Master Data',
        icon: <MasterDataIcon />,
        items: [
            {
                href: '/owner/products',
                label: 'Produk',
                isActive: (url: string) =>
                    url.startsWith('/owner/products') ||
                    url.startsWith('/owner/product-families'),
            },
            {
                href: '/owner/pricing',
                label: 'Harga',
                isActive: (url: string) =>
                    url.split('?')[0] === '/owner/pricing',
            },
        ],
    },
    {
        label: 'Persediaan',
        icon: <InventoryIcon />,
        items: [
            { href: '/owner/inventories', label: 'Inventaris' },
            { href: '/owner/restocks', label: 'Restock' },
        ],
    },
    {
        label: 'Analitik',
        icon: <AnalyticsIcon />,
        items: [
            {
                href: '/owner/analytics',
                label: 'Analitik',
                isActive: (url: string) =>
                    url.split('?')[0] === '/owner/analytics',
            },
        ],
    },
];

export default function OwnerLayout({ children }: PropsWithChildren) {
    return (
        <SidebarProvider>
            <OwnerLayoutInner>{children}</OwnerLayoutInner>
        </SidebarProvider>
    );
}

function OwnerLayoutInner({ children }: PropsWithChildren) {
    useFlashToast();
    const { loading } = useInertiaLoading();
    const page = usePage<any>();
    const { auth, ownerOperationalCounts } = page.props;
    const pendingCounts = ownerOperationalCounts ?? {
        pendingReturns: 0,
        pendingExchanges: 0,
    };
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [commandOpen, setCommandOpen] = useState(false);
    const { collapsed } = useSidebar();

    return (
        <div className="bg-mint-canvas min-h-screen text-text">
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white focus:outline-none"
            >
                Langsung ke konten
            </a>
            <OfflineBanner />
            <UpdateBanner />

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 bg-surface transition-[width] duration-200 ease-out ${collapsed ? 'w-16' : 'w-56'}`}
                style={{ boxShadow: '1px 0 0 0 rgba(0,0,0,0.04)' }}
            >
                <div className="flex h-full flex-col">
                    {/* Brand */}
                    <div
                        className={`${collapsed ? 'px-3 py-5' : 'px-4 pt-6 pb-5'}`}
                    >
                        {collapsed ? (
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                                <svg
                                    className="h-4 w-4 text-white"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                                    />
                                </svg>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                                    <svg
                                        className="h-4 w-4 text-white"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                                        />
                                    </svg>
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-primary">
                                        Dombi
                                    </div>
                                    <div className="text-[10px] font-medium tracking-wider text-text-subtle uppercase">
                                        Panel
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Navigation */}
                    <OwnerSidebarNav
                        navGroups={navGroups}
                        pendingCounts={pendingCounts}
                        collapsed={collapsed}
                    />

                    {/* Footer */}
                    <div className={`${collapsed ? 'px-2 py-3' : 'px-3 py-4'}`}>
                        {collapsed ? (
                            <div className="flex flex-col items-center gap-1">
                                <button
                                    onClick={() => setNotificationOpen(true)}
                                    className="hover:bg-mint-wash flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:text-primary"
                                    title="Notifikasi"
                                >
                                    <NotificationBellIcon />
                                </button>
                                <button
                                    onClick={() => router.post('/logout')}
                                    className="hover:bg-mint-wash flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:text-red-600"
                                    title="Logout"
                                >
                                    <LogoutIcon />
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="mb-2">
                                    <NotificationBell
                                        onClick={() =>
                                            setNotificationOpen(true)
                                        }
                                    />
                                </div>
                                <button
                                    onClick={() => router.post('/logout')}
                                    className="hover:bg-mint-wash w-full rounded-lg px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:text-red-600"
                                >
                                    Logout
                                </button>
                                <div className="mt-2 text-[10px] text-text-subtle">
                                    v{page.props.appVersion ?? '1.0.0'}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <main
                id="main-content"
                className={`transition-[padding] duration-200 ease-out ${collapsed ? 'pl-16' : 'pl-56'}`}
            >
                <div className="px-6 py-6">
                    {loading ? <OwnerPageSkeleton /> : children}
                </div>
            </main>
            <NotificationSheet
                open={notificationOpen}
                onClose={() => setNotificationOpen(false)}
                onNavigate={(type) => {
                    if (type.startsWith('inventory.')) {
                        router.visit('/owner/inventories');
                    }
                }}
            />
            <OwnerCommandSheet
                open={commandOpen}
                onClose={() => setCommandOpen(false)}
            />
        </div>
    );
}

// ─── Icons ────────────────────────────────────────────────────

function DashboardIcon() {
    return (
        <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
        </svg>
    );
}

function OperationalIcon() {
    return (
        <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
            />
        </svg>
    );
}

function FinanceIcon() {
    return (
        <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
        </svg>
    );
}

function MasterDataIcon() {
    return (
        <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
            />
        </svg>
    );
}

function InventoryIcon() {
    return (
        <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
        </svg>
    );
}

function AnalyticsIcon() {
    return (
        <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
        </svg>
    );
}

function NotificationBellIcon() {
    return (
        <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
        </svg>
    );
}

function LogoutIcon() {
    return (
        <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
        </svg>
    );
}
