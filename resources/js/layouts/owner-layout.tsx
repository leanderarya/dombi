import { Link, router, usePage } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import OfflineBanner from '@/components/offline-banner';
import UpdateBanner from '@/components/update-banner';

const nav = [
    ['/owner/dashboard', 'Dashboard'],
    ['/owner/outlets', 'Outlet'],
    ['/owner/products', 'Produk'],
    ['/owner/inventories', 'Inventory'],
    ['/owner/orders', 'Orders'],
    ['/owner/deliveries', 'Deliveries'],
    ['/owner/restocks', 'Restocks'],
    ['/owner/distributions', 'Distribution'],
    ['/owner/stock-movements', 'Audit Trail'],
    ['/owner/reports', 'Reports'],
];

export default function OwnerLayout({ children }: PropsWithChildren) {
    const page = usePage<any>();
    const { auth, flash } = page.props;
    const url = page.url;

    return (
        <div className="min-h-screen bg-[#f8f7f2] text-slate-900">
            <OfflineBanner />
            <UpdateBanner />
            {/* Desktop sidebar */}
            <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-zinc-200 bg-white p-4 lg:block">
                <div className="rounded-lg bg-emerald-700 px-3 py-2 text-lg font-semibold text-white">Dombi</div>
                <div className="mt-3 text-sm font-medium text-slate-800">{auth?.user?.name}</div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">Owner</div>
                <nav className="mt-6 space-y-0.5">
                    {nav.map(([href, label]) => (
                        <Link key={href} href={href} className={`block rounded-md px-3 py-2 text-sm font-medium ${url?.startsWith(href) ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'}`}>
                            {label}
                        </Link>
                    ))}
                </nav>
                <button onClick={() => router.post('/logout')} className="mt-6 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900">Logout</button>
                <div className="mt-4 text-xs text-zinc-400">v{page.props.appVersion ?? '1.0.0'}</div>
            </aside>

            {/* Mobile top bar */}
            <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur-sm lg:hidden">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="font-semibold text-emerald-800">Dombi</div>
                    <div className="text-xs text-zinc-500">{auth?.user?.name}</div>
                    <button onClick={() => router.post('/logout')} className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600">Logout</button>
                </div>
                <nav className="flex gap-1 overflow-x-auto px-3 pb-2 scrollbar-none">
                    {nav.map(([href, label]) => (
                        <Link key={href} href={href} className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium ${url?.startsWith(href) ? 'bg-emerald-50 text-emerald-800' : 'text-slate-500'}`}>
                            {label}
                        </Link>
                    ))}
                </nav>
            </header>

            {/* Main content */}
            <main className="lg:pl-60">
                <div className="mx-auto max-w-6xl px-4 py-5 sm:px-5">
                    {flash?.success && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{flash.success}</div>}
                    {children}
                </div>
            </main>
        </div>
    );
}
