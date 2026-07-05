import { Link, router } from '@inertiajs/react';
import {
    ArrowDownRight,
    MapPin,
    Package,
    TrendingUp,
    Truck,
    XCircle,
} from 'lucide-react';
import DeliveryStatusBadge from '@/components/ui/delivery-status-badge';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/ui/pagination';
import EmptyState from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import { SkeletonPage } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';

const statusOptions = [
    { value: '', label: 'Semua' },
    { value: 'waiting_pickup', label: 'Menunggu Pickup' },
    { value: 'picked_up', label: 'Diambil Kurir' },
    { value: 'delivering', label: 'Dalam Pengiriman' },
    { value: 'completed', label: 'Selesai' },
    { value: 'failed', label: 'Gagal' },
];

export default function OwnerDeliveriesIndex({
    deliveries,
    couriers,
    filters,
    stats,
}: any) {
    if (!deliveries || !filters) {
        return (
            <OwnerPageShell title="Pengiriman" subtitle="Kelola pengiriman dari semua outlet">
                <SkeletonPage />
            </OwnerPageShell>
        );
    }

    const setFilter = (key: string, value: string) => {
        router.get(
            '/owner/deliveries',
            { ...filters, [key]: value || undefined },
            { preserveState: true, replace: true },
        );
    };

    return (
        <OwnerPageShell
            title="Pengiriman"
            subtitle="Kelola pengiriman dari semua outlet"
        >
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                {/* Left: Filters + Delivery List */}
                <div className="space-y-4">
                    {/* Filter Pills */}
                    <div className="scrollbar-none flex flex-wrap gap-2">
                        {statusOptions.map((opt) => {
                            const isActive =
                                (filters.status ?? '') === opt.value;
                            const colorMap: Record<string, string> = {
                                waiting_pickup:
                                    'text-amber-600 bg-amber-50 ring-amber-200',
                                picked_up:
                                    'text-blue-600 bg-blue-50 ring-blue-200',
                                delivering:
                                    'text-indigo-600 bg-indigo-50 ring-indigo-200',
                                completed:
                                    'text-emerald-600 bg-emerald-50 ring-emerald-200',
                                failed: 'text-red-600 bg-red-50 ring-red-200',
                            };

                            return (
                                <button
                                    key={opt.value}
                                    onClick={() =>
                                        setFilter('status', opt.value)
                                    }
                                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-all ${
                                        isActive
                                            ? (colorMap[opt.value] ??
                                              'bg-primary/10 text-primary ring-primary/20')
                                            : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            );
                        })}
                        <Select
                            value={filters.courier_id ?? ''}
                            onChange={(e) =>
                                setFilter('courier_id', e.target.value)
                            }
                            options={[
                                { value: '', label: 'Semua kurir' },
                                ...couriers.map((c: any) => ({ value: String(c.id), label: c.name })),
                            ]}
                        />
                    </div>

                    {/* Delivery Cards */}
                    {deliveries.data.length === 0 ? (
                        <EmptyState
                            icon={
                                <Truck className="h-8 w-8 text-text-subtle" />
                            }
                            title="Tidak ada pengiriman"
                            description="Pengiriman akan muncul setelah kurir di-assign."
                        />
                    ) : (
                        <div className="space-y-2">
                            {deliveries.data.map((d: any) => {
                                const isActive = [
                                    'delivering',
                                    'picked_up',
                                ].includes(d.status);

                                return (
                                    <Link
                                        key={d.id}
                                        href={`/owner/deliveries/${d.id}`}
                                        className="block rounded-xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-md"
                                    >
                                        {/* Row 1: code + badge + date */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-text tabular-nums">
                                                    {d.order?.order_code ?? '-'}
                                                </span>
                                                <DeliveryStatusBadge status={d.status} />
                                            </div>
                                            <span className="text-xs text-text-subtle">
                                                {formatDate(d.assigned_at)}
                                            </span>
                                        </div>

                                        {/* Row 2: outlet + courier + lacak */}
                                        <div className="mt-1.5 flex items-center justify-between">
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
                                                <span>{d.order?.outlet?.name ?? '-'}</span>
                                                <span className="text-text-subtle">&middot;</span>
                                                <span>{d.courier?.name ?? 'Belum ada kurir'}</span>
                                            </div>
                                            {isActive && (
                                                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                                    <MapPin className="h-3 w-3" />
                                                    Lacak
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                    <Pagination links={deliveries.links} />
                </div>

                {/* Right: KPI Stats Sidebar */}
                <aside className="hidden lg:block">
                    <div className="sticky top-4 space-y-3">
                        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <Package className="h-4 w-4 text-text-subtle" />
                                Total Pengiriman
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">
                                {stats.total_today}
                            </div>
                            {stats.total_today > 0 && (
                                <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-text-subtle">
                                    <TrendingUp className="h-3 w-3" />
                                    Hari ini
                                </div>
                            )}
                        </div>
                        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <Truck className="h-4 w-4 text-blue-500" />
                                Aktif
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">
                                {stats.active}
                            </div>
                            {stats.active > 0 && (
                                <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-blue-500">
                                    <TrendingUp className="h-3 w-3" />
                                    Sedang berjalan
                                </div>
                            )}
                        </div>
                        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <Package className="h-4 w-4 text-emerald-500" />
                                Selesai Hari Ini
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">
                                {stats.completed_today}
                            </div>
                            {stats.completed_today > 0 && (
                                <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                                    <TrendingUp className="h-3 w-3" />
                                    Pengiriman selesai
                                </div>
                            )}
                        </div>
                        <Link
                            href="/owner/deliveries?status=failed"
                            className="block rounded-xl border border-border bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md"
                        >
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <XCircle className="h-4 w-4 text-red-500" />
                                Gagal Hari Ini
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">
                                {stats.failed_today}
                            </div>
                            {stats.failed_today > 0 && (
                                <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-red-500">
                                    <ArrowDownRight className="h-3 w-3" />
                                    Perlu ditinjau
                                </div>
                            )}
                        </Link>
                    </div>
                </aside>
            </div>
        </OwnerPageShell>
    );
}
