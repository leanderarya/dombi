import { router, usePage } from '@inertiajs/react';
import { User } from 'lucide-react';
import { useState } from 'react';
import type {ReactNode} from 'react';
import type { PropsWithChildren } from 'react';
import OwnerCommandSheet from '@/components/owner/owner-command-sheet';
import OwnerPageSkeleton from '@/components/owner/owner-page-skeleton';
import OwnerSidebarNav from '@/components/owner/owner-sidebar-nav';
import NotificationBell from '@/components/shared/notification-bell';
import NotificationSheet from '@/components/shared/notification-sheet';
import OfflineBanner from '@/components/shared/offline-banner';
import UpdateBanner from '@/components/shared/update-banner';
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
            { href: '/owner/orders', label: 'Pesanan' },
            { href: '/owner/deliveries', label: 'Pengiriman' },
            { href: '/owner/returns', label: 'Return & Tukar', badgeKey: 'pendingReturns' },
            { href: '/owner/delivery-tiers', label: 'Tier Ongkir' },
        ],
    },
    {
        label: 'Keuangan',
        icon: <FinanceIcon />,
        items: [
            { href: '/owner/finance', label: 'Keuangan', isActive: (url: string) => url.split('?')[0] === '/owner/finance' },
        ],
    },
    {
        label: 'Master Data',
        icon: <MasterDataIcon />,
        items: [
            { href: '/owner/outlets', label: 'Outlet' },
            { href: '/owner/products', label: 'Produk', isActive: (url: string) => url.startsWith('/owner/products') || url.startsWith('/owner/product-families') },
            { href: '/owner/pricing', label: 'Harga', isActive: (url: string) => url.split('?')[0] === '/owner/pricing' },
        ],
    },
    {
        label: 'Persediaan',
        icon: <InventoryIcon />,
        items: [
            { href: '/owner/inventories', label: 'Inventaris' },
            { href: '/owner/restocks', label: 'Restock' },
            { href: '/owner/distributions', label: 'Distribusi' },
        ],
    },
    {
        label: 'Analitik',
        icon: <AnalyticsIcon />,
        items: [
            { href: '/owner/analytics', label: 'Analitik', isActive: (url: string) => url.split('?')[0] === '/owner/analytics' },
        ],
    },
];

export default function OwnerLayout({ children }: PropsWithChildren) {
    useFlashToast();
    const { loading } = useInertiaLoading();
    const page = usePage<any>();
    const { auth, ownerOperationalCounts } = page.props;
    const url = page.url;
    const pendingCounts = ownerOperationalCounts ?? { pendingReturns: 0, pendingExchanges: 0 };
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [commandOpen, setCommandOpen] = useState(false);

    return (
        <div className="min-h-screen bg-surface-muted text-text">
            <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white focus:outline-none">
                Langsung ke konten
            </a>
            <OfflineBanner />
            <UpdateBanner />

            {/* Sidebar — desktop only */}
            <aside className="fixed inset-y-0 left-0 z-50 w-56 bg-surface">
                <div className="flex h-full flex-col">
                    {/* Brand */}
                    <div className="border-b border-border px-4 pt-5 pb-4">
                        <div className="rounded-lg bg-primary px-3 py-2 text-lg font-semibold text-white">Dombi</div>
                        <div className="mt-3 text-sm font-medium text-text">{auth?.user?.name}</div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">Owner</div>
                    </div>

                    {/* Navigation */}
                    <OwnerSidebarNav navGroups={navGroups} pendingCounts={pendingCounts} />

                    {/* Footer */}
                    <div className="border-t border-border px-4 py-3">
                        <div className="mb-2">
                            <NotificationBell onClick={() => setNotificationOpen(true)} />
                        </div>
                        <button onClick={() => router.post('/logout')} className="w-full rounded-md border border-border px-3 py-2 text-sm text-text-muted transition-colors duration-150 hover:text-text">Logout</button>
                        <div className="mt-2 text-[11px] text-text-subtle">v{page.props.appVersion ?? '1.0.0'}</div>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <main id="main-content" className="pl-56">
                <div className="mx-auto max-w-7xl px-6 py-6">
                    {loading ? <OwnerPageSkeleton /> : children}
                </div>
            </main>
            <NotificationSheet open={notificationOpen} onClose={() => setNotificationOpen(false)} />
            <OwnerCommandSheet open={commandOpen} onClose={() => setCommandOpen(false)} />
        </div>
    );
}

// ─── Icons ────────────────────────────────────────────────────

function DashboardIcon() {
    return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
}

function OperationalIcon() {
    return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>;
}

function FinanceIcon() {
    return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}

function MasterDataIcon() {
    return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>;
}

function InventoryIcon() {
    return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
}

function AnalyticsIcon() {
    return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
}


