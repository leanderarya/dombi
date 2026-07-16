import { router } from '@inertiajs/react';
import { MapPin, Package } from 'lucide-react';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import DeliveryStatusBadge from '@/components/ui/delivery-status-badge';
import EmptyState from '@/components/ui/empty-state';
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
            {/* KPI Strip */}
            <OwnerKpiStrip cols={4} items={[
                { label: 'Total', value: stats.total_today, sublabel: (stats.total_today ?? 0) > 0 ? 'Hari ini' : undefined, sublabelColor: 'text-blue-600' },
                { label: 'Aktif', value: stats.active, sublabel: (stats.active ?? 0) > 0 ? 'Sedang berjalan' : undefined, sublabelColor: 'text-blue-600' },
                { label: 'Selesai', value: stats.completed_today },
                { label: 'Gagal', value: stats.failed_today, sublabel: (stats.failed_today ?? 0) > 0 ? 'Perlu ditinjau' : undefined, sublabelColor: 'text-red-600' },
            ]} />

            {/* Status Pills */}
            <div aria-label="Filter status pengiriman" className="mb-4 flex flex-wrap items-center gap-2">
                {statusOptions.map((opt) => {
                    const isActive = (filters.status ?? '') === opt.value;
                    const colorMap: Record<string, string> = {
                        '': 'text-text bg-surface-muted ring-border',
                        waiting_pickup: 'text-amber-600 bg-amber-50 ring-amber-200',
                        picked_up: 'text-blue-600 bg-blue-50 ring-blue-200',
                        delivering: 'text-indigo-600 bg-indigo-50 ring-indigo-200',
                        completed: 'text-emerald-600 bg-emerald-50 ring-emerald-200',
                        failed: 'text-red-600 bg-red-50 ring-red-200',
                    };

                    return (
                        <button key={opt.value} type="button" onClick={() => setFilter('status', opt.value)}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${
                                isActive ? colorMap[opt.value] ?? 'bg-primary/10 text-primary ring-primary/20' : 'bg-surface text-text-muted ring-border hover:bg-mint-wash'
                            }`}>
                            {opt.label}
                        </button>
                    );
                })}
            </div>

            {/* Filter controls */}
            <OwnerFilterCard
                collapsible
                defaultExpanded={false}
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

            {/* Table */}
            {deliveries.data.length === 0 ? (
                <EmptyState
                    icon={<Package aria-hidden="true" className="h-8 w-8" />}
                    title="Tidak ada pengiriman"
                    description="Pengiriman akan muncul di sini setelah kurir di-assign ke pesanan"
                />
            ) : (
                <div className="overflow-x-auto rounded-xl bg-surface shadow-card">
                    <table aria-label="Daftar pengiriman" className="w-full min-w-[600px]">
                        <thead>
                            <tr className="bg-surface-muted/50">
                                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Kode</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Outlet</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Kurir</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Tanggal</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {deliveries.data.map((d: any) => {
                                const isActive = ['delivering', 'picked_up'].includes(d.status);

                                return (
                                    <tr key={d.id} className="border-t border-border/20 transition-colors hover:bg-mint-wash">
                                        <td className="px-4 py-3 font-bold tabular-nums text-text">{d.order?.order_code ?? '-'}</td>
                                        <td className="px-4 py-3 text-text-muted">{d.order?.outlet?.name ?? '-'}</td>
                                        <td className="px-4 py-3 text-text-muted">{d.courier?.name ?? 'Belum ada kurir'}</td>
                                        <td className="px-4 py-3">
                                            <DeliveryStatusBadge status={d.status} />
                                        </td>
                                        <td className="px-4 py-3 text-text-muted">{formatDate(d.assigned_at)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                {isActive && (
                                                    <Button variant="outline" size="sm">
                                                        <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
                                                        Lacak
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => router.visit(`/owner/deliveries/${d.id}`)}
                                                >
                                                    Detail
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <Pagination links={deliveries.links} />
        </OwnerPageShell>
    );
}
