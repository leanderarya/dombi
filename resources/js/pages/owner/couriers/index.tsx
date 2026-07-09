import { Link, router } from '@inertiajs/react';
import { Bike, Car, Package, Search } from 'lucide-react';
import { useState } from 'react';
import CourierStats from '@/components/owner/courier-stats';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button, buttonVariants } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/ui/pagination';
import StatusBadge from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

export default function CouriersIndex({ couriers, stats, todayDeliveries }: any) {
    const [search, setSearch] = useState('');

    const filtered = search
        ? couriers.data.filter(
              (c: any) =>
                  c.name.toLowerCase().includes(search.toLowerCase()) ||
                  c.phone?.includes(search),
          )
        : couriers.data;

    return (
        <OwnerPageShell
            title="Kurir"
            subtitle="Kelola kurir pengiriman"
            headerRight={
                <Link
                    href="/owner/couriers/create"
                    className={cn(buttonVariants({ variant: 'primary', size: 'md' }))}
                >
                    + Tambah Kurir
                </Link>
            }
        >
            <div className="space-y-4">
                <CourierStats stats={stats} todayDeliveries={todayDeliveries} />

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Cari kurir..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-9 w-full rounded-md border border-input bg-transparent pl-10 pr-3 text-sm text-text placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                </div>

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
        </OwnerPageShell>
    );
}
