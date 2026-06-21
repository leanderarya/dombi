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
                        className="flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
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
            <div className="mx-auto max-w-5xl space-y-4">
                {/* Section 1: Informasi Outlet */}
                <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                                Informasi Outlet
                            </p>
                            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                                {outlet.name ?? '-'}
                            </h1>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                                {outlet.address ?? '-'}
                            </p>
                            {outlet.phone && (
                                <p className="mt-1 text-xs text-slate-500">
                                    {outlet.phone}
                                </p>
                            )}
                        </div>
                        <OutletStatusBadge status={outlet.status ?? 'active'} />
                    </div>

                    {outlet.pic_name && (
                        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <User className="h-3.5 w-3.5" />
                                <span className="font-semibold tracking-wider uppercase">
                                    Penanggung Jawab
                                </span>
                            </div>
                            <div className="mt-1.5 text-sm font-medium text-slate-900">
                                {outlet.pic_name}
                            </div>
                            {outlet.pic_position && (
                                <div className="text-xs text-slate-500">
                                    {outlet.pic_position}
                                </div>
                            )}
                            {outlet.pic_phone && (
                                <div className="text-xs text-slate-500">
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
                </section>

                {/* Section 2: Lokasi */}
                <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <h2 className="text-base font-semibold text-slate-900">
                        Lokasi
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                        {outlet.kelurahan ?? '-'} · {outlet.kecamatan ?? '-'}
                        {outlet.city ? ` · ${outlet.city}` : ''}
                    </p>
                    <div className="mt-3">
                        <Suspense
                            fallback={
                                <div className="flex h-[280px] items-center justify-center rounded-xl border border-slate-300 bg-[#F8FAFC] text-xs font-semibold text-slate-500">
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
                </section>

                {/* Section 3: Jam Operasional */}
                <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-400" />
                        <h2 className="text-base font-semibold text-slate-900">
                            Jam Operasional
                        </h2>
                    </div>
                    <div className="mt-4">
                        <OperatingHoursManager
                            outletId={outlet.id}
                            initialHours={operatingHours ?? []}
                        />
                    </div>
                </section>

                {/* Section 4: Hari Libur */}
                <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <h2 className="text-base font-semibold text-slate-900">
                            Hari Libur
                        </h2>
                    </div>
                    <div className="mt-4">
                        <HolidayManager
                            outletId={outlet.id}
                            initialHolidays={holidays ?? []}
                        />
                    </div>
                </section>

                {/* Section 5: Area Layanan */}
                {outlet.delivery_radius_km && (
                    <section className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-slate-400" />
                            <h2 className="text-base font-semibold text-slate-900">
                                Area Layanan
                            </h2>
                        </div>
                        <p className="mt-2 text-sm font-medium text-slate-900">
                            {outlet.delivery_radius_km} km
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                            Customer di luar radius ini tidak dapat memesan
                            delivery.
                        </p>
                    </section>
                )}

                {/* Section 6: Produk Outlet (unified) */}
                <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-slate-400" />
                        <h2 className="text-base font-semibold text-slate-900">
                            Produk Outlet
                        </h2>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                        Kelola produk, stok, dan restock outlet ini.
                    </p>
                    <div className="mt-4">
                        <OutletProducts outletId={outlet.id} />
                    </div>
                </section>

                {/* Section 7: Settlement Outlet */}
                {settlementSummary && (
                    <section className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-slate-400" />
                                <h2 className="text-base font-semibold text-slate-900">Settlement Outlet</h2>
                            </div>
                            <Link
                                href={`/owner/finance/settlements/${outlet.id}`}
                                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                            >
                                Lihat Semua
                            </Link>
                        </div>

                        {/* Summary Cards */}
                        <div className="mt-3 grid grid-cols-3 gap-2">
                            <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-3">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Outstanding</div>
                                <div className="mt-1 text-sm font-bold tabular-nums text-red-600">{formatCurrency(settlementSummary.outstanding)}</div>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-3">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Terlambat</div>
                                <div className="mt-1 text-sm font-bold tabular-nums text-amber-600">{settlementSummary.overdue_count}</div>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-3">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Dibayar Bulan Ini</div>
                                <div className="mt-1 text-sm font-bold tabular-nums text-emerald-600">{formatCurrency(settlementSummary.paid_this_month)}</div>
                            </div>
                        </div>

                        {/* Recent Settlements */}
                        {settlementSummary.recent_settlements?.length > 0 && (
                            <div className="mt-3">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Settlement Terakhir</div>
                                <div className="space-y-1.5">
                                    {settlementSummary.recent_settlements.map((s: any) => {
                                        const statusBadge: Record<string, { label: string; className: string }> = {
                                            pending: { label: 'Pending', className: 'bg-slate-100 text-slate-600' },
                                            due_today: { label: 'Jatuh Tempo', className: 'bg-amber-50 text-amber-700' },
                                            overdue: { label: 'Terlambat', className: 'bg-red-50 text-red-700' },
                                            paid: { label: 'Lunas', className: 'bg-emerald-50 text-emerald-700' },
                                        };
                                        const badge = statusBadge[s.status] ?? statusBadge.pending;

                                        return (
                                            <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-[#F8FAFC] px-3 py-2">
                                                <div className="text-xs text-slate-600">{s.period_date}</div>
                                                <div className="text-xs tabular-nums font-semibold">{formatCurrency(s.amount_due)}</div>
                                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>{badge.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* Section 8: Riwayat Perubahan */}
                {auditLogs && auditLogs.length > 0 && (
                    <section className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center gap-2">
                            <History className="h-4 w-4 text-slate-400" />
                            <h2 className="text-base font-semibold text-slate-900">
                                Riwayat Perubahan
                            </h2>
                        </div>
                        <div className="mt-3 space-y-2">
                            {auditLogs.map((log: any) => (
                                <div
                                    key={log.id}
                                    className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-[#F8FAFC] p-3"
                                >
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-slate-900">
                                            {log.field ?? '-'}
                                        </div>
                                        <div className="mt-0.5 text-xs text-slate-500">
                                            {log.old_value ?? '-'} →{' '}
                                            {log.new_value ?? '-'}
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-right text-xs text-slate-400">
                                        <div>{log.changed_by?.name ?? '-'}</div>
                                        <div>{formatDate(log.created_at)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
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
            className={`rounded-lg border p-3 ${warn ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-[#F8FAFC] text-slate-700'}`}
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
