import { Link, router, usePage } from '@inertiajs/react';
import {
    LayoutDashboard,
    Package,
    QrCode,
    Box,
    Truck,
    ShoppingBag,
    AlertTriangle,
    RotateCcw,
    Repeat2,
    Receipt,
    DollarSign,
    LogOut,
    UserRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import SideSheet from '@/components/ui/side-sheet';
import type { OutletBadgeCounts } from '@/hooks/use-outlet-badges';

interface NavItem {
    href: string;
    label: string;
    icon: ReactNode;
    badgeKey?: keyof OutletBadgeCounts | 'orders';
    activePaths?: string[];
}

interface NavGroup {
    label: string;
    items: NavItem[];
}

const navGroups: NavGroup[] = [
    {
        label: 'Utama',
        items: [
            {
                href: '/outlet/dashboard',
                label: 'Dashboard',
                icon: <LayoutDashboard className="h-5 w-5" />,
                activePaths: ['/outlet/analytics', '/outlet/reports'],
            },
            {
                href: '/outlet/orders',
                label: 'Pesanan',
                icon: <Package className="h-5 w-5" />,
                badgeKey: 'orders',
            },
            {
                href: '/outlet/scan',
                label: 'Scan QR',
                icon: <QrCode className="h-5 w-5" />,
            },
            {
                href: '/outlet/deliveries',
                label: 'Pengiriman',
                icon: <Truck className="h-5 w-5" />,
                badgeKey: 'deliveries',
            },
        ],
    },
    {
        label: 'Operasional',
        items: [
            {
                href: '/outlet/inventory',
                label: 'Inventaris',
                icon: <Box className="h-5 w-5" />,
            },
            {
                href: '/outlet/offline-sales',
                label: 'Penjualan Offline',
                icon: <ShoppingBag className="h-5 w-5" />,
            },
            {
                href: '/outlet/my-couriers',
                label: 'Kurir Saya',
                icon: <UserRound className="h-5 w-5" />,
            },
        ],
    },
    {
        label: 'Tindakan',
        items: [
            {
                href: '/outlet/order-reports',
                label: 'Laporan Masalah',
                icon: <AlertTriangle className="h-5 w-5" />,
                badgeKey: 'reports',
            },
            {
                href: '/outlet/returns',
                label: 'Return Produk',
                icon: <RotateCcw className="h-5 w-5" />,
                badgeKey: 'returns',
            },
            {
                href: '/outlet/exchanges',
                label: 'Tukar Produk',
                icon: <Repeat2 className="h-5 w-5" />,
                badgeKey: 'exchanges',
            },
        ],
    },
    {
        label: 'Keuangan',
        items: [
            {
                href: '/outlet/settlement',
                label: 'Settlement',
                icon: <DollarSign className="h-5 w-5" />,
            },
            {
                href: '/outlet/settlement-payments',
                label: 'Riwayat Pembayaran',
                icon: <Receipt className="h-5 w-5" />,
                badgeKey: 'payments',
            },
        ],
    },
];

interface Props {
    open: boolean;
    onClose: () => void;
    pendingCount: number;
    badgeCounts: OutletBadgeCounts;
    outletName?: string;
    userName?: string;
}

export default function OutletNavigationSheet({
    open,
    onClose,
    pendingCount,
    badgeCounts,
    outletName,
    userName,
}: Props) {
    const { url } = usePage();

    const isItemActive = (item: NavItem): boolean => {
        const pathname = url.split('?')[0];
        const paths = [item.href, ...(item.activePaths ?? [])];

        return paths.some(
            (path) => pathname === path || pathname.startsWith(`${path}/`),
        );
    };

    const getBadgeCount = (item: NavItem): number => {
        if (!item.badgeKey) {
            return 0;
        }

        if (item.badgeKey === 'orders') {
            return pendingCount;
        }

        return badgeCounts[item.badgeKey as keyof OutletBadgeCounts] ?? 0;
    };

    return (
        <SideSheet open={open} onClose={onClose}>
            {/* Header */}
            <div className="border-b border-border px-5 pt-5 pb-4">
                <div className="rounded-lg bg-primary px-3 py-2 text-lg font-semibold text-white">
                    Dombi
                </div>
                {outletName && (
                    <div className="mt-3 text-sm font-medium text-text">
                        {outletName}
                    </div>
                )}
                {userName && (
                    <div className="text-[11px] text-text-subtle">
                        Selamat datang, {userName}
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-3">
                {navGroups.map((group, groupIndex) => (
                    <div
                        key={group.label}
                        className={groupIndex > 0 ? 'mt-3' : ''}
                    >
                        <div className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-text-subtle uppercase">
                            {group.label}
                        </div>
                        <div className="space-y-0.5">
                            {group.items.map((item) => {
                                const active = isItemActive(item);
                                const badgeCount = getBadgeCount(item);

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={onClose}
                                        className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[13px] transition-all duration-150 ${
                                            active
                                                ? 'bg-primary-light font-semibold text-primary'
                                                : 'font-medium text-text-muted active:bg-surface-muted'
                                        }`}
                                    >
                                        <span
                                            className={`h-5 w-5 shrink-0 ${active ? 'text-primary' : 'text-text-subtle'}`}
                                        >
                                            {item.icon}
                                        </span>
                                        <span className="flex-1">
                                            {item.label}
                                        </span>
                                        {badgeCount > 0 && (
                                            <span className="min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
                                                {badgeCount > 99
                                                    ? '99+'
                                                    : badgeCount}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Logout */}
            <div className="border-t border-border px-3 py-3">
                <button
                    type="button"
                    onClick={() => {
                        onClose();
                        router.post('/logout');
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-[13px] font-medium text-red-600 active:bg-red-50"
                >
                    <LogOut className="h-5 w-5" />
                    <span>Keluar</span>
                </button>
            </div>
        </SideSheet>
    );
}
