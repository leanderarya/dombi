import { router, useForm } from '@inertiajs/react';
import { Bike, Car, Package, Search } from 'lucide-react';
import { useState } from 'react';
import CourierStats from '@/components/owner/courier-stats';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import EmptyState from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import Pagination from '@/components/ui/pagination';
import StatusBadge from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

const vehicleTypes = [
    { value: 'motorcycle', label: 'Motor', icon: Bike },
    { value: 'bicycle', label: 'Sepeda', icon: Bike },
    { value: 'car', label: 'Mobil', icon: Car },
] as const;

export default function CouriersIndex({ couriers, stats, todayDeliveries }: any) {
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);

    const form = useForm({
        name: '',
        phone: '',
        vehicle_type: '' as '' | 'motorcycle' | 'bicycle' | 'car',
        vehicle_plate: '',
    });

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
            <div className="space-y-4">
                <CourierStats stats={stats} todayDeliveries={todayDeliveries} />

                {/* Search */}
                <Input
                    type="text"
                    placeholder="Cari kurir..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    icon={Search}
                />

                {/* Table */}
                {filtered.length === 0 ? (
                    <EmptyState
                        icon={<Package className="h-8 w-8" />}
                        title={search ? 'Kurir tidak ditemukan' : 'Belum ada kurir'}
                        description={search ? 'Coba kata kunci lain' : 'Tambah kurir untuk mulai mengelola pengiriman'}
                    />
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full min-w-[500px]">
                            <thead>
                                <tr className="bg-surface-muted">
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Kurir</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Kendaraan</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Status</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((courier: any) => {
                                    const vehicleIcon = courier.vehicle_type === 'car' ? Car : Bike;
                                    const VehicleIcon = vehicleIcon;

                                    return (
                                        <tr key={courier.id} className="border-t border-border transition-colors hover:bg-surface-muted">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-text-muted">
                                                        {courier.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-semibold text-text">{courier.name}</div>
                                                        <div className="text-xs text-text-muted">{courier.phone ?? '-'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                                                    <VehicleIcon className="h-3.5 w-3.5" />
                                                    <span className="capitalize">{courier.vehicle_type ?? '-'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {courier.is_online ? (
                                                    <StatusBadge variant="success" size="sm">Online</StatusBadge>
                                                ) : (
                                                    <StatusBadge variant="neutral" size="sm">Offline</StatusBadge>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => router.visit(`/owner/couriers/${courier.id}`)}
                                                >
                                                    Detail
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <Pagination links={couriers.links} />
            </div>

            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tambah Kurir</DialogTitle>
                        <DialogDescription>Isi data kurir baru. Tautan undangan akan ditampilkan setelah kurir dibuat.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <Input
                            label="Nama Lengkap"
                            type="text"
                            value={form.data.name}
                            onChange={(e) => form.setData('name', e.target.value)}
                            placeholder="Nama kurir"
                            error={form.errors.name}
                            required
                        />
                        <Input
                            label="Nomor WhatsApp"
                            type="tel"
                            value={form.data.phone}
                            onChange={(e) => form.setData('phone', e.target.value)}
                            placeholder="08xxxxxxxxxx"
                            error={form.errors.phone}
                            required
                        />
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-subtle">
                                Tipe Kendaraan
                            </label>
                            <div className="flex gap-2">
                                {vehicleTypes.map((vt) => {
                                    const Icon = vt.icon;
                                    const isSelected = form.data.vehicle_type === vt.value;

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
                                                    : 'border-border bg-white text-text-muted hover:bg-surface-muted',
                                            )}
                                        >
                                            <Icon className="h-4 w-4" />
                                            {vt.label}
                                        </button>
                                    );
                                })}
                            </div>
                            {form.errors.vehicle_type && (
                                <p className="mt-1 text-xs text-red-500">{form.errors.vehicle_type}</p>
                            )}
                        </div>
                        {form.data.vehicle_type && form.data.vehicle_type !== 'bicycle' && (
                            <Input
                                label="Plat Nomor"
                                type="text"
                                value={form.data.vehicle_plate}
                                onChange={(e) => form.setData('vehicle_plate', e.target.value)}
                                placeholder="AB 1234 CD"
                                error={form.errors.vehicle_plate}
                            />
                        )}
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowCreate(false)}>Batal</Button>
                            <Button type="submit" loading={form.processing}>Tambah Kurir</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </OwnerPageShell>
    );
}
