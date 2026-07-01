import { Link, usePage } from '@inertiajs/react';
import { LayoutDashboard, MoreHorizontal, Package, QrCode, Box } from 'lucide-react';
import { useState } from 'react';
import BottomSheet from '@/components/ui/bottom-sheet';
import { features, type OutletMoreBadgeCounts } from '@/pages/outlet/more';

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
    {
        href: '#more',
        label: 'Lainnya',
        icon: MoreHorizontal,
        match: [] as string[],
    },
];

interface Props {
    pendingCount?: number;
    visible?: boolean;
    badgeCounts?: OutletMoreBadgeCounts;
}

export default function OutletBottomNav({ pendingCount = 0, visible = true, badgeCounts = {} }: Props) {
    const { url } = usePage();
    const [showMoreSheet, setShowMoreSheet] = useState(false);

    const handleNavClick = (e: React.MouseEvent, href: string) => {
        if (href === '#more') {
            e.preventDefault();
            setShowMoreSheet(true);
        }
    };

    // Count total badges for "Lainnya" indicator
    const totalBadgeCount = Object.values(badgeCounts).reduce((sum, count) => sum + (count || 0), 0);

    return (
        <>
            <nav
                className="fixed inset-x-0 z-40 border-t border-border bg-white pb-[env(safe-area-inset-bottom)]"
                style={{
                    bottom: visible ? 0 : -100,
                    transition: 'bottom 200ms ease',
                }}
            >
                <div className="mx-auto grid h-14 max-w-lg grid-cols-5">
                    {navItems.map((item) => {
                        const active = item.href !== '#more' && item.match.some((href) => url === href || url.startsWith(`${href}/`));
                        const Icon = item.icon;
                        const showBadge = item.badgeKey === 'orders' && pendingCount > 0;
                        const showMoreBadge = item.href === '#more' && totalBadgeCount > 0;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={(e) => handleNavClick(e, item.href)}
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
                                    {showMoreBadge && (
                                        <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                                            {totalBadgeCount > 99 ? '99+' : totalBadgeCount}
                                        </span>
                                    )}
                                </div>
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* Lainnya BottomSheet */}
            <BottomSheet open={showMoreSheet} onClose={() => setShowMoreSheet(false)} title="Lainnya">
                <div className="grid grid-cols-3 gap-3 px-1 pb-4">
                    {features.map((feature) => {
                        const Icon = feature.icon;
                        const count = feature.badgeKey ? (badgeCounts[feature.badgeKey] ?? 0) : 0;

                        return (
                            <Link
                                key={feature.href}
                                href={feature.href}
                                onClick={() => setShowMoreSheet(false)}
                                className="relative flex flex-col items-center gap-2 rounded-xl bg-surface-muted px-2 py-3 text-center transition-colors active:bg-surface-muted/70"
                            >
                                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${feature.color}`}>
                                    <Icon className="h-5 w-5" />
                                </div>
                                <span className="text-[11px] font-semibold leading-tight text-text">{feature.title}</span>
                                {feature.badgeKey && count > 0 && (
                                    <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                        {count > 99 ? '99+' : count}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </div>
            </BottomSheet>
        </>
    );
}
