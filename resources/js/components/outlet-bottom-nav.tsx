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
        badgeKey: 'orders' as const,
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
        match: ['/outlet/inventory'],
    },
];

interface Props {
    pendingCount?: number;
}

export default function OutletBottomNav({ pendingCount = 0 }: Props) {
    const { url } = usePage();

    return (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto grid h-14 max-w-lg grid-cols-4">
                {navItems.map((item) => {
                    const active = item.match.some((href) => url === href || url.startsWith(`${href}/`));
                    const Icon = item.icon;
                    const showBadge = item.badgeKey === 'orders' && pendingCount > 0;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
                                active ? 'text-emerald-700' : 'text-text-subtle'
                            }`}
                        >
                            <div className="relative">
                                <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.5} />
                                {showBadge && (
                                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                                        {pendingCount > 99 ? '99+' : pendingCount}
                                    </span>
                                )}
                            </div>
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
