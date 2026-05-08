import { Link, router, usePage } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';

export default function CourierLayout({ children }: PropsWithChildren) {
    const page = usePage<any>();
    const { auth, flash } = page.props;
    const url = page.url;
    const nav = [
        ['/courier/dashboard', 'Dashboard'],
        ['/courier/deliveries', 'Deliveries'],
    ];

    return (
        <div className="min-h-screen bg-[#f8f7f2] text-slate-900">
            <header className="border-b border-zinc-200 bg-white">
                <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
                    <div>
                        <div className="font-semibold text-emerald-800">Dombi Courier</div>
                        <div className="text-xs text-zinc-500">{auth?.user?.name}</div>
                    </div>
                    <button onClick={() => router.post('/logout')} className="rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900">Logout</button>
                </div>
                <nav className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 pb-3 text-sm">
                    {nav.map(([href, label]) => <Link key={href} href={href} className={`shrink-0 rounded-md px-3 py-1.5 font-medium ${url?.startsWith(href) ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-zinc-50'}`}>{label}</Link>)}
                </nav>
            </header>
            <main className="mx-auto max-w-5xl p-5">
                {flash?.success && <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{flash.success}</div>}
                {children}
            </main>
        </div>
    );
}
