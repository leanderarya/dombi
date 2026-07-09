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
import { lazy, Suspense, useState } from 'react';
import HolidayManager from '@/components/owner/holiday-manager';
import OperatingHoursManager from '@/components/owner/operating-hours-manager';
import OutletProducts from '@/components/owner/outlet-products';
import OutletStatusBadge from '@/components/owner/outlet-status-badge';
import OwnerDetailRow from '@/components/owner/owner-detail-row';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency, formatDate } from '@/lib/format';

const OutletLocationMap = lazy(() => import('@/components/owner/outlet-location-map'));

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

    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

    if (!outlet) {
        return (
            <OwnerPageShell title="Memuat..." subtitle="Detail outlet" backHref="/owner/outlets">
                <div className="grid gap-4 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="rounded-lg border border-border p-4 space-y-3">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-6 w-3/4" />
                        </div>
                        <div className="rounded-lg border border-border p-4 space-y-3">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="rounded-lg border border-border p-4 space-y-3">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    </div>
                </div>
            </OwnerPageShell>
        );
    }

    const handleArchive = () => {
        router.put(`/owner/outlets/${outlet.id}/archive`, {
            onFinish: () => setShowArchiveConfirm(false),
        });
    };

    return (
        <OwnerPageShell
            title={outlet.name}
            subtitle="Detail outlet"
            backHref="/owner/outlets"
            headerRight={
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/owner/outlets/${outlet.id}/edit`}>Edit</Link>
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setShowArchiveConfirm(true)}>
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                        Arsipkan
                    </Button>
                </div>
            }
        >
            <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-4">
                    <div className="rounded-lg border border-border p-4" aria-label="Informasi Outlet">
                        <div className="mb-3 text-xs font-semibold text-text-subtle">Informasi Outlet</div>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-text">{outlet.name ?? '-'}</h2>
                                <p className="mt-0.5 text-xs text-text-muted">{outlet.address ?? '-'}</p>
                                {outlet.phone && <p className="text-xs text-text-muted">{outlet.phone}</p>}
                            </div>
                            <OutletStatusBadge status={outlet.status ?? 'active'} />
                        </div>

                        {outlet.pic_name && (
                            <div className="mt-3 rounded-lg border border-border bg-surface-muted p-3">
                                <div className="flex items-center gap-1.5 text-xs font-medium text-text-subtle">
                                    <User className="h-3 w-3" aria-hidden="true" />
                                    Penanggung Jawab
                                </div>
                                <div className="mt-1 text-xs font-medium text-text">{outlet.pic_name}</div>
                                {outlet.pic_position && <div className="text-xs text-text-muted">{outlet.pic_position}</div>}
                                {outlet.pic_phone && <div className="text-xs text-text-muted">{outlet.pic_phone}</div>}
                            </div>
                        )}

                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                            <div className="rounded-lg border border-border bg-surface-muted p-2 text-center">
                                <div className="text-sm font-semibold tabular-nums text-text">{outlet.active_orders_count ?? 0}</div>
                                <div className="text-xs font-medium opacity-70 text-text-muted">Pesanan Aktif</div>
                            </div>
                            <div className="rounded-lg border border-border bg-surface-muted p-2 text-center">
                                <div className="text-sm font-semibold tabular-nums text-text">{activeDeliveriesCount ?? 0}</div>
                                <div className="text-xs font-medium opacity-70 text-text-muted">Pengiriman</div>
                            </div>
                            <div className="rounded-lg border border-border bg-surface-muted p-2 text-center">
                                <div className="text-sm font-semibold tabular-nums text-text">{outlet.today_orders_count ?? 0}</div>
                                <div className="text-xs font-medium opacity-70 text-text-muted">Hari Ini</div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-border p-4 lg:col-span-2" aria-label="Lokasi">
                        <div className="mb-3 text-xs font-semibold text-text-subtle">Lokasi</div>
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
                                <OutletLocationMap value={location} onChange={() => undefined} readOnly />
                            </Suspense>
                        </div>
                    </div>

                    <div className="rounded-lg border border-border p-4" aria-label="Jam Operasional">
                        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-text-subtle">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            Jam Operasional
                        </div>
                        <OperatingHoursManager outletId={outlet.id} initialHours={operatingHours ?? []} />
                    </div>

                    <div className="rounded-lg border border-border p-4" aria-label="Hari Libur">
                        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-text-subtle">
                            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                            Hari Libur
                        </div>
                        <HolidayManager outletId={outlet.id} initialHolidays={holidays ?? []} />
                    </div>

                    <div className="rounded-lg border border-border p-4" aria-label="Produk Outlet">
                        <div className="mb-3 flex items-center justify-between text-xs font-semibold text-text-subtle">
                            <div className="flex items-center gap-2">
                                <Package className="h-3.5 w-3.5" aria-hidden="true" />
                                Produk Outlet
                            </div>
                        </div>
                        <p className="mb-2 text-xs text-text-muted">Kelola produk, stok, dan restock outlet ini.</p>
                        <OutletProducts outletId={outlet.id} />
                    </div>

                    {settlementSummary && Number(settlementSummary.outstanding) > 0 && (
                        <div className="rounded-lg border border-border p-4" aria-label="Settlement Outlet">
                            <div className="mb-3 flex items-center justify-between text-xs font-semibold text-text-subtle">
                                <div className="flex items-center gap-2">
                                    <DollarSign className="h-3.5 w-3.5" aria-hidden="true" />
                                    Settlement Outlet
                                </div>
                                <Link href={`/owner/finance/settlements/${outlet.id}`} className="text-xs font-semibold text-primary hover:text-primary">
                                    Lihat Semua
                                </Link>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-lg border border-border bg-surface-muted p-2">
                                    <div className="text-xs font-semibold text-text-subtle">Outstanding</div>
                                    <div className="mt-0.5 text-xs font-bold tabular-nums text-red-600">{formatCurrency(settlementSummary.outstanding)}</div>
                                </div>
                                <div className="rounded-lg border border-border bg-surface-muted p-2">
                                    <div className="text-xs font-semibold text-text-subtle">Terlambat</div>
                                    <div className="mt-0.5 text-xs font-bold tabular-nums text-amber-600">{settlementSummary.overdue_count}</div>
                                </div>
                                <div className="rounded-lg border border-border bg-surface-muted p-2">
                                    <div className="text-xs font-semibold text-text-subtle">Dibayar</div>
                                    <div className="mt-0.5 text-xs font-bold tabular-nums text-emerald-600">{formatCurrency(settlementSummary.paid_this_month)}</div>
                                </div>
                            </div>

                            {settlementSummary.recent_settlements?.length > 0 && (
                                <div className="mt-2">
                                    <div className="mb-1 text-xs font-semibold text-text-subtle">Settlement Terakhir</div>
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
                                            <OwnerDetailRow
                                                key={s.id}
                                                label={s.period_date}
                                                value={
                                                    <div className="flex items-center gap-2">
                                                        <span className="tabular-nums font-semibold">{formatCurrency(s.amount_due)}</span>
                                                        <StatusBadge variant={variantMap[s.status] ?? 'neutral'} size="sm">
                                                            {labelMap[s.status] ?? s.status}
                                                        </StatusBadge>
                                                    </div>
                                                }
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {auditLogs && auditLogs.length > 0 && (
                        <div className="rounded-lg border border-border p-4" aria-label="Riwayat Perubahan">
                            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-text-subtle">
                                <History className="h-3.5 w-3.5" aria-hidden="true" />
                                Riwayat Perubahan
                            </div>
                            {auditLogs.map((log: any) => (
                                <OwnerDetailRow
                                    key={log.id}
                                    label={log.field ?? '-'}
                                    value={
                                        <span className="text-xs">
                                            {log.old_value ?? '-'} &rarr; {log.new_value ?? '-'}
                                            <span className="ml-2 text-text-subtle">{log.changed_by?.name ?? '-'} &middot; {formatDate(log.created_at)}</span>
                                        </span>
                                }
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="rounded-lg border border-border p-4" aria-label="Status & Aksi">
                        <div className="mb-3 text-xs font-semibold text-text-subtle">Status & Aksi</div>
                        <div className="flex items-center gap-2 mb-3">
                            <OutletStatusBadge status={outlet.status ?? 'active'} />
                            {Number(outlet.low_stock_count) > 0 && <StatusBadge variant="warning" size="sm">Stok Rendah</StatusBadge>}
                            {Number(outlet.active_orders_count) >= 3 && <StatusBadge variant="info" size="sm">Sibuk</StatusBadge>}
                        </div>
                        <div className="space-y-1.5">
                            <Link
                                href={`/owner/outlets/${outlet.id}/edit`}
                                className="flex h-8 w-full items-center gap-2 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-text transition-colors hover:bg-surface-muted"
                            >
                                <Edit3 className="h-3.5 w-3.5 text-text-subtle" aria-hidden="true" />
                                Edit Outlet
                            </Link>
                            <Link
                                href={`/owner/inventories?outlet_id=${outlet.id}`}
                                className="flex h-8 w-full items-center gap-2 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-text transition-colors hover:bg-surface-muted"
                            >
                                <RefreshCw className="h-3.5 w-3.5 text-text-subtle" aria-hidden="true" />
                                Restock
                            </Link>
                            <Link
                                href={`/owner/orders?outlet_id=${outlet.id}`}
                                className="flex h-8 w-full items-center gap-2 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-text transition-colors hover:bg-surface-muted"
                            >
                                <ShoppingBag className="h-3.5 w-3.5 text-text-subtle" aria-hidden="true" />
                                Lihat Pesanan
                            </Link>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <div className="rounded-lg border border-border bg-surface-muted p-2">
                                <div className="text-sm font-bold tabular-nums text-blue-600">{outlet.active_orders_count ?? 0}</div>
                                <div className="text-xs font-medium text-text-subtle">Pesanan Aktif</div>
                            </div>
                            <div className="rounded-lg border border-border bg-surface-muted p-2">
                                <div className="text-sm font-bold tabular-nums text-emerald-600">{activeDeliveriesCount ?? 0}</div>
                                <div className="text-xs font-medium text-text-subtle">Pengiriman</div>
                            </div>
                            <div className="rounded-lg border border-border bg-surface-muted p-2">
                                <div className="text-sm font-bold tabular-nums text-text">{outlet.today_orders_count ?? 0}</div>
                                <div className="text-xs font-medium text-text-subtle">Hari Ini</div>
                            </div>
                            <div className={`rounded-lg border p-2 ${Number(outlet.low_stock_count) > 0 ? 'border-amber-200 bg-amber-50' : 'border-border bg-surface-muted'}`}>
                                <div className="text-sm font-bold tabular-nums text-amber-600">{outlet.low_stock_count ?? 0}</div>
                                <div className="text-xs font-medium text-text-subtle">Stok Rendah</div>
                            </div>
                        </div>
                    </div>

                    {outlet.delivery_radius_km && (
                        <div className="rounded-lg border border-border p-4" aria-label="Area Layanan">
                            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-text-subtle">
                                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                                Area Layanan
                            </div>
                            <OwnerDetailRow label="Radius" value={`${outlet.delivery_radius_km} km`} />
                            <p className="mt-1 text-xs text-text-muted">
                                Customer di luar radius ini tidak dapat memesan delivery.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <Dialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Arsipkan Outlet?</DialogTitle>
                        <DialogDescription>
                            Outlet <strong>{outlet.name}</strong> tidak akan muncul ke customer dan tidak menerima pesanan. Histori tetap tersimpan.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowArchiveConfirm(false)}>
                            Batal
                        </Button>
                        <Button variant="destructive" onClick={handleArchive}>
                            Arsipkan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </OwnerPageShell>
    );
}
