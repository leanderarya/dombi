import { router } from '@inertiajs/react';
import { MapPin } from 'lucide-react';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import DeliveryStatusBadge from '@/components/ui/delivery-status-badge';
import Pagination from '@/components/ui/pagination';
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
    outlets,
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
            {/* Status Pills */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                {statusOptions.filter((o) => o.value !== '').map((opt) => {
                    const isActive = (filters.status ?? '') === opt.value;
                    const colorMap: Record<string, string> = {
                        waiting_pickup: 'text-amber-600 bg-amber-50 ring-amber-200',
                        picked_up: 'text-blue-600 bg-blue-50 ring-blue-200',
                        delivering: 'text-indigo-600 bg-indigo-50 ring-indigo-200',
                        completed: 'text-emerald-600 bg-emerald-50 ring-emerald-200',
                        failed: 'text-red-600 bg-red-50 ring-red-200',
                    };

                    return (
                        <button key={opt.value} type="button" onClick={() => setFilter('status', opt.value)}
                            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition-all ${
                                isActive ? colorMap[opt.value] ?? 'bg-primary/10 text-primary ring-primary/20' : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                            }`}>
                            {opt.label}
                        </button>
                    );
                })}
            </div>

            {/* Filter controls */}
            <OwnerFilterCard
                searchPlaceholder="Cari kode..."
                searchValue={filters.search ?? ''}
                onSearch={(val) => setFilter('search', val)}
                outletOptions={outlets?.map((o: any) => ({ value: String(o.id), label: o.name }))}
                outletValue={filters.outlet_id ?? ''}
                onOutletChange={(val) => setFilter('outlet_id', val)}
                courierOptions={couriers.map((c: any) => ({ value: String(c.id), label: c.name }))}
                courierValue={filters.courier_id ?? ''}
                onCourierChange={(val) => setFilter('courier_id', val)}
                dateValue={filters.date ?? ''}
                onDateChange={(val) => setFilter('date', val)}
            />

            {/* KPI Strip */}
            <OwnerKpiStrip items={[
                { label: 'Total', value: stats.total_today, sublabel: (stats.total_today ?? 0) > 0 ? 'Hari ini' : undefined, sublabelColor: 'text-blue-600' },
                { label: 'Aktif', value: stats.active, sublabel: (stats.active ?? 0) > 0 ? 'Sedang berjalan' : undefined, sublabelColor: 'text-blue-600' },
                { label: 'Selesai', value: stats.completed_today },
                { label: 'Gagal', value: stats.failed_today, sublabel: (stats.failed_today ?? 0) > 0 ? 'Perlu ditinjau' : undefined, sublabelColor: 'text-red-600' },
            ]} />

            {/* Table */}
            {deliveries.data.length === 0 ? (
                <div className="rounded-lg border border-border bg-white py-10 text-center text-xs text-text-muted">
                    Tidak ada pengiriman
                </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                    {/* Header */}
                    <div className="grid grid-cols-[100px_1fr_120px_100px_80px] items-center gap-3 bg-[#fafafa] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                        <span>Kode</span><span>Outlet / Kurir</span><span>Status</span><span>Tanggal</span><span />
                    </div>
                    {/* Rows */}
                    {deliveries.data.map((d: any) => {
                        const isActive = ['delivering', 'picked_up'].includes(d.status);

                        return (
                            <div key={d.id}
                                className="grid grid-cols-[100px_1fr_120px_100px_80px] items-center gap-3 border-t border-[#f0f0f0] px-3 py-2 text-sm transition-colors last:border-t-0 hover:bg-surface-muted">
                                <span className="font-bold tabular-nums text-text">{d.order?.order_code ?? '-'}</span>
                                <span className="truncate text-text-muted">{d.order?.outlet?.name ?? '-'} · {d.courier?.name ?? 'Belum ada kurir'}</span>
                                <span><DeliveryStatusBadge status={d.status} /></span>
                                <span className="text-text-muted">{formatDate(d.assigned_at)}</span>
                                <div className="flex items-center gap-1 justify-end">
                                    {isActive && (
                                        <span className="inline-flex items-center gap-0.5 rounded-md bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">
                                            <MapPin className="h-3 w-3" />
                                            Lacak
                                        </span>
                                    )}
                                    <button type="button" onClick={() => router.visit(`/owner/deliveries/${d.id}`)}
                                        className="rounded-md px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary-light">
                                        Detail →
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <Pagination links={deliveries.links} />
        </OwnerPageShell>
    );
}
