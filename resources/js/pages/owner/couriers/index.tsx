import { router, useForm } from '@inertiajs/react';
import { Bike, Car, Package, Truck, Users } from 'lucide-react';
import { useState } from 'react';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import EmptyState from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import Pagination from '@/components/ui/pagination';
import { SkeletonPage } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const vehicleTypes = [
    { value: 'motorcycle', label: 'Motor', icon: Bike },
    { value: 'bicycle', label: 'Sepeda', icon: Bike },
    { value: 'car', label: 'Mobil', icon: Car },
] as const;

export default function CouriersIndex({
    couriers,
    stats,
    todayDeliveries,
}: any) {
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);

    const form = useForm({
        name: '',
        phone: '',
        vehicle_type: '' as '' | 'motorcycle' | 'bicycle' | 'car',
        vehicle_plate: '',
    });

    if (!couriers) {
        return <SkeletonPage />;
    }

    const filtered = search
        ? couriers.data.filter(
              (c: any) =>
                  c.name.toLowerCase().includes(search.toLowerCase()) ||
                  c.phone?.includes(search),
          )
        : couriers.data;

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        form.post('/owner/couriers', {
            onSuccess: () => {
                form.reset();
                setShowCreate(false);
            },
        });
    };

    return (
        <OwnerPageShell
            title="Kurir"
            subtitle="Kelola kurir pengiriman"
            headerRight={
                <Button onClick={() => setShowCreate(true)}>
                    + Tambah Kurir
                </Button>
            }
        >
            <div className="space-y-6">
                {/* KPI Strip */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-text-muted">
                                Total Kurir
                            </span>
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB]/10 text-[#2563EB]">
                                <Users className="h-5 w-5" />
                            </span>
                        </div>
                        <div className="font-heading text-xl font-bold text-text tabular-nums sm:text-2xl">
                            {stats.total}
                        </div>
                    </div>

                    <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-text-muted">
                                Online
                            </span>
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                                <Truck className="h-5 w-5" />
                            </span>
                        </div>
                        <div className="font-heading text-xl font-bold text-emerald-600 tabular-nums sm:text-2xl">
                            {stats.online}
                        </div>
                    </div>

                    <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-text-muted">
                                Pengiriman Hari Ini
                            </span>
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                                <Bike className="h-5 w-5" />
                            </span>
                        </div>
                        <div className="font-heading text-xl font-bold text-text tabular-nums sm:text-2xl">
                            {todayDeliveries}
                        </div>
                    </div>

                    <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-text-muted">
                                Lokasi Aktif
                            </span>
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C3AED]/10 text-[#7C3AED]">
                                <Users className="h-5 w-5" />
                            </span>
                        </div>
                        <div className="font-heading text-xl font-bold text-text tabular-nums sm:text-2xl">
                            {stats.active_location}
                        </div>
                    </div>
                </div>

                {/* Search */}
                <OwnerFilterCard
                    searchPlaceholder="Cari kurir..."
                    searchValue={search}
                    onSearch={setSearch}
                />

                {/* Courier Cards Grid */}
                {filtered.length === 0 ? (
                    <EmptyState
                        icon={<Package className="h-8 w-8" />}
                        title={
                            search ? 'Kurir tidak ditemukan' : 'Belum ada kurir'
                        }
                        description={
                            search
                                ? 'Coba kata kunci lain'
                                : 'Klik tambah untuk mendaftarkan kurir'
                        }
                    />
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {filtered.map((courier: any) => {
                                const VehicleIcon =
                                    courier.vehicle_type === 'car' ? Car : Bike;

                                return (
                                    <div
                                        key={courier.id}
                                        className="group rounded-2xl border border-border bg-surface p-5 transition-all hover:border-primary/30 hover:shadow-card"
                                    >
                                        {/* Header */}
                                        <div className="mb-3 flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                                                {courier.name
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-sm font-bold text-text">
                                                    {courier.name}
                                                </h3>
                                                <p className="text-xs text-text-muted">
                                                    {courier.phone ?? '-'}
                                                </p>
                                            </div>
                                            {courier.is_online ? (
                                                <span className="flex h-2.5 w-2.5 items-center justify-center">
                                                    <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400 opacity-75" />
                                                    <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
                                                </span>
                                            ) : (
                                                <span className="h-2 w-2 rounded-full bg-gray-300" />
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="mb-3 flex items-center gap-2 text-xs text-text-muted">
                                            <VehicleIcon className="h-3.5 w-3.5" />
                                            <span className="capitalize">
                                                {courier.vehicle_type ?? '-'}
                                            </span>
                                            {courier.vehicle_plate && (
                                                <>
                                                    <span className="text-border">
                                                        |
                                                    </span>
                                                    <span>
                                                        {courier.vehicle_plate}
                                                    </span>
                                                </>
                                            )}
                                        </div>

                                        {/* Divider */}
                                        <div className="mb-3 border-t border-border" />

                                        {/* Stats */}
                                        <div className="mb-4 flex items-center justify-between text-xs">
                                            <span className="text-text-muted">
                                                Pengiriman Hari Ini
                                            </span>
                                            <span className="font-bold text-text tabular-nums">
                                                {courier.today_deliveries ?? 0}
                                            </span>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="flex-1"
                                                onClick={() =>
                                                    router.visit(
                                                        `/owner/couriers/${courier.id}`,
                                                    )
                                                }
                                            >
                                                Detail
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="flex-1"
                                                onClick={() =>
                                                    router.visit(
                                                        `/owner/couriers/${courier.id}`,
                                                    )
                                                }
                                            >
                                                Edit
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <Pagination links={couriers.links} />
                    </>
                )}
            </div>

            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tambah Kurir</DialogTitle>
                        <DialogDescription>
                            Isi data kurir baru. Tautan undangan akan
                            ditampilkan setelah kurir dibuat.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <Input
                            label="Nama Lengkap"
                            type="text"
                            value={form.data.name}
                            onChange={(e) =>
                                form.setData('name', e.target.value)
                            }
                            placeholder="Nama kurir"
                            error={form.errors.name}
                            required
                        />
                        <Input
                            label="Nomor WhatsApp"
                            type="tel"
                            value={form.data.phone}
                            onChange={(e) =>
                                form.setData('phone', e.target.value)
                            }
                            placeholder="08xxxxxxxxxx"
                            error={form.errors.phone}
                            required
                        />
                        <div>
                            <label className="mb-1 block text-xs font-medium text-text-subtle">
                                Tipe Kendaraan
                            </label>
                            <div className="flex gap-2">
                                {vehicleTypes.map((vt) => {
                                    const Icon = vt.icon;
                                    const isSelected =
                                        form.data.vehicle_type === vt.value;

                                    return (
                                        <button
                                            key={vt.value}
                                            type="button"
                                            onClick={() =>
                                                form.setData(
                                                    'vehicle_type',
                                                    isSelected ? '' : vt.value,
                                                )
                                            }
                                            className={cn(
                                                'flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-all',
                                                isSelected
                                                    ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                                                    : 'border-border bg-surface text-text-muted hover:bg-mint-wash',
                                            )}
                                        >
                                            <Icon
                                                className="h-4 w-4"
                                                aria-hidden="true"
                                            />
                                            {vt.label}
                                        </button>
                                    );
                                })}
                            </div>
                            {form.errors.vehicle_type && (
                                <p className="mt-1 text-xs text-red-500">
                                    {form.errors.vehicle_type}
                                </p>
                            )}
                        </div>
                        {form.data.vehicle_type &&
                            form.data.vehicle_type !== 'bicycle' && (
                                <Input
                                    label="Plat Nomor"
                                    type="text"
                                    value={form.data.vehicle_plate}
                                    onChange={(e) =>
                                        form.setData(
                                            'vehicle_plate',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="AB 1234 CD"
                                    error={form.errors.vehicle_plate}
                                />
                            )}
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setShowCreate(false)}
                            >
                                Batal
                            </Button>
                            <Button type="submit" loading={form.processing}>
                                Tambah Kurir
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </OwnerPageShell>
    );
}
