import { Link, router, usePage } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import OfflineBanner from '@/components/offline-banner';

const nav = [
    ['/courier/dashboard', 'Dashboard'],
    ['/courier/deliveries', 'Deliveries'],
];

export default function CourierLayout({ children }: PropsWithChildren) {
    const page = usePage<any>();
    const { auth, flash } = page.props;
    const url = page.url;

    return (
        <div className="min-h-screen bg-[#f8f7f2] pb-safe text-slate-900">
            <OfflineBanner />
            <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur-sm">
                <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                    <div>
                        <div className="font-semibold text-emerald-800">Dombi Courier</div>
                        <div className="text-xs text-zinc-500">{auth?.user?.name}</div>
                    </div>
                    <button onClick={() => router.post('/logout')} className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600">Logout</button>
                </div>
                <nav className="mx-auto flex max-w-lg gap-2 px-4 pb-2">
                    {nav.map(([href, label]) => (
                        <Link key={href} href={href} className={`flex-1 rounded-md py-2 text-center text-sm font-medium ${url?.startsWith(href) ? 'bg-emerald-50 text-emerald-800' : 'text-slate-500 active:bg-zinc-50'}`}>
                            {label}
                        </Link>
                    ))}
                </nav>
            </header>
            <main className="mx-auto max-w-lg px-4 py-5">
                {flash?.success && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{flash.success}</div>}
                {children}
            </main>
        </div>
    );
}
