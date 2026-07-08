import { Link, router, useForm } from '@inertiajs/react';
import {
    Bike,
    Car,
    CheckCircle,
    Clock,
    Edit3,
    MapPin,
    Package,
    Phone,
    Truck,
    User,
} from 'lucide-react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import StatusBadge from '@/components/ui/status-badge';
import DeliveryStatusBadge from '@/components/ui/delivery-status-badge';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function CourierShow({ courier, recentDeliveries }: any) {
    const toggleForm = useForm({ is_active: !courier.is_active });

    const handleToggleActive = () => {
        toggleForm.put(`/owner/couriers/${courier.id}`);
    };

    const vehicleIcon = courier.vehicle_type === 'car' ? Car : Bike;
    const VehicleIcon = vehicleIcon;

    return (
        <OwnerPageShell
            title={courier.name}
            subtitle="Detail kurir"
            backHref="/owner/couriers"
            headerRight={
                <button
                    type="button"
                    onClick={handleToggleActive}
                    className={cn(
                        'flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors',
                        courier.is_active
                            ? 'border-red-200 bg-white text-red-600 hover:bg-red-50'
                            : 'border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50',
                    )}
                >
                    {courier.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
            }
        >
            <div className="grid gap-3 lg:grid-cols-2">
                {/* Info Kurir */}
                <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">
                        Informasi Kurir
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-lg font-bold text-text-muted">
                            {courier.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-semibold text-text">{courier.name}</h2>
                            <div className="mt-1 space-y-1">
                                <div className="flex items-center gap-2 text-xs text-text-muted">
                                    <Phone className="h-3.5 w-3.5" />
                                    <span>{courier.phone ?? '-'}</span>
                                </div>
                                {courier.vehicle_type && (
                                    <div className="flex items-center gap-2 text-xs text-text-muted">
                                        <VehicleIcon className="h-3.5 w-3.5" />
                                        <span className="capitalize">{courier.vehicle_type}</span>
                                        {courier.vehicle_plate && (
                                            <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] font-semibold">
                                                {courier.vehicle_plate}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div>
                            {courier.is_active ? (
                                <StatusBadge variant="success" size="sm">Aktif</StatusBadge>
                            ) : (
                                <StatusBadge variant="neutral" size="sm">Nonaktif</StatusBadge>
                            )}
                        </div>
                    </div>

                    {courier.courier_profile && (
                        <div className="mt-3 rounded-lg border border-border bg-surface-muted p-2">
                            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-subtle">
                                <User className="h-3 w-3" />
                                Profil Kurir
                            </div>
                            <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <span className="text-text-muted">Status Undangan</span>
                                    <div className="font-medium text-text">
                                        {courier.courier_profile.invitation_status === 'accepted'
                                            ? 'Diterima'
                                            : courier.courier_profile.invitation_status === 'pending'
                                              ? 'Menunggu'
                                              : courier.courier_profile.invitation_status ?? '-'}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-text-muted">Online</span>
                                    <div className="font-medium text-text">
                                        {courier.is_online ? 'Ya' : 'Tidak'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Statistik */}
                <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">
                        Statistik
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg border border-border bg-surface-muted p-3 text-center">
                            <div className="text-2xl font-bold tabular-nums text-text">
                                {courier.total_deliveries_count ?? 0}
                            </div>
                            <div className="text-xs font-medium text-text-muted">Total</div>
                        </div>
                        <div className="rounded-lg border border-border bg-surface-muted p-3 text-center">
                            <div className="text-2xl font-bold tabular-nums text-blue-600">
                                {courier.active_deliveries_count ?? 0}
                            </div>
                            <div className="text-xs font-medium text-text-muted">Aktif</div>
                        </div>
                        <div className="rounded-lg border border-border bg-surface-muted p-3 text-center">
                            <div className="text-2xl font-bold tabular-nums text-emerald-600">
                                {courier.today_deliveries_count ?? 0}
                            </div>
                            <div className="text-xs font-medium text-text-muted">Hari Ini</div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="mt-4 space-y-1.5">
                        <Link
                            href={`/owner/deliveries?courier_id=${courier.id}`}
                            className="flex h-8 w-full items-center gap-2 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-text transition-colors hover:bg-surface-muted"
                        >
                            <Truck className="h-3.5 w-3.5 text-text-subtle" />
                            Lihat Pengiriman
                        </Link>
                        <Link
                            href={`/owner/orders?courier_id=${courier.id}`}
                            className="flex h-8 w-full items-center gap-2 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-text transition-colors hover:bg-surface-muted"
                        >
                            <Package className="h-3.5 w-3.5 text-text-subtle" />
                            Lihat Pesanan
                        </Link>
                    </div>
                </div>

                {/* Pengiriman Terbaru */}
                <div className="rounded-lg border border-border p-4 lg:col-span-2">
                    <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-text-subtle">
                        <Clock className="h-3.5 w-3.5" />
                        Pengiriman Terbaru
                    </div>
                    {recentDeliveries.length === 0 ? (
                        <div className="py-6 text-center text-xs text-text-muted">
                            Belum ada pengiriman
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-lg border border-border">
                            <div className="grid grid-cols-[100px_1fr_120px_120px] items-center gap-3 bg-[#fafafa] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                                <span>Kode</span>
                                <span>Status</span>
                                <span>Tanggal</span>
                                <span />
                            </div>
                            {recentDeliveries.map((d: any) => (
                                <div
                                    key={d.id}
                                    className="grid grid-cols-[100px_1fr_120px_120px] items-center gap-3 border-t border-[#f0f0f0] px-3 py-2 text-sm transition-colors last:border-t-0 hover:bg-surface-muted"
                                >
                                    <span className="font-bold tabular-nums text-text">
                                        {d.order?.order_code ?? '-'}
                                    </span>
                                    <span>
                                        <DeliveryStatusBadge status={d.status} />
                                    </span>
                                    <span className="text-xs text-text-muted">
                                        {formatDate(d.created_at)}
                                    </span>
                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.visit(`/owner/deliveries/${d.id}`)
                                            }
                                            className="rounded-md px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary-light"
                                        >
                                            Detail →
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </OwnerPageShell>
    );
}
