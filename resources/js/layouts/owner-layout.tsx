import { router, usePage } from '@inertiajs/react';
import {
    Database,
    LayoutDashboard,
    Settings,
    Truck,
    Wallet,
} from 'lucide-react';
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
        icon: <LayoutDashboard className="h-4 w-4" />,
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
        icon: <Truck className="h-4 w-4" />,
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
        icon: <Database className="h-4 w-4" />,
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
        icon: <Wallet className="h-4 w-4" />,
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
                className={`fixed inset-y-0 left-0 z-50 bg-[#005D42] text-white transition-[width,transform] duration-200 ease-out ${collapsed ? 'w-16' : 'w-56'} ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
            >
                <div className="flex h-full flex-col justify-between">
                    {/* Brand */}
                    <div
                        className={`${collapsed ? 'px-3 py-5' : 'px-4 pt-6 pb-5'}`}
                    >
                        {collapsed ? (
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-bold font-heading text-lg">
                                D
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 border-b border-emerald-800/60 pb-4">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-bold font-heading text-lg">
                                    D
                                </div>
                                <div>
                                    <div className="text-sm font-bold font-heading tracking-wide">
                                        DOMBI
                                    </div>
                                    <div className="text-[11px] text-emerald-200/70 font-medium">
                                        Susu Kambing Direct
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
                    <div className={`${collapsed ? 'px-2 py-3' : 'px-3 py-4'} space-y-3 pt-4 border-t border-emerald-800/60`}>
                        {collapsed ? (
                            <div className="flex flex-col items-center gap-1">
                                <div className="flex justify-center overflow-hidden">
                                    <NotificationBell
                                        onClick={() =>
                                            setNotificationOpen(true)
                                        }
                                    />
                                </div>
                                <button
                                    onClick={() => router.post('/logout')}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-200/70 transition-colors hover:text-white hover:bg-emerald-800/40"
                                    title="Logout"
                                >
                                    <LogoutIcon />
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Cold Chain Capacity */}
                                <div className="bg-emerald-900/50 rounded-xl p-3 border border-emerald-700/30">
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="text-emerald-200/80">
                                            Kapasitas Cold Chain
                                        </span>
                                        <span className="font-semibold text-emerald-300">
                                            78%
                                        </span>
                                    </div>
                                    <div className="w-full bg-emerald-950 rounded-full h-1.5">
                                        <div
                                            className="bg-emerald-400 h-1.5 rounded-full"
                                            style={{ width: '78%' }}
                                        />
                                    </div>
                                </div>

                                <div className="mb-2">
                                    <NotificationBell
                                        onClick={() =>
                                            setNotificationOpen(true)
                                        }
                                    />
                                </div>

                                <a
                                    href="/owner/profile"
                                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-emerald-200/70 hover:text-white text-xs font-medium transition-all hover:bg-emerald-800/40"
                                >
                                    <Settings className="h-4 w-4" />
                                    <span>Pengaturan Sistem</span>
                                </a>

                                <button
                                    onClick={() => router.post('/logout')}
                                    className="hover:bg-emerald-800/40 w-full rounded-xl px-3 py-2 text-sm font-medium text-emerald-200/70 transition-colors hover:text-white"
                                >
                                    Logout
                                </button>
                                <div className="mt-2 text-[10px] text-emerald-200/50">
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
                <div className="px-4 py-6 md:px-8 md:py-6">
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
