import { router } from '@inertiajs/react';
import { CheckCircle, MapPin, Package, Truck, XCircle } from 'lucide-react';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import OwnerTable from '@/components/owner/owner-table';
import { Button } from '@/components/ui/button';
import DeliveryStatusBadge from '@/components/ui/delivery-status-badge';
import EmptyState from '@/components/ui/empty-state';
import FilterChips from '@/components/ui/filter-chips';
import Pagination from '@/components/ui/pagination';
import { SkeletonPage } from '@/components/ui/skeleton';
import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
} from '@/components/ui/table';
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
            <OwnerPageShell
                title="Pengiriman"
                subtitle="Lacak status pengiriman pesanan"
            >
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
            subtitle="Lacak status pengiriman pesanan"
        >
            {/* KPI Strip */}
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                            Pengiriman Aktif
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB]/10 text-[#2563EB]">
                            <Truck className="h-5 w-5" />
                        </span>
                    </div>
                    <div className="font-heading text-xl font-bold text-text tabular-nums sm:text-2xl">
                        {stats.active ?? 0}
                    </div>
                    <p className="text-[11px] text-text-muted">
                        Sedang berjalan
                    </p>
                </div>

                <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                            Selesai Hari Ini
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                            <CheckCircle className="h-5 w-5" />
                        </span>
                    </div>
                    <div className="font-heading text-xl font-bold text-text tabular-nums sm:text-2xl">
                        {stats.completed_today ?? 0}
                    </div>
                    <p className="text-[11px] text-text-muted">
                        Berhasil dikirim
                    </p>
                </div>

                <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                            Gagal
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
                            <XCircle className="h-5 w-5" />
                        </span>
                    </div>
                    <div className="font-heading text-xl font-bold text-red-600 tabular-nums sm:text-2xl">
                        {stats.failed_today ?? 0}
                    </div>
                    <p className="text-[11px] text-text-muted">
                        Perlu ditinjau
                    </p>
                </div>

                <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                            Total Hari Ini
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0D9488]/10 text-[#0D9488]">
                            <Package className="h-5 w-5" />
                        </span>
                    </div>
                    <div className="font-heading text-xl font-bold text-text tabular-nums sm:text-2xl">
                        {stats.total_today ?? 0}
                    </div>
                    <p className="text-[11px] text-text-muted">
                        Semua pengiriman
                    </p>
                </div>
            </div>

            {/* Status Filter Chips */}
            <div
                aria-label="Filter status pengiriman"
                className="mb-4 flex flex-wrap items-center gap-2"
            >
                <FilterChips
                    options={statusOptions.map((o) => ({
                        key: o.value,
                        label: o.label,
                    }))}
                    active={filters.status ?? ''}
                    onChange={(key) => setFilter('status', key)}
                    variant="ring"
                    size="sm"
                />
            </div>

            {/* Filter controls */}
            <OwnerFilterCard
                collapsible
                defaultExpanded={false}
                searchPlaceholder="Cari kode atau pelanggan..."
                searchValue={filters.search ?? ''}
                onSearch={(val) => setFilter('search', val)}
                outletOptions={outlets?.map((o: any) => ({
                    value: String(o.id),
                    label: o.name,
                }))}
                outletValue={filters.outlet_id ?? ''}
                onOutletChange={(val) => setFilter('outlet_id', val)}
                courierOptions={couriers.map((c: any) => ({
                    value: String(c.id),
                    label: c.name,
                }))}
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
                <OwnerTable>
                    <Table
                        aria-label="Daftar pengiriman"
                        className="w-full min-w-[600px]"
                    >
                        <TableHeader>
                            <tr className="bg-surface-muted/50">
                                <TableHead className="px-4 py-3 text-left text-xs font-semibold text-text-muted">
                                    Kode
                                </TableHead>
                                <TableHead className="px-4 py-3 text-left text-xs font-semibold text-text-muted">
                                    Outlet
                                </TableHead>
                                <TableHead className="px-4 py-3 text-left text-xs font-semibold text-text-muted">
                                    Kurir
                                </TableHead>
                                <TableHead className="px-4 py-3 text-left text-xs font-semibold text-text-muted">
                                    Status
                                </TableHead>
                                <TableHead className="px-4 py-3 text-left text-xs font-semibold text-text-muted">
                                    Tanggal
                                </TableHead>
                                <TableHead className="px-4 py-3 text-right text-xs font-semibold text-text-muted">
                                    Aksi
                                </TableHead>
                            </tr>
                        </TableHeader>
                        <TableBody>
                            {deliveries.data.map((d: any) => {
                                const isActive = [
                                    'delivering',
                                    'picked_up',
                                ].includes(d.status);

                                return (
                                    <TableRow
                                        key={d.id}
                                        className="border-t border-border/20 transition-colors hover:bg-emerald-50/40"
                                    >
                                        <TableCell className="px-4 py-3 font-mono font-bold text-primary tabular-nums">
                                            {d.order?.order_code ?? '-'}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-text-muted">
                                            {d.order?.outlet?.name ?? '-'}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-text-muted">
                                            {d.courier?.name ??
                                                'Belum ada kurir'}
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <DeliveryStatusBadge
                                                status={d.status}
                                            />
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-text-muted">
                                            {formatDate(d.assigned_at)}
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                {isActive && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                    >
                                                        <MapPin
                                                            aria-hidden="true"
                                                            className="h-3.5 w-3.5"
                                                        />
                                                        Lacak
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        router.visit(
                                                            `/owner/deliveries/${d.id}`,
                                                        )
                                                    }
                                                >
                                                    Detail
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </OwnerTable>
            )}

            <Pagination links={deliveries.links} />
        </OwnerPageShell>
    );
}
