import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, ArrowRight, Camera, ClipboardList, Package, QrCode, RefreshCw, Truck, Warehouse } from 'lucide-react';
import EmptyState from '@/components/ui/empty-state';
import StatusBadge from '@/components/ui/status-badge';
import OutletLayout from '@/layouts/outlet-layout';
import { usePolling } from '@/lib/use-polling';

export default function OutletDashboard({ outlet, stats, deliveryStats, lowStockItems }: any) {
    usePolling(20000);

    const todayOrders = stats.pendingOrders + stats.preparingOrders + stats.readyForCustomerPickup;
    const pendingTasks = stats.pendingOrders + deliveryStats.failed + deliveryStats.needsDispatch + lowStockItems.length;
    const hasActions = pendingTasks > 0;
    const hasActivity = todayOrders > 0 || pendingTasks > 0 || deliveryStats.completedToday > 0 || deliveryStats.inTransit > 0 || lowStockItems.length > 0;

    return (
        <OutletLayout>
            <Head title="Dashboard" />

            {/* Hero — primary focal point */}
            <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-hover p-5 text-white">
                <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />
                <div className="relative">
                    <p className="text-xs font-medium text-emerald-100">Selamat datang,</p>
                    <h1 className="mt-0.5 text-lg font-bold tracking-tight">{outlet.name}</h1>
                    <div className="mt-4 flex gap-3">
                        <div className="flex-1 rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm">
                            <div className="text-2xl font-bold tabular-nums">{todayOrders}</div>
                            <div className="text-[11px] font-medium text-emerald-100">Pesanan Hari Ini</div>
                        </div>
                        <div className="flex-1 rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm">
                            <div className="text-2xl font-bold tabular-nums">{pendingTasks}</div>
                            <div className="text-[11px] font-medium text-emerald-100">Tugas Menunggu</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* QR Scan — primary action, prominent */}
            <Link
                href="/outlet/scan"
                className="mb-6 flex items-center gap-4 rounded-2xl bg-gradient-to-br from-primary to-primary-hover p-5 text-white shadow-md transition-all active:opacity-80"
            >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                    <QrCode className="h-6 w-6" />
                </div>
                <div className="flex-1">
                    <div className="text-base font-bold">Scan QR untuk Ambil Pesanan</div>
                    <div className="mt-0.5 text-sm text-white/70">Arahkan kamera ke QR code customer</div>
                </div>
                <Camera className="h-5 w-5 text-white/50" />
            </Link>

            {/* Alerts — only show when there are urgent items */}
            {hasActions && (
                <div className="mb-6">
                    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-subtle">Perlu Tindakan</h2>
                    <div className="space-y-2">
                        {stats.pendingOrders > 0 && (
                            <ActionRow href="/outlet/orders?status=pending_confirmation" icon={<Package className="h-4 w-4" />} iconColor="amber" label={`${stats.pendingOrders} Pesanan Baru`} sublabel="Perlu konfirmasi" />
                        )}
                        {deliveryStats.needsDispatch > 0 && (
                            <ActionRow href="/outlet/deliveries" icon={<Truck className="h-4 w-4" />} iconColor="blue" label={`${deliveryStats.needsDispatch} Perlu Dikirim`} sublabel="Siap assign kurir" />
                        )}
                        {deliveryStats.failed > 0 && (
                            <ActionRow href="/outlet/deliveries?status=failed" icon={<AlertTriangle className="h-4 w-4" />} iconColor="red" label={`${deliveryStats.failed} Pengiriman Gagal`} sublabel="Perlu penanganan" />
                        )}
                        {lowStockItems.length > 0 && (
                            <ActionRow href="/outlet/inventory" icon={<AlertTriangle className="h-4 w-4" />} iconColor="orange" label={`${lowStockItems.length} Stok Rendah`} sublabel="Perlu restock" />
                        )}
                    </div>
                </div>
            )}

            {/* Stats — unified overview with clear hierarchy */}
            <div className="mb-6">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-subtle">Ringkasan Hari Ini</h2>
                <div className="rounded-2xl border border-border bg-white p-4">
                    {/* Order queue — primary row */}
                    <div className="grid grid-cols-4 gap-3">
                        <StatCell label="Baru" value={stats.pendingOrders} alert={stats.pendingOrders > 0} />
                        <StatCell label="Diproses" value={stats.preparingOrders} />
                        <StatCell label="Siap Diambil" value={stats.readyForCustomerPickup} />
                        <StatCell label="Menunggu Kurir" value={deliveryStats.waitingPickup} />
                    </div>

                    {/* Divider */}
                    <div className="my-3 h-px bg-border" />

                    {/* Delivery stats — secondary row */}
                    <div className="grid grid-cols-3 gap-3">
                        <StatCell label="Selesai" value={deliveryStats.completedToday} />
                        <StatCell label="Dalam Perjalanan" value={deliveryStats.inTransit} />
                        <StatCell label="Menunggu" value={deliveryStats.waitingPickup} />
                    </div>

                    <Link href="/outlet/orders" className="mt-3 flex min-h-[44px] items-center justify-center text-xs font-semibold text-primary">
                        Lihat Semua Pesanan →
                    </Link>
                </div>
            </div>

            {/* Quick Actions — de-emphasized, secondary */}
            <div className="mb-6">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-subtle">Aksi Cepat</h2>
                <div className="grid grid-cols-4 gap-2">
                    <QuickAction href="/outlet/orders" icon={<ClipboardList className="h-5 w-5" />} label="Pesanan" />
                    <QuickAction href="/outlet/inventory" icon={<Warehouse className="h-5 w-5" />} label="Inventaris" />
                    <QuickAction href="/outlet/restocks/create" icon={<RefreshCw className="h-5 w-5" />} label="Restock" />
                    <QuickAction href="/outlet/deliveries" icon={<Truck className="h-5 w-5" />} label="Kirim" />
                </div>
            </div>

            {/* Low Stock — tertiary, only when relevant */}
            {lowStockItems.length > 0 && (
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-subtle">Stok Rendah</h2>
                        <Link href="/outlet/inventory" className="flex min-h-[44px] items-center text-[11px] font-semibold text-primary">Lihat Semua</Link>
                    </div>
                    <div className="space-y-1.5">
                        {lowStockItems.slice(0, 3).map((item: any) => (
                            <div key={item.id} className="flex items-center justify-between rounded-lg border border-border bg-white px-3 py-2">
                                <div>
                                    <div className="text-sm font-medium text-text">{item.product?.name}</div>
                                    <div className="text-[11px] text-text-subtle">Tersedia: {item.current_stock - item.reserved_stock} / Min: {item.minimum_stock}</div>
                                </div>
                                <StatusBadge variant={item.current_stock - item.reserved_stock <= 0 ? 'danger' : 'warning'} size="sm">
                                    {item.current_stock - item.reserved_stock <= 0 ? 'Kritis' : 'Rendah'}
                                </StatusBadge>
                            </div>
                        ))}
                    </div>
                    {lowStockItems.length > 3 && (
                        <Link href="/outlet/inventory" className="mt-2 block text-center text-xs font-semibold text-primary">
                            +{lowStockItems.length - 3} lainnya
                        </Link>
                    )}
                </div>
            )}

            {/* Empty State */}
            {!hasActivity && (
                <div className="mt-8">
                    <EmptyState
                        icon={<Package className="h-8 w-8 text-text-subtle" />}
                        title="Tidak ada aktivitas"
                        description="Belum ada pesanan atau tugas hari ini. Saatnya menyiapkan stok!"
                    />
                </div>
            )}
        </OutletLayout>
    );
}

function ActionRow({ href, icon, iconColor, label, sublabel }: { href: string; icon: React.ReactNode; iconColor: string; label: string; sublabel: string }) {
    const colorMap: Record<string, string> = {
        amber: 'bg-amber-50 text-amber-600',
        blue: 'bg-blue-50 text-blue-600',
        red: 'bg-red-50 text-red-600',
        orange: 'bg-orange-50 text-orange-600',
    };

    return (
        <Link href={href} className="flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-2.5 transition-all active:bg-surface-muted">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${colorMap[iconColor] ?? 'bg-surface-muted text-text-muted'}`}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-text">{label}</div>
                <div className="text-[11px] text-text-subtle">{sublabel}</div>
            </div>
            <ArrowRight className="h-4 w-4 text-text-subtle" />
        </Link>
    );
}

function StatCell({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
    return (
        <div className="text-center">
            <div className={`text-xl font-bold tabular-nums ${alert ? 'text-amber-600' : 'text-text'}`}>{value}</div>
            <div className="text-[11px] font-medium text-text-subtle">{label}</div>
        </div>
    );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
    return (
        <Link href={href} className="group flex flex-col items-center gap-1.5 rounded-xl border border-border bg-white p-3 transition-all hover:border-border-strong hover:shadow-sm active:opacity-80">
            <div className="text-text-muted transition-colors group-hover:text-primary">{icon}</div>
            <div className="text-[11px] font-medium text-text-subtle">{label}</div>
        </Link>
    );
}
