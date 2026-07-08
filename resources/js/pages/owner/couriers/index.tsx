import { Link, router } from '@inertiajs/react';
import { Bike, Car, Search } from 'lucide-react';
import { useState } from 'react';
import CourierStats from '@/components/owner/courier-stats';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { buttonVariants } from '@/components/ui/button';
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
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
                    <input
                        type="text"
                        placeholder="Cari kurir..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-9 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm text-text placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                </div>

                {/* Table */}
                {filtered.length === 0 ? (
                    <div className="rounded-lg border border-border bg-white py-10 text-center text-xs text-text-muted">
                        {search ? 'Kurir tidak ditemukan' : 'Belum ada kurir'}
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-lg border border-border">
                        <div className="grid grid-cols-[1fr_100px_100px_80px] items-center gap-3 bg-[#fafafa] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                            <span>Kurir</span>
                            <span>Kendaraan</span>
                            <span>Status</span>
                            <span />
                        </div>
                        {filtered.map((courier: any) => {
                            const vehicleIcon = courier.vehicle_type === 'car' ? Car : Bike;
                            const VehicleIcon = vehicleIcon;

                            return (
                                <div
                                    key={courier.id}
                                    className="grid grid-cols-[1fr_100px_100px_80px] items-center gap-3 border-t border-[#f0f0f0] px-3 py-2.5 transition-colors hover:bg-surface-muted"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-text-muted">
                                            {courier.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold text-text">{courier.name}</div>
                                            <div className="text-xs text-text-muted">{courier.phone ?? '-'}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                                        <VehicleIcon className="h-3.5 w-3.5" />
                                        <span className="capitalize">{courier.vehicle_type ?? '-'}</span>
                                    </div>
                                    <div>
                                        {courier.is_online ? (
                                            <StatusBadge variant="success" size="sm">Online</StatusBadge>
                                        ) : (
                                            <StatusBadge variant="neutral" size="sm">Offline</StatusBadge>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => router.visit(`/owner/couriers/${courier.id}`)}
                                        className="rounded-md px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary-light"
                                    >
                                        Detail →
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                <Pagination links={couriers.links} />
            </div>
        </OwnerPageShell>
    );
}
