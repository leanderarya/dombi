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
    const { auth, flash } = usePage<any>().props;

    return (
        <div className="min-h-screen bg-zinc-50 text-zinc-900">
            <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-200 bg-white p-5 md:block">
                <div className="text-xl font-semibold">Dombi Owner</div>
                <div className="mt-1 text-sm text-zinc-500">{auth?.user?.name}</div>
                <nav className="mt-8 space-y-1">
                    {nav.map(([href, label]) => (
                        <Link key={href} href={href} className="block rounded-md px-3 py-2 text-sm hover:bg-emerald-50 hover:text-emerald-700">
                            {label}
                        </Link>
                    ))}
                </nav>
                <button onClick={() => router.post('/logout')} className="mt-8 text-sm text-zinc-500 hover:text-zinc-900">Logout</button>
            </aside>
            <main className="md:pl-64">
                <div className="border-b border-zinc-200 bg-white p-4 md:hidden">
                    <div className="font-semibold">Dombi Owner</div>
                    <div className="mt-3 flex flex-wrap gap-2 text-sm">
                        {nav.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
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
