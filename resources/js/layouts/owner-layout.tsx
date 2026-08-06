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
        badgeKey?: 'pendingReturns' | 'pendingExchanges' | 'pendingRefunds';
        isActive?: (url: string) => boolean;
    }>;
}

const navGroups: NavGroup[] = [
    {
        label: 'Dasbor',
        icon: <DashboardIcon />,
        items: [
            { href: '/owner/dashboard', label: 'Dasbor' },
            {
                href: '/owner/analytics',
                label: 'Analitik',
                isActive: (url: string) =>
                    url.split('?')[0] === '/owner/analytics',
            },
        ],
    },
    {
        label: 'Operasional',
        icon: <OperationalIcon />,
        items: [
            { href: '/owner/outlets', label: 'Outlet' },
            { href: '/owner/orders', label: 'Pesanan' },
            { href: '/owner/deliveries', label: 'Pengiriman' },
            {
                href: '/owner/couriers',
                label: 'Kurir',
                isActive: (url: string) => {
                    const path = url.split('?')[0];

                    return (
                        path === '/owner/couriers/management' ||
                        path === '/owner/couriers'
                    );
                },
            },
        ],
    },
    {
        label: 'Produk',
        icon: <MasterDataIcon />,
        items: [
            {
                href: '/owner/product-categories',
                label: 'Produk',
                isActive: (url: string) =>
                    url.startsWith('/owner/products') ||
                    url.startsWith('/owner/product-families') ||
                    url.startsWith('/owner/product-categories'),
            },
            {
                href: '/owner/pricing',
                label: 'Harga',
                isActive: (url: string) => url.startsWith('/owner/pricing'),
            },
            { href: '/owner/inventories', label: 'Inventaris' },
            { href: '/owner/restocks', label: 'Restock' },
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

                    return (
                        path === '/owner/finance' && !url.includes('tab=refund')
                    );
                },
            },
            {
                href: '/owner/refunds',
                label: 'Refund',
                badgeKey: 'pendingRefunds',
                isActive: (url: string) => {
                    const path = url.split('?')[0];

                    return (
                        path === '/owner/refunds' ||
                        (path === '/owner/finance' &&
                            url.includes('tab=refund'))
                    );
                },
            },
            {
                href: '/owner/returns',
                label: 'Return & Tukar',
                badgeKey: 'pendingReturns',
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
    const { ownerOperationalCounts } = page.props;
    const pendingCounts = ownerOperationalCounts ?? {
        pendingReturns: 0,
        pendingExchanges: 0,
        pendingRefunds: 0,
    };
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [commandOpen, setCommandOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

            {/* Mobile header */}
            <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 md:hidden">
                <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted"
                    aria-label="Buka menu"
                >
                    <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 6h16M4 12h16M4 18h16"
                        />
                    </svg>
                </button>
                <div className="text-sm font-bold text-primary">Dombi</div>
                <div className="ml-auto">
                    <NotificationBell
                        onClick={() => setNotificationOpen(true)}
                    />
                </div>
            </div>

            {/* Mobile overlay backdrop */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 md:hidden"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 bg-surface transition-[width,transform] duration-200 ease-out ${collapsed ? 'w-16' : 'w-56'} ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
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
                        onNavClick={() => setMobileMenuOpen(false)}
                    />

                    {/* Footer */}
                    <div className={`${collapsed ? 'px-2 py-3' : 'px-3 py-4'}`}>
                        {collapsed ? (
                            <div className="flex flex-col items-center gap-1">
                                <div className="flex justify-center">
                                    <NotificationBell
                                        onClick={() =>
                                            setNotificationOpen(true)
                                        }
                                    />
                                </div>
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
                className={`pt-14 transition-[padding] duration-200 ease-out md:pt-0 ${collapsed ? 'md:pl-16' : 'md:pl-56'}`}
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
