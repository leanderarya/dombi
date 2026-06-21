import { Link, usePage } from '@inertiajs/react';
import { LayoutDashboard, Package, QrCode, Box } from 'lucide-react';

const navItems = [
    { 
        href: '/outlet/dashboard', 
        label: 'Dashboard', 
        icon: LayoutDashboard,
        match: ['/outlet/dashboard'],
    },
    { 
        href: '/outlet/orders', 
        label: 'Pesanan', 
        icon: Package,
        match: ['/outlet/orders'],
    },
    { 
        href: '/outlet/scan', 
        label: 'Scan', 
        icon: QrCode,
        match: ['/outlet/scan'],
    },
    { 
        href: '/outlet/inventory', 
        label: 'Inventaris', 
        icon: Box,
        match: ['/outlet/inventory', '/outlet/restocks', '/outlet/settlement', '/outlet/settlement-payments', '/outlet/deliveries', '/outlet/returns', '/outlet/exchanges'],
    },
];

export default function OutletBottomNav() {
    const { url } = usePage();

    return (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-100 bg-white pb-[env(safe-area-inset-bottom)]">
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
