import { Link, usePage } from '@inertiajs/react';
import { Home, Package, Truck, DollarSign, MoreHorizontal } from 'lucide-react';

const navItems = [
    { href: '/owner/dashboard', label: 'Dashboard', icon: Home },
    { href: '/owner/orders', label: 'Pesanan', icon: Package },
    { href: '/owner/deliveries', label: 'Pengiriman', icon: Truck },
    { href: '/owner/finance', label: 'Keuangan', icon: DollarSign },
    { href: '/owner/more', label: 'Lainnya', icon: MoreHorizontal, match: ['/owner/more', '/owner/returns', '/owner/exchanges', '/owner/outlets', '/owner/products', '/owner/product-families', '/owner/pricing', '/owner/inventories', '/owner/restocks', '/owner/distributions', '/owner/analytics', '/owner/stock-movements', '/owner/reports', '/owner/settlement-payments', '/owner/payment-accounts'] },
];

export default function OwnerMobileNav() {
    const { url } = usePage();

    return (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-100 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
            <div className="mx-auto grid h-14 max-w-lg grid-cols-5">
                {navItems.map((item) => {
                    const active = (item.match ?? [item.href]).some((href) => url === href || url.startsWith(`${href}/`));
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
