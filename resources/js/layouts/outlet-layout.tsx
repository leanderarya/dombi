import { Link, router, usePage } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';

export default function OutletLayout({ children }: PropsWithChildren) {
    const { auth, flash } = usePage<any>().props;

    return (
        <div className="min-h-screen bg-zinc-50 text-zinc-900">
            <header className="border-b border-zinc-200 bg-white">
                <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
                    <div>
                        <div className="font-semibold">Dombi Outlet</div>
                        <div className="text-xs text-zinc-500">{auth?.user?.name}</div>
                    </div>
                    <button onClick={() => router.post('/logout')} className="text-sm text-zinc-500 hover:text-zinc-900">Logout</button>
                </div>
                <nav className="mx-auto flex max-w-6xl gap-4 px-4 pb-3 text-sm">
                    <Link href="/outlet/dashboard">Dashboard</Link>
                    <Link href="/outlet/orders">Orders</Link>
                    <Link href="/outlet/restocks">Restocks</Link>
                </nav>
            </header>
            <main className="mx-auto max-w-6xl p-5">
                {flash?.success && <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{flash.success}</div>}
                {children}
            </main>
        </div>
    );
}
