import { Link, router, usePage } from '@inertiajs/react';
import { useState, type ReactNode } from 'react';
import type { PropsWithChildren } from 'react';
import NotificationBell from '@/components/notification-bell';
import NotificationSheet from '@/components/notification-sheet';
import OfflineBanner from '@/components/offline-banner';
import OwnerBottomNav from '@/components/owner/owner-bottom-nav';
import UpdateBanner from '@/components/update-banner';

interface NavGroup {
    label: string;
    icon: ReactNode;
    items: [string, string][];
}

const navGroups: NavGroup[] = [
    {
        label: 'Dashboard',
        icon: <DashboardIcon />,
        items: [['/owner/dashboard', 'Dashboard']],
    },
    {
        label: 'Operasional',
        icon: <OperationalIcon />,
        items: [
            ['/owner/orders', 'Pesanan'],
            ['/owner/deliveries', 'Pengiriman'],
        ],
    },
    {
        label: 'Master Data',
        icon: <MasterDataIcon />,
        items: [
            ['/owner/outlets', 'Outlet'],
            ['/owner/products', 'Produk'],
        ],
    },
    {
        label: 'Persediaan',
        icon: <InventoryIcon />,
        items: [
            ['/owner/inventories', 'Inventaris'],
            ['/owner/restocks', 'Restock'],
            ['/owner/distributions', 'Distribusi'],
        ],
    },
    {
        label: 'Analitik',
        icon: <AnalyticsIcon />,
        items: [
            ['/owner/stock-movements', 'Audit Trail'],
            ['/owner/reports', 'Laporan'],
        ],
    },
];

export default function OwnerLayout({ children }: PropsWithChildren) {
    const page = usePage<any>();
    const { auth, flash } = page.props;
    const url = page.url;
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
        // Auto-expand the group containing the current URL
        const active = navGroups.find((g) => g.items.some(([href]) => url?.startsWith(href)));
        return new Set(active ? [active.label] : []);
    });

    const toggleGroup = (label: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(label)) {
                next.delete(label);
            } else {
                next.add(label);
            }
            return next;
        });
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            <OfflineBanner />
            <UpdateBanner />

            {/* Desktop sidebar */}
            <aside className="fixed inset-y-0 left-0 hidden w-56 border-r border-zinc-200 bg-white lg:block">
                <div className="flex h-full flex-col">
                    {/* Brand */}
                    <div className="px-4 pt-5 pb-3">
                        <div className="rounded-lg bg-emerald-700 px-3 py-2 text-lg font-semibold text-white">Dombi</div>
                        <div className="mt-2.5 text-sm font-medium text-slate-800">{auth?.user?.name}</div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Owner</div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto px-3 pb-4">
                        {navGroups.map((group) => {
                            const isExpanded = expandedGroups.has(group.label);
                            const hasActive = group.items.some(([href]) => url?.startsWith(href));

                            return (
                                <div key={group.label} className="mb-1">
                                    {group.items.length === 1 ? (
                                        /* Single-item groups render as direct link */
                                        <Link
                                            href={group.items[0][0]}
                                            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                                url?.startsWith(group.items[0][0])
                                                    ? 'bg-emerald-50 text-emerald-800'
                                                    : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                                            }`}
                                        >
                                            <span className="h-4 w-4 shrink-0">{group.icon}</span>
                                            {group.label}
                                        </Link>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => toggleGroup(group.label)}
                                                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                                    hasActive
                                                        ? 'text-emerald-800'
                                                        : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                                                }`}
                                            >
                                                <span className="h-4 w-4 shrink-0">{group.icon}</span>
                                                <span className="flex-1 text-left">{group.label}</span>
                                                <ChevronIcon expanded={isExpanded} />
                                            </button>
                                            {isExpanded && (
                                                <div className="ml-6 mt-0.5 space-y-0.5">
                                                    {group.items.map(([href, label]) => (
                                                        <Link
                                                            key={href}
                                                            href={href}
                                                            className={`block rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                                                url?.startsWith(href)
                                                                    ? 'bg-emerald-50 text-emerald-800'
                                                                    : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
                                                            }`}
                                                        >
                                                            {label}
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </nav>

                    {/* Footer */}
                    <div className="border-t border-zinc-100 px-4 py-3">
                        <div className="mb-2">
                            <NotificationBell onClick={() => setNotificationOpen(true)} />
                        </div>
                        <button onClick={() => router.post('/logout')} className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900">Logout</button>
                        <div className="mt-2 text-[10px] text-zinc-400">v{page.props.appVersion ?? '1.0.0'}</div>
                    </div>
                </div>
            </aside>

            {/* Mobile top bar */}
            <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur-sm lg:hidden">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="font-semibold text-emerald-800">Dombi</div>
                    <div className="flex items-center gap-2">
                        <NotificationBell onClick={() => setNotificationOpen(true)} />
                        <div className="text-xs text-zinc-500">{auth?.user?.name}</div>
                        <button onClick={() => router.post('/logout')} className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600">Logout</button>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-56">
                <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-5 lg:px-6">
                    {flash?.success && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{flash.success}</div>}
                    {children}
                </div>
            </main>
            <div className="lg:hidden">
                <OwnerBottomNav />
            </div>
            <NotificationSheet open={notificationOpen} onClose={() => setNotificationOpen(false)} />
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

function MasterDataIcon() {
    return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>;
}

function InventoryIcon() {
    return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
}

function AnalyticsIcon() {
    return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
    return (
        <svg className={`h-3.5 w-3.5 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
    );
}
