import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, RotateCcw, Repeat2, PackagePlus, Truck, Receipt, BarChart3, FileText, ChevronRight } from 'lucide-react';
import StatusBadge from '@/components/ui/status-badge';
import OutletLayout from '@/layouts/outlet-layout';

interface Props {
    pendingReturns: number;
    pendingExchanges: number;
    pendingRestocks: number;
    activeDeliveries: number;
    pendingSettlementPayments: number;
    pendingReports: number;
}

const features = [
    {
        href: '/outlet/analytics',
        icon: BarChart3,
        title: 'Analitik Performa',
        description: 'Grafik penjualan, produk terlaris, trend revenue',
        badgeKey: null,
        color: 'bg-cyan-50 text-cyan-600',
    },
    {
        href: '/outlet/reports',
        icon: FileText,
        title: 'Laporan Penjualan',
        description: 'Export laporan penjualan ke CSV',
        badgeKey: null,
        color: 'bg-indigo-50 text-indigo-600',
    },
    {
        href: '/outlet/order-reports',
        icon: AlertTriangle,
        title: 'Laporan Masalah',
        description: 'Laporan masalah pesanan dari customer',
        badgeKey: 'reports' as const,
        color: 'bg-red-50 text-red-600',
    },
    {
        href: '/outlet/returns',
        icon: RotateCcw,
        title: 'Return Produk',
        description: 'Ajukan return produk tidak terjual atau rusak',
        badgeKey: 'returns' as const,
        color: 'bg-amber-50 text-amber-600',
    },
    {
        href: '/outlet/exchanges',
        icon: Repeat2,
        title: 'Tukar Produk',
        description: 'Ajukan dan pantau produk pengganti',
        badgeKey: 'exchanges' as const,
        color: 'bg-blue-50 text-blue-600',
    },
    {
        href: '/outlet/restocks',
        icon: PackagePlus,
        title: 'Restock',
        description: 'Request stok tambahan dari pusat',
        badgeKey: 'restocks' as const,
        color: 'bg-emerald-50 text-emerald-600',
    },
    {
        href: '/outlet/deliveries',
        icon: Truck,
        title: 'Pengiriman',
        description: 'Kelola kurir dan lacak pengiriman',
        badgeKey: 'deliveries' as const,
        color: 'bg-violet-50 text-violet-600',
    },
    {
        href: '/outlet/settlement-payments',
        icon: Receipt,
        title: 'Riwayat Pembayaran',
        description: 'Lihat status pembayaran settlement',
        badgeKey: 'payments' as const,
        color: 'bg-rose-50 text-rose-600',
    },
];

export default function OutletMore({ pendingReturns, pendingExchanges, pendingRestocks, activeDeliveries, pendingSettlementPayments, pendingReports = 0 }: Props) {
    const badgeCounts: Record<string, number> = {
        returns: pendingReturns,
        exchanges: pendingExchanges,
        restocks: pendingRestocks,
        deliveries: activeDeliveries,
        payments: pendingSettlementPayments,
        reports: pendingReports,
    };

    return (
        <OutletLayout title="Lainnya" subtitle="Fitur operasional outlet">
            <Head title="Lainnya" />

            <div className="mt-4 space-y-2">
                {features.map((feature) => {
                    const Icon = feature.icon;
                    const count = badgeCounts[feature.badgeKey];

                    return (
                        <Link
                            key={feature.href}
                            href={feature.href}
                            className="flex items-center gap-4 rounded-xl border border-border bg-white p-4 active:bg-surface-muted transition-colors"
                        >
                            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${feature.color}`}>
                                <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-text">{feature.title}</span>
                                    {feature.badgeKey && count > 0 && (
                                        <StatusBadge variant="warning" size="sm">{count}</StatusBadge>
                                    )}
                                </div>
                                <p className="mt-0.5 text-xs text-text-muted">{feature.description}</p>
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-text-subtle" />
                        </Link>
                    );
                })}
            </div>
        </OutletLayout>
    );
}
