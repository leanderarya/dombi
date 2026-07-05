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
    TrendingDown,
    TrendingUp,
    Trash2,
    User,
} from 'lucide-react';
import { lazy, Suspense } from 'react';
import HolidayManager from '@/components/owner/holiday-manager';
import OperatingHoursManager from '@/components/owner/operating-hours-manager';
import OutletProducts from '@/components/owner/outlet-products';
import OutletStatusBadge from '@/components/owner/outlet-status-badge';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import SectionCard from '@/components/ui/section-card';
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
                        className="flex h-9 items-center rounded-lg border border-border bg-white px-3 text-sm font-semibold text-text-muted transition-colors hover:bg-surface-muted"
                    >
                        Edit
                    </Link>
                    <button
                        type="button"
                        onClick={handleArchive}
                        className="flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Arsipkan
                    </button>
                </div>
            }
        >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
                {/* Left: Main Content */}
                <div className="min-w-0">
                    {/* Informasi Outlet + Lokasi */}
                    <SectionCard
                        label="Informasi Outlet"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h1 className="text-2xl font-semibold text-text">
                                    {outlet.name ?? '-'}
                                </h1>
                                <p className="mt-1 text-xs leading-5 text-text-muted">
                                    {outlet.address ?? '-'}
                                </p>
                                {outlet.phone && (
                                    <p className="mt-1 text-xs text-text-muted">
                                        {outlet.phone}
                                    </p>
                                )}
                            </div>
                            <OutletStatusBadge status={outlet.status ?? 'active'} />
                        </div>

                        {outlet.pic_name && (
                            <div className="mt-4 rounded-lg border border-border bg-surface-muted p-3">
                                <div className="flex items-center gap-2 text-xs text-text-muted">
                                    <User className="h-3.5 w-3.5" />
                                    <span className="font-semibold tracking-wider uppercase">
                                        Penanggung Jawab
                                    </span>
                                </div>
                                <div className="mt-1.5 text-sm font-medium text-text">
                                    {outlet.pic_name}
                                </div>
                                {outlet.pic_position && (
                                    <div className="text-xs text-text-muted">
                                        {outlet.pic_position}
                                    </div>
                                )}
                                {outlet.pic_phone && (
                                    <div className="text-xs text-text-muted">
                                        {outlet.pic_phone}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                            <Metric
                                label="Pesanan Aktif"
                                value={outlet.active_orders_count ?? 0}
                            />
                            <Metric
                                label="Pengiriman Aktif"
                                value={activeDeliveriesCount ?? 0}
                            />
                            <Metric
                                label="Pesanan Hari Ini"
                                value={outlet.today_orders_count ?? 0}
                            />
                        </div>

                        <div className="mt-4 border-t border-border pt-4">
                            <h3 className="text-sm font-semibold text-text">
                                Lokasi
                            </h3>
                            <p className="mt-1 text-xs text-text-muted">
                                {outlet.kelurahan ?? '-'} &middot; {outlet.kecamatan ?? '-'}
                                {outlet.city ? ` · ${outlet.city}` : ''}
                            </p>
                            <div className="mt-3">
                                <Suspense
                                    fallback={
                                        <div className="flex h-70 items-center justify-center rounded-xl border border-border bg-surface-muted text-xs font-semibold text-text-muted">
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
                    </SectionCard>

                    {/* Jam Operasional */}
                    <CollapsibleSection icon={<Clock className="h-4 w-4 text-text-subtle" />} label="Jam Operasional">
                        <OperatingHoursManager
                            outletId={outlet.id}
                            initialHours={operatingHours ?? []}
                        />
                    </CollapsibleSection>

                    {/* Hari Libur */}
                    <CollapsibleSection icon={<Calendar className="h-4 w-4 text-text-subtle" />} label="Hari Libur">
                        <HolidayManager
                            outletId={outlet.id}
                            initialHolidays={holidays ?? []}
                        />
                    </CollapsibleSection>

                    {/* Area Layanan */}
                    {outlet.delivery_radius_km && (
                        <CollapsibleSection icon={<MapPin className="h-4 w-4 text-text-subtle" />} label="Area Layanan">
                            <p className="text-sm font-medium text-text">
                                {outlet.delivery_radius_km} km
                            </p>
                            <p className="mt-1 text-xs text-text-muted">
                                Customer di luar radius ini tidak dapat memesan
                                delivery.
                            </p>
                        </CollapsibleSection>
                    )}

                    {/* Produk Outlet */}
                    <SectionCard label="Produk Outlet" labelRight={<Package className="h-4 w-4 text-text-subtle" />}>
                        <p className="mb-3 text-xs text-text-muted">
                            Kelola produk, stok, dan restock outlet ini.
                        </p>
                        <OutletProducts outletId={outlet.id} />
                    </SectionCard>

                    {/* Settlement Outlet */}
                    {settlementSummary && Number(settlementSummary.outstanding) > 0 && (
                        <SectionCard
                            label="Settlement Outlet"
                            labelRight={
                                <Link
                                    href={`/owner/finance/settlements/${outlet.id}`}
                                    className="text-xs font-semibold text-primary hover:text-primary"
                                >
                                    Lihat Semua
                                </Link>
                            }
                        >
                            <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-lg border border-border bg-surface-muted p-3">
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Outstanding</div>
                                    <div className="mt-1 text-sm font-bold tabular-nums text-red-600">{formatCurrency(settlementSummary.outstanding)}</div>
                                </div>
                                <div className="rounded-lg border border-border bg-surface-muted p-3">
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Terlambat</div>
                                    <div className="mt-1 text-sm font-bold tabular-nums text-amber-600">{settlementSummary.overdue_count}</div>
                                </div>
                                <div className="rounded-lg border border-border bg-surface-muted p-3">
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Dibayar Bulan Ini</div>
                                    <div className="mt-1 text-sm font-bold tabular-nums text-emerald-600">{formatCurrency(settlementSummary.paid_this_month)}</div>
                                </div>
                            </div>

                            {settlementSummary.recent_settlements?.length > 0 && (
                                <div className="mt-3">
                                    <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-subtle">Settlement Terakhir</div>
                                    <div className="space-y-1.5">
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
                                                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2">
                                                    <div className="text-xs text-text-muted">{s.period_date}</div>
                                                    <div className="text-xs tabular-nums font-semibold">{formatCurrency(s.amount_due)}</div>
                                                    <StatusBadge variant={variantMap[s.status] ?? 'neutral'} size="sm">{labelMap[s.status] ?? s.status}</StatusBadge>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </SectionCard>
                    )}

                    {/* Riwayat Perubahan */}
                    {auditLogs && auditLogs.length > 0 && (
                        <SectionCard label="Riwayat Perubahan" labelRight={<History className="h-4 w-4 text-text-subtle" />}>
                            <div className="space-y-2">
                                {auditLogs.map((log: any) => (
                                    <div
                                        key={log.id}
                                        className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-muted p-3"
                                    >
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-text">
                                                {log.field ?? '-'}
                                            </div>
                                            <div className="mt-0.5 text-xs text-text-muted">
                                                {log.old_value ?? '-'} &rarr;{' '}
                                                {log.new_value ?? '-'}
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-right text-xs text-text-subtle">
                                            <div>{log.changed_by?.name ?? '-'}</div>
                                            <div>{formatDate(log.created_at)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>
                    )}
                </div>

                {/* Right: Sidebar */}
                <aside className="hidden lg:block">
                    <div className="sticky top-4 space-y-4">
                        {/* Status Card */}
                        <div className="rounded-xl border border-border bg-white p-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-text-subtle">Status Outlet</h3>
                            <div className="mt-2 flex items-center gap-2">
                                <OutletStatusBadge status={outlet.status ?? 'active'} />
                                {Number(outlet.low_stock_count) > 0 && (
                                    <StatusBadge variant="warning" size="sm">Stok Rendah</StatusBadge>
                                )}
                                {Number(outlet.active_orders_count) >= 3 && (
                                    <StatusBadge variant="info" size="sm">Sibuk</StatusBadge>
                                )}
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="rounded-xl border border-border bg-white p-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-text-subtle">Aksi Cepat</h3>
                            <div className="mt-3 space-y-2">
                                <Link
                                    href={`/owner/outlets/${outlet.id}/edit`}
                                    className="flex h-10 w-full items-center gap-2.5 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-text transition-colors hover:bg-surface-muted"
                                >
                                    <Edit3 className="h-4 w-4 text-text-subtle" />
                                    Edit Outlet
                                </Link>
                                <Link
                                    href={`/owner/inventories?outlet_id=${outlet.id}`}
                                    className="flex h-10 w-full items-center gap-2.5 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-text transition-colors hover:bg-surface-muted"
                                >
                                    <RefreshCw className="h-4 w-4 text-text-subtle" />
                                    Restock
                                </Link>
                                <Link
                                    href={`/owner/orders?outlet_id=${outlet.id}`}
                                    className="flex h-10 w-full items-center gap-2.5 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-text transition-colors hover:bg-surface-muted"
                                >
                                    <ShoppingBag className="h-4 w-4 text-text-subtle" />
                                    Lihat Pesanan
                                </Link>
                            </div>
                        </div>

                        {/* Key Metrics */}
                        <div className="rounded-xl border border-border bg-white p-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-text-subtle">Metrik Hari Ini</h3>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <SidebarMetric
                                    label="Pesanan Aktif"
                                    value={outlet.active_orders_count ?? 0}
                                    color="text-blue-600"
                                />
                                <SidebarMetric
                                    label="Pengiriman"
                                    value={activeDeliveriesCount ?? 0}
                                    color="text-emerald-600"
                                />
                                <SidebarMetric
                                    label="Hari Ini"
                                    value={outlet.today_orders_count ?? 0}
                                    color="text-text"
                                />
                                <SidebarMetric
                                    label="Stok Rendah"
                                    value={outlet.low_stock_count ?? 0}
                                    color="text-amber-600"
                                    warn={Number(outlet.low_stock_count) > 0}
                                />
                            </div>
                        </div>

                        {/* PIC Info */}
                        {outlet.pic_name && (
                            <div className="rounded-xl border border-border bg-white p-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-text-subtle">Penanggung Jawab</h3>
                                <div className="mt-2">
                                    <div className="text-sm font-medium text-text">{outlet.pic_name}</div>
                                    {outlet.pic_position && (
                                        <div className="text-xs text-text-muted">{outlet.pic_position}</div>
                                    )}
                                    {outlet.pic_phone && (
                                        <div className="text-xs text-text-muted">{outlet.pic_phone}</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </aside>
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
            className={`rounded-lg border p-3 ${warn ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-border bg-surface-muted text-text-muted'}`}
        >
            <div className="text-lg font-semibold tabular-nums">
                {value ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] font-semibold tracking-wide uppercase opacity-70">
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
            'rounded-lg border p-2.5',
            warn ? 'border-amber-200 bg-amber-50' : 'border-border bg-surface-muted',
        )}>
            <div className={cn('text-lg font-bold tabular-nums', color)}>{value}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-subtle">{label}</div>
        </div>
    );
}

function CollapsibleSection({
    icon,
    label,
    children,
}: {
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <details className="group mb-6">
            <summary className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-white px-5 py-4 text-sm font-semibold text-text transition-colors hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
                <div className="flex items-center gap-2">
                    {icon}
                    {label}
                </div>
                <svg className="h-4 w-4 text-text-subtle transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </summary>
            <div className="mt-2 rounded-xl border border-border bg-white p-4">
                {children}
            </div>
        </details>
    );
}
