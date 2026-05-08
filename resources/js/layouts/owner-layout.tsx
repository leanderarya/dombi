import { Link, router, usePage } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';

const nav = [
    ['/owner/dashboard', 'Dashboard'],
    ['/owner/outlets', 'Outlet'],
    ['/owner/products', 'Produk'],
    ['/owner/inventories', 'Inventory'],
    ['/owner/orders', 'Orders'],
    ['/owner/deliveries', 'Deliveries'],
    ['/owner/restocks', 'Restocks'],
    ['/owner/distributions', 'Stock Distribution'],
];

export default function OwnerLayout({ children }: PropsWithChildren) {
    const page = usePage<any>();
    const { auth, flash } = page.props;
    const url = page.url;

    return (
        <div className="min-h-screen bg-[#f8f7f2] text-slate-900">
            <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-200 bg-white p-5 md:block">
                <div className="rounded-lg bg-emerald-700 px-3 py-2 text-xl font-semibold text-white">Dombi</div>
                <div className="mt-3 text-sm font-medium text-slate-800">{auth?.user?.name}</div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">Owner</div>
                <nav className="mt-8 space-y-1">
                    {nav.map(([href, label]) => (
                        <Link key={href} href={href} className={`block rounded-md px-3 py-2 text-sm font-medium ${url?.startsWith(href) ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'}`}>
                            {label}
                        </Link>
                    ))}
                </nav>
                <button onClick={() => router.post('/logout')} className="mt-8 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900">Logout</button>
            </aside>
            <main className="md:pl-64">
                <div className="border-b border-zinc-200 bg-white p-4 md:hidden">
                    <div className="font-semibold text-emerald-800">Dombi Owner</div>
                    <div className="mt-3 flex gap-2 overflow-x-auto text-sm">
                        {nav.map(([href, label]) => <Link key={href} href={href} className={`shrink-0 rounded-md px-3 py-1 ${url?.startsWith(href) ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600'}`}>{label}</Link>)}
                    </div>
                </div>
                <div className="mx-auto max-w-6xl p-5">
                    {flash?.success && <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{flash.success}</div>}
                    {children}
                </div>
            </main>
        </div>
    );
}
