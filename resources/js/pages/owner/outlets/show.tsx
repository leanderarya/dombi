import { Link, router } from '@inertiajs/react';
import {
    Calendar,
    Clock,
    DollarSign,
    History,
    MapPin,
    Package,
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
import { formatCurrency, formatDate } from '@/lib/format';

const OutletLocationMap = lazy(
    () => import('@/components/owner/outlet-location-map'),
);

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
            <div className="mx-auto max-w-5xl">
                {/* Informasi Outlet + Lokasi */}
                <SectionCard label="Informasi Outlet">
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
                            {outlet.kelurahan ?? '-'} · {outlet.kecamatan ?? '-'}
                            {outlet.city ? ` · ${outlet.city}` : ''}
                        </p>
                        <div className="mt-3">
                            <Suspense
                                fallback={
                                    <div className="flex h-[280px] items-center justify-center rounded-xl border border-border bg-surface-muted text-xs font-semibold text-text-muted">
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
                <SectionCard label="Jam Operasional" labelRight={<Clock className="h-4 w-4 text-text-subtle" />}>
                    <OperatingHoursManager
                        outletId={outlet.id}
                        initialHours={operatingHours ?? []}
                    />
                </SectionCard>

                {/* Hari Libur */}
                <SectionCard label="Hari Libur" labelRight={<Calendar className="h-4 w-4 text-text-subtle" />}>
                    <HolidayManager
                        outletId={outlet.id}
                        initialHolidays={holidays ?? []}
                    />
                </SectionCard>

                {/* Area Layanan */}
                {outlet.delivery_radius_km && (
                    <SectionCard label="Area Layanan" labelRight={<MapPin className="h-4 w-4 text-text-subtle" />}>
                        <p className="text-sm font-medium text-text">
                            {outlet.delivery_radius_km} km
                        </p>
                        <p className="mt-1 text-xs text-text-muted">
                            Customer di luar radius ini tidak dapat memesan
                            delivery.
                        </p>
                    </SectionCard>
                )}

                {/* Produk Outlet */}
                <SectionCard label="Produk Outlet" labelRight={<Package className="h-4 w-4 text-text-subtle" />}>
                    <p className="mb-3 text-xs text-text-muted">
                        Kelola produk, stok, dan restock outlet ini.
                    </p>
                    <OutletProducts outletId={outlet.id} />
                </SectionCard>

                {/* Settlement Outlet */}
                {settlementSummary && (
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
                                        const statusBadge: Record<string, { label: string; className: string }> = {
                                            pending: { label: 'Pending', className: 'bg-surface-muted text-text-muted' },
                                            due_today: { label: 'Jatuh Tempo', className: 'bg-amber-50 text-amber-700' },
                                            overdue: { label: 'Terlambat', className: 'bg-red-50 text-red-700' },
                                            paid: { label: 'Lunas', className: 'bg-emerald-50 text-emerald-700' },
                                        };
                                        const badge = statusBadge[s.status] ?? statusBadge.pending;

                                        return (
                                            <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2">
                                                <div className="text-xs text-text-muted">{s.period_date}</div>
                                                <div className="text-xs tabular-nums font-semibold">{formatCurrency(s.amount_due)}</div>
                                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>{badge.label}</span>
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
                                            {log.old_value ?? '-'} →{' '}
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
