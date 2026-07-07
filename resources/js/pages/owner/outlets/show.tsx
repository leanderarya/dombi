import { Link, router } from '@inertiajs/react';
import {
    Calendar,
    Clock,
    DollarSign,
    Edit3,
    History,
    MapPin,
    Package,
    RefreshCw,
    ShoppingBag,
    Trash2,
    User,
} from 'lucide-react';
import { lazy, Suspense } from 'react';
import HolidayManager from '@/components/owner/holiday-manager';
import OperatingHoursManager from '@/components/owner/operating-hours-manager';
import OutletProducts from '@/components/owner/outlet-products';
import OutletStatusBadge from '@/components/owner/outlet-status-badge';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const OutletLocationMap = lazy(
    () => import('@/components/owner/outlet-location-map'),
);

function getOutletStatusMeta(outlet: any): { label: string; variant: 'success' | 'warning' | 'info' | 'neutral'; color: string } {
    if (outlet.status !== 'active') {
return { label: 'Nonaktif', variant: 'neutral', color: 'text-gray-600' };
}

    if (Number(outlet.low_stock_count) > 0) {
return { label: 'Stok Rendah', variant: 'warning', color: 'text-amber-600' };
}

    if (Number(outlet.active_orders_count) >= 3) {
return { label: 'Sibuk', variant: 'info', color: 'text-blue-600' };
}

    return { label: 'Aktif', variant: 'success', color: 'text-emerald-600' };
}

export default function OutletShow({
    outlet,
    activeDeliveriesCount,
    holidays,
    operatingHours,
    auditLogs,
    settlementSummary,
}: any) {
    const location =
        outlet.latitude && outlet.longitude
            ? { lat: Number(outlet.latitude), lng: Number(outlet.longitude) }
            : null;

    const statusMeta = getOutletStatusMeta(outlet);

    const handleArchive = () => {
        if (
            !confirm(
                'Arsipkan outlet ini? Outlet tidak akan muncul ke customer dan tidak menerima pesanan. Histori tetap tersimpan.',
            )
        ) {
	return;
}

        router.put(`/owner/outlets/${outlet.id}/archive`);
    };

    return (
        <OwnerPageShell
            title={outlet.name}
            subtitle="Detail outlet"
            backHref="/owner/outlets"
            headerRight={
                <div className="flex items-center gap-2">
                    <Link
                        href={`/owner/outlets/${outlet.id}/edit`}
                        className="flex h-8 items-center rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-text-muted transition-colors hover:bg-surface-muted"
                    >
                        Edit
                    </Link>
                    <button
                        type="button"
                        onClick={handleArchive}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                    >
                        <Trash2 className="h-3 w-3" />
                        Arsipkan
                    </button>
                </div>
            }
        >
            <div className="grid gap-3 lg:grid-cols-2">
                {/* Informasi Outlet */}
                <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-text-subtle">Informasi Outlet</div>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h1 className="text-lg font-semibold text-text">{outlet.name ?? '-'}</h1>
                            <p className="mt-0.5 text-xs text-text-muted">{outlet.address ?? '-'}</p>
                            {outlet.phone && <p className="text-xs text-text-muted">{outlet.phone}</p>}
                        </div>
                        <OutletStatusBadge status={outlet.status ?? 'active'} />
                    </div>

                    {outlet.pic_name && (
                        <div className="mt-3 rounded-lg border border-border bg-surface-muted p-2">
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-subtle">
                                <User className="h-3 w-3" />
                                Penanggung Jawab
                            </div>
                            <div className="mt-1 text-xs font-medium text-text">{outlet.pic_name}</div>
                            {outlet.pic_position && <div className="text-[11px] text-text-muted">{outlet.pic_position}</div>}
                            {outlet.pic_phone && <div className="text-[11px] text-text-muted">{outlet.pic_phone}</div>}
                        </div>
                    )}

                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <Metric label="Pesanan Aktif" value={outlet.active_orders_count ?? 0} />
                        <Metric label="Pengiriman" value={activeDeliveriesCount ?? 0} />
                        <Metric label="Hari Ini" value={outlet.today_orders_count ?? 0} />
                    </div>
                </div>

                {/* Status + Quick Actions */}
                <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-text-subtle">Status & Aksi</div>
                    <div className="flex items-center gap-2">
                        <OutletStatusBadge status={outlet.status ?? 'active'} />
                        {Number(outlet.low_stock_count) > 0 && <StatusBadge variant="warning" size="sm">Stok Rendah</StatusBadge>}
                        {Number(outlet.active_orders_count) >= 3 && <StatusBadge variant="info" size="sm">Sibuk</StatusBadge>}
                    </div>
                    <div className="mt-3 space-y-1.5">
                        <Link
                            href={`/owner/outlets/${outlet.id}/edit`}
                            className="flex h-8 w-full items-center gap-2 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-text transition-colors hover:bg-surface-muted"
                        >
                            <Edit3 className="h-3.5 w-3.5 text-text-subtle" />
                            Edit Outlet
                        </Link>
                        <Link
                            href={`/owner/inventories?outlet_id=${outlet.id}`}
                            className="flex h-8 w-full items-center gap-2 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-text transition-colors hover:bg-surface-muted"
                        >
                            <RefreshCw className="h-3.5 w-3.5 text-text-subtle" />
                            Restock
                        </Link>
                        <Link
                            href={`/owner/orders?outlet_id=${outlet.id}`}
                            className="flex h-8 w-full items-center gap-2 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-text transition-colors hover:bg-surface-muted"
                        >
                            <ShoppingBag className="h-3.5 w-3.5 text-text-subtle" />
                            Lihat Pesanan
                        </Link>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <SidebarMetric label="Pesanan Aktif" value={outlet.active_orders_count ?? 0} color="text-blue-600" />
                        <SidebarMetric label="Pengiriman" value={activeDeliveriesCount ?? 0} color="text-emerald-600" />
                        <SidebarMetric label="Hari Ini" value={outlet.today_orders_count ?? 0} color="text-text" />
                        <SidebarMetric label="Stok Rendah" value={outlet.low_stock_count ?? 0} color="text-amber-600" warn={Number(outlet.low_stock_count) > 0} />
                    </div>
                </div>

                {/* Lokasi */}
                <div className="rounded-lg border border-border p-4 lg:col-span-2">
                    <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-text-subtle">Lokasi</div>
                    <p className="text-xs text-text-muted">
                        {outlet.kelurahan ?? '-'} &middot; {outlet.kecamatan ?? '-'}
                        {outlet.city ? ` · ${outlet.city}` : ''}
                    </p>
                    <div className="mt-2">
                        <Suspense
                            fallback={
                                <div className="flex h-40 items-center justify-center rounded-lg border border-border bg-surface-muted text-xs font-semibold text-text-muted">
                                    Memuat peta...
                                </div>
                            }
                        >
                            <OutletLocationMap
                                value={location}
                                onChange={() => undefined}
                                readOnly
                            />
                        </Suspense>
                    </div>
                </div>

                {/* Jam Operasional */}
                <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-text-subtle">
                        <Clock className="h-3.5 w-3.5" />
                        Jam Operasional
                    </div>
                    <OperatingHoursManager
                        outletId={outlet.id}
                        initialHours={operatingHours ?? []}
                    />
                </div>

                {/* Hari Libur */}
                <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-text-subtle">
                        <Calendar className="h-3.5 w-3.5" />
                        Hari Libur
                    </div>
                    <HolidayManager
                        outletId={outlet.id}
                        initialHolidays={holidays ?? []}
                    />
                </div>

                {/* Area Layanan */}
                {outlet.delivery_radius_km && (
                    <div className="rounded-lg border border-border p-4">
                        <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-text-subtle">
                            <MapPin className="h-3.5 w-3.5" />
                            Area Layanan
                        </div>
                        <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-xs last:border-b-0">
                            <span className="text-text-muted">Radius</span>
                            <span className="text-text">{outlet.delivery_radius_km} km</span>
                        </div>
                        <p className="mt-1 text-[11px] text-text-muted">
                            Customer di luar radius ini tidak dapat memesan delivery.
                        </p>
                    </div>
                )}

                {/* Produk Outlet */}
                <div className="rounded-lg border border-border p-4 lg:col-span-2">
                    <div className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-text-subtle">
                        <div className="flex items-center gap-2">
                            <Package className="h-3.5 w-3.5" />
                            Produk Outlet
                        </div>
                    </div>
                    <p className="mb-2 text-[11px] text-text-muted">Kelola produk, stok, dan restock outlet ini.</p>
                    <OutletProducts outletId={outlet.id} />
                </div>

                {/* Settlement Outlet */}
                {settlementSummary && Number(settlementSummary.outstanding) > 0 && (
                    <div className="rounded-lg border border-border p-4 lg:col-span-2">
                        <div className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-text-subtle">
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-3.5 w-3.5" />
                                Settlement Outlet
                            </div>
                            <Link href={`/owner/finance/settlements/${outlet.id}`} className="text-[11px] font-semibold text-primary hover:text-primary">
                                Lihat Semua
                            </Link>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-lg border border-border bg-surface-muted p-2">
                                <div className="text-[10px] font-bold uppercase tracking-wide text-text-subtle">Outstanding</div>
                                <div className="mt-0.5 text-xs font-bold tabular-nums text-red-600">{formatCurrency(settlementSummary.outstanding)}</div>
                            </div>
                            <div className="rounded-lg border border-border bg-surface-muted p-2">
                                <div className="text-[10px] font-bold uppercase tracking-wide text-text-subtle">Terlambat</div>
                                <div className="mt-0.5 text-xs font-bold tabular-nums text-amber-600">{settlementSummary.overdue_count}</div>
                            </div>
                            <div className="rounded-lg border border-border bg-surface-muted p-2">
                                <div className="text-[10px] font-bold uppercase tracking-wide text-text-subtle">Dibayar</div>
                                <div className="mt-0.5 text-xs font-bold tabular-nums text-emerald-600">{formatCurrency(settlementSummary.paid_this_month)}</div>
                            </div>
                        </div>

                        {settlementSummary.recent_settlements?.length > 0 && (
                            <div className="mt-2">
                                <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-subtle">Settlement Terakhir</div>
                                {settlementSummary.recent_settlements.map((s: any) => {
                                    const variantMap: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
                                        pending: 'neutral',
                                        due_today: 'warning',
                                        overdue: 'danger',
                                        paid: 'success',
                                    };
                                    const labelMap: Record<string, string> = {
                                        pending: 'Pending',
                                        due_today: 'Jatuh Tempo',
                                        overdue: 'Terlambat',
                                        paid: 'Lunas',
                                    };

                                    return (
                                        <div key={s.id} className="flex justify-between border-b border-[#f5f5f5] py-1 text-xs last:border-b-0">
                                            <span className="text-text-muted">{s.period_date}</span>
                                            <span className="tabular-nums font-semibold text-text">{formatCurrency(s.amount_due)}</span>
                                            <StatusBadge variant={variantMap[s.status] ?? 'neutral'} size="sm">{labelMap[s.status] ?? s.status}</StatusBadge>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Riwayat Perubahan */}
                {auditLogs && auditLogs.length > 0 && (
                    <div className="rounded-lg border border-border p-4 lg:col-span-2">
                        <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-text-subtle">
                            <History className="h-3.5 w-3.5" />
                            Riwayat Perubahan
                        </div>
                        {auditLogs.map((log: any) => (
                            <div key={log.id} className="flex justify-between border-b border-[#f5f5f5] py-1 text-xs last:border-b-0">
                                <span className="text-text-muted">{log.field ?? '-'}</span>
                                <span className="text-text">{log.old_value ?? '-'} &rarr; {log.new_value ?? '-'}</span>
                                <span className="text-text-subtle">{log.changed_by?.name ?? '-'} · {formatDate(log.created_at)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </OwnerPageShell>
    );
}

function Metric({
    label,
    value,
    warn = false,
}: {
    label: string;
    value: number;
    warn?: boolean;
}) {
    return (
        <div
            className={`rounded-lg border p-2 ${warn ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-border bg-surface-muted text-text-muted'}`}
        >
            <div className="text-sm font-semibold tabular-nums">
                {value ?? 0}
            </div>
            <div className="text-[10px] font-semibold tracking-wide uppercase opacity-70">
                {label}
            </div>
        </div>
    );
}

function SidebarMetric({
    label,
    value,
    color,
    warn = false,
}: {
    label: string;
    value: number;
    color: string;
    warn?: boolean;
}) {
    return (
        <div className={cn(
            'rounded-lg border p-2',
            warn ? 'border-amber-200 bg-amber-50' : 'border-border bg-surface-muted',
        )}>
            <div className={cn('text-sm font-bold tabular-nums', color)}>{value}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-subtle">{label}</div>
        </div>
    );
}
