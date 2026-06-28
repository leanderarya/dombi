import { Link, usePage } from '@inertiajs/react';
import { Home, Store, Package, DollarSign } from 'lucide-react';

const navItems = [
    {
        href: '/owner/dashboard',
        label: 'Dashboard',
        icon: Home,
        match: ['/owner/dashboard'],
    },
    {
        href: '/owner/outlets',
        label: 'Outlet',
        icon: Store,
        match: ['/owner/outlets', '/owner/orders', '/owner/deliveries', '/owner/returns', '/owner/exchanges'],
    },
    {
        href: '/owner/products',
        label: 'Produk',
        icon: Package,
        match: ['/owner/products', '/owner/product-families', '/owner/pricing', '/owner/inventories', '/owner/restocks', '/owner/distributions'],
    },
    {
        href: '/owner/finance',
        label: 'Keuangan',
        icon: DollarSign,
        match: ['/owner/finance', '/owner/settlement-payments', '/owner/reports', '/owner/analytics', '/owner/stock-movements'],
    },
];

export default function OwnerMobileNav() {
    const { url } = usePage();

    return (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-100 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
            <div className="mx-auto grid h-14 max-w-lg grid-cols-4">
                {navItems.map((item) => {
                    const active = item.match.some((href) => url === href || url.startsWith(`${href}/`));
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
                                active ? 'text-emerald-700' : 'text-slate-400'
                            }`}
                        >
                            <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.5} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
