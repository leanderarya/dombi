import { router } from '@inertiajs/react';
import { MapPin } from 'lucide-react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import DeliveryStatusBadge from '@/components/ui/delivery-status-badge';
import Pagination from '@/components/ui/pagination';
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
            {/* Filter controls */}
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
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 transition-all ${
                                isActive ? colorMap[opt.value] ?? 'bg-primary/10 text-primary ring-primary/20' : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                            }`}>
                            {opt.label}
                        </button>
                    );
                })}
                <span className="flex-1" />
                <Select
                    value={filters.courier_id ?? ''}
                    onChange={(e) => setFilter('courier_id', e.target.value)}
                    options={[
                        { value: '', label: 'Semua kurir' },
                        ...couriers.map((c: any) => ({ value: String(c.id), label: c.name })),
                    ]}
                />
            </div>

            {/* KPI Strip */}
            <div className="mb-4 grid grid-cols-4 gap-2">
                <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Total</div>
                    <div className="mt-1 text-base font-bold tabular-nums">{stats.total_today}</div>
                    {(stats.total_today ?? 0) > 0 && <div className="text-[10px] font-medium text-blue-600">Hari ini</div>}
                </div>
                <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Aktif</div>
                    <div className="mt-1 text-base font-bold tabular-nums">{stats.active}</div>
                    {(stats.active ?? 0) > 0 && <div className="text-[10px] font-medium text-blue-600">Sedang berjalan</div>}
                </div>
                <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Selesai</div>
                    <div className="mt-1 text-base font-bold tabular-nums">{stats.completed_today}</div>
                </div>
                <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Gagal</div>
                    <div className="mt-1 text-base font-bold tabular-nums">{stats.failed_today}</div>
                    {(stats.failed_today ?? 0) > 0 && <div className="text-[10px] font-medium text-red-600">Perlu ditinjau</div>}
                </div>
            </div>

            {/* Table */}
            {deliveries.data.length === 0 ? (
                <div className="rounded-lg border border-border bg-white py-10 text-center text-xs text-text-muted">
                    Tidak ada pengiriman
                </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                    {/* Header */}
                    <div className="grid grid-cols-[100px_1fr_120px_100px_80px] items-center gap-3 bg-[#fafafa] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                        <span>Kode</span><span>Outlet / Kurir</span><span>Status</span><span>Tanggal</span><span />
                    </div>
                    {/* Rows */}
                    {deliveries.data.map((d: any) => {
                        const isActive = ['delivering', 'picked_up'].includes(d.status);
                        return (
                            <div key={d.id}
                                className="grid grid-cols-[100px_1fr_120px_100px_80px] items-center gap-3 border-t border-[#f0f0f0] px-3 py-2 text-xs transition-colors last:border-t-0 hover:bg-surface-muted">
                                <span className="font-bold tabular-nums text-text">{d.order?.order_code ?? '-'}</span>
                                <span className="truncate text-text-muted">{d.order?.outlet?.name ?? '-'} · {d.courier?.name ?? 'Belum ada kurir'}</span>
                                <span><DeliveryStatusBadge status={d.status} /></span>
                                <span className="text-text-muted">{formatDate(d.assigned_at)}</span>
                                <div className="flex items-center gap-1 justify-end">
                                    {isActive && (
                                        <span className="inline-flex items-center gap-0.5 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                                            <MapPin className="h-3 w-3" />
                                            Lacak
                                        </span>
                                    )}
                                    <button type="button" onClick={() => router.visit(`/owner/deliveries/${d.id}`)}
                                        className="rounded-md px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary-light">
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
