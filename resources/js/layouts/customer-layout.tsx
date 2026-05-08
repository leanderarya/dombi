import { Link, router, usePage } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';

export default function CustomerLayout({ children }: PropsWithChildren) {
    const { auth, flash } = usePage<any>().props;
    const nav = [
        ['/customer/home', 'Home'],
        ['/customer/products', 'Produk'],
        ['/customer/checkout', 'Checkout'],
        ['/customer/addresses', 'Alamat'],
        ['/customer/orders', 'Order'],
    ];

    return (
        <div className="min-h-screen bg-stone-50 text-zinc-900">
            <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95">
                <div className="mx-auto flex max-w-4xl items-center justify-between p-4">
                    <div>
                        <div className="font-semibold">Dombi</div>
                        <div className="text-xs text-zinc-500">{auth?.user?.name}</div>
                    </div>
                    <button onClick={() => router.post('/logout')} className="text-sm text-zinc-500">Logout</button>
                </div>
                <nav className="mx-auto flex max-w-4xl gap-4 overflow-x-auto px-4 pb-3 text-sm">
                    {nav.map(([href, label]) => <Link key={href} href={href} className="shrink-0">{label}</Link>)}
                </nav>
            </header>
            <main className="mx-auto max-w-4xl p-4">
                {flash?.success && <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{flash.success}</div>}
                {children}
            </main>
        </div>
    );
}
