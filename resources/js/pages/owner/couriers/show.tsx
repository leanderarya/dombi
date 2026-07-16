import { Link, router, useForm } from '@inertiajs/react';
import {
    Bike,
    Car,
    Clock,
    Copy,
    Package,
    Phone,
    Share2,
    Truck,
    User,
} from 'lucide-react';
import { useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import DeliveryStatusBadge from '@/components/ui/delivery-status-badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function CourierShow({
    courier,
    recentDeliveries,
    inviteUrl,
}: any) {
    const toggleForm = useForm({ is_active: !courier.is_active });
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    if (!courier) {
        return (
            <OwnerPageShell
                title="Memuat..."
                subtitle="Detail kurir"
                backHref="/owner/couriers"
            >
                <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3 rounded-lg border border-border p-4">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-6 w-3/4" />
                    </div>
                    <div className="space-y-3 rounded-lg border border-border p-4">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-20 w-full" />
                    </div>
                </div>
            </OwnerPageShell>
        );
    }

    const handleToggleActive = () => {
        toggleForm.put(`/owner/couriers/${courier.id}`);
    };

    const handleDelete = () => {
        router.delete(`/owner/couriers/${courier.id}`, {
            onFinish: () => setShowDeleteConfirm(false),
        });
    };

    const vehicleIcon = courier.vehicle_type === 'car' ? Car : Bike;
    const VehicleIcon = vehicleIcon;

    return (
        <OwnerPageShell
            title={courier.name}
            subtitle="Detail kurir"
            backHref="/owner/couriers"
            headerRight={
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleToggleActive}
                        className={cn(
                            courier.is_active
                                ? 'border-red-200 text-red-600 hover:bg-red-50'
                                : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50',
                        )}
                    >
                        {courier.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowDeleteConfirm(true)}
                    >
                        Hapus
                    </Button>
                </div>
            }
        >
            <div className="grid gap-4 lg:grid-cols-3">
                {/* Main Content - 2 columns */}
                <div className="space-y-4 lg:col-span-2">
                    {/* Info Kurir */}
                    <div
                        className="rounded-lg border border-border p-4"
                        aria-label="Informasi Kurir"
                    >
                        <div className="mb-3 text-xs font-semibold text-text-subtle">
                            Informasi Kurir
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-lg font-bold text-text-muted">
                                {courier.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                                <h2 className="text-lg font-semibold text-text">
                                    {courier.name}
                                </h2>
                                <div className="mt-1 space-y-1">
                                    <div className="flex items-center gap-2 text-xs text-text-muted">
                                        <Phone
                                            className="h-3.5 w-3.5"
                                            aria-hidden="true"
                                        />
                                        <span>{courier.phone ?? '-'}</span>
                                    </div>
                                    {courier.vehicle_type && (
                                        <div className="flex items-center gap-2 text-xs text-text-muted">
                                            <VehicleIcon
                                                className="h-3.5 w-3.5"
                                                aria-hidden="true"
                                            />
                                            <span className="capitalize">
                                                {courier.vehicle_type}
                                            </span>
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
                                    <StatusBadge variant="success" size="sm">
                                        Aktif
                                    </StatusBadge>
                                ) : (
                                    <StatusBadge variant="neutral" size="sm">
                                        Nonaktif
                                    </StatusBadge>
                                )}
                            </div>
                        </div>

                        {courier.courier_profile && (
                            <div className="shadow-card-muted mt-3 rounded-xl bg-surface p-3">
                                <div className="flex items-center gap-1.5 text-xs font-medium text-text-subtle">
                                    <User
                                        className="h-3 w-3"
                                        aria-hidden="true"
                                    />
                                    Profil Kurir
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <span className="text-text-muted">
                                            Status Undangan
                                        </span>
                                        <div className="font-medium text-text">
                                            {courier.courier_profile
                                                .invitation_status ===
                                            'accepted'
                                                ? 'Diterima'
                                                : courier.courier_profile
                                                        .invitation_status ===
                                                    'pending'
                                                  ? 'Menunggu'
                                                  : (courier.courier_profile
                                                        .invitation_status ??
                                                    '-')}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-text-muted">
                                            Online
                                        </span>
                                        <div className="font-medium text-text">
                                            {courier.is_online ? 'Ya' : 'Tidak'}
                                        </div>
                                    </div>
                                </div>

                                {inviteUrl && (
                                    <div className="mt-3 flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={inviteUrl}
                                            readOnly
                                            className="h-8 flex-1 truncate rounded-md border border-border bg-surface px-2 text-xs text-text-muted"
                                        />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                navigator.clipboard.writeText(
                                                    inviteUrl,
                                                );
                                            }}
                                        >
                                            <Copy
                                                className="h-3 w-3"
                                                aria-hidden="true"
                                            />
                                            Salin
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                const text = `Undangan kurir Dombi: ${inviteUrl}`;

                                                if (navigator.share) {
                                                    navigator.share({ text });
                                                } else {
                                                    navigator.clipboard.writeText(
                                                        text,
                                                    );
                                                }
                                            }}
                                        >
                                            <Share2
                                                className="h-3 w-3"
                                                aria-hidden="true"
                                            />
                                            Bagikan
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Pengiriman Terbaru */}
                    <div
                        className="rounded-lg border border-border p-4"
                        aria-label="Pengiriman Terbaru"
                    >
                        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-text-subtle">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            Pengiriman Terbaru
                        </div>
                        {recentDeliveries.length === 0 ? (
                            <div className="py-6 text-center text-xs text-text-muted">
                                Belum ada pengiriman
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-xl bg-surface shadow-card">
                                <table className="w-full min-w-[400px]">
                                    <thead>
                                        <tr className="bg-surface-muted">
                                            <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">
                                                Kode
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">
                                                Status
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">
                                                Tanggal
                                            </th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-text-muted">
                                                Aksi
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentDeliveries.map((d: any) => (
                                            <tr
                                                key={d.id}
                                                className="hover:bg-mint-wash border-t border-border transition-colors"
                                            >
                                                <td className="px-4 py-2 font-bold text-text tabular-nums">
                                                    {d.order?.order_code ?? '-'}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <DeliveryStatusBadge
                                                        status={d.status}
                                                    />
                                                </td>
                                                <td className="px-4 py-2 text-xs text-text-muted">
                                                    {formatDate(d.created_at)}
                                                </td>
                                                <td className="px-4 py-2 text-right">
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
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar - 1 column */}
                <div className="space-y-4">
                    {/* Statistik */}
                    <div
                        className="rounded-lg border border-border p-4"
                        aria-label="Statistik"
                    >
                        <div className="mb-3 text-xs font-semibold text-text-subtle">
                            Statistik
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="shadow-card-muted rounded-xl bg-surface p-3 text-center">
                                <div className="text-2xl font-bold text-text tabular-nums">
                                    {courier.total_deliveries_count ?? 0}
                                </div>
                                <div className="text-xs font-medium text-text-muted">
                                    Total
                                </div>
                            </div>
                            <div className="shadow-card-muted rounded-xl bg-surface p-3 text-center">
                                <div className="text-2xl font-bold text-blue-600 tabular-nums">
                                    {courier.active_deliveries_count ?? 0}
                                </div>
                                <div className="text-xs font-medium text-text-muted">
                                    Aktif
                                </div>
                            </div>
                            <div className="shadow-card-muted rounded-xl bg-surface p-3 text-center">
                                <div className="text-2xl font-bold text-emerald-600 tabular-nums">
                                    {courier.today_deliveries_count ?? 0}
                                </div>
                                <div className="text-xs font-medium text-text-muted">
                                    Hari Ini
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="mt-4 space-y-2">
                            <Link
                                href={`/owner/deliveries?courier_id=${courier.id}`}
                                className="hover:bg-mint-wash flex h-9 w-full items-center gap-2 rounded-xl bg-surface px-3 text-sm font-semibold text-text shadow-card transition-colors"
                            >
                                <Truck
                                    className="h-4 w-4 text-text-subtle"
                                    aria-hidden="true"
                                />
                                Lihat Pengiriman
                            </Link>
                            <Link
                                href={`/owner/orders?courier_id=${courier.id}`}
                                className="hover:bg-mint-wash flex h-9 w-full items-center gap-2 rounded-xl bg-surface px-3 text-sm font-semibold text-text shadow-card transition-colors"
                            >
                                <Package
                                    className="h-4 w-4 text-text-subtle"
                                    aria-hidden="true"
                                />
                                Lihat Pesanan
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hapus Kurir?</DialogTitle>
                        <DialogDescription>
                            Kurir <strong>{courier.name}</strong> akan dihapus
                            permanen. Tindakan ini tidak bisa dibatalkan.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowDeleteConfirm(false)}
                        >
                            Batal
                        </Button>
                        <Button variant="destructive" onClick={handleDelete}>
                            Hapus Permanen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </OwnerPageShell>
    );
}
