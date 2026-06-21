import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, ArrowRight, Camera, ClipboardList, Package, QrCode, RefreshCw, Truck, Warehouse } from 'lucide-react';
import EmptyState from '@/components/ui/empty-state';
import SectionCard from '@/components/ui/section-card';
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

            {/* Hero */}
            <div className="relative mb-4 overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary-hover p-4 text-white">
                <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />
                <div className="relative">
                    <p className="text-xs font-medium text-emerald-100">Selamat datang,</p>
                    <h1 className="mt-0.5 text-lg font-bold tracking-tight">{outlet.name}</h1>
                    <div className="mt-3 flex gap-3">
                        <div className="flex-1 rounded-lg bg-white/15 px-3 py-2 backdrop-blur-sm">
                            <div className="text-xl font-bold tabular-nums">{todayOrders}</div>
                            <div className="text-[11px] text-emerald-100">Pesanan Hari Ini</div>
                        </div>
                        <div className="flex-1 rounded-lg bg-white/15 px-3 py-2 backdrop-blur-sm">
                            <div className="text-xl font-bold tabular-nums">{pendingTasks}</div>
                            <div className="text-[11px] text-emerald-100">Tugas Menunggu</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* QR Scan Card */}
            <Link
                href="/outlet/scan"
                className="mt-4 flex items-center gap-4 rounded-2xl bg-gradient-to-br from-primary to-primary-hover p-5 text-white transition-all active:scale-[0.99]"
            >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                    <QrCode className="h-7 w-7" />
                </div>
                <div className="flex-1">
                    <div className="text-lg font-bold">Scan QR untuk Ambil Pesanan</div>
                    <div className="mt-0.5 text-sm text-white/80">Arahkan kamera ke QR code customer</div>
                </div>
                <Camera className="h-5 w-5 text-white/60" />
            </Link>

            {/* Perlu Tindakan */}
            {hasActions && (
                <SectionCard label="Perlu Tindakan" className="mb-4 border-amber-200 bg-amber-50">
                    <div className="mt-1 space-y-2">
                        {stats.pendingOrders > 0 && (
                            <Link href="/outlet/orders?status=pending_confirmation" className="flex items-center gap-3 rounded-lg border border-amber-100 bg-white p-3 active:bg-amber-50">
                                <Package className="h-5 w-5 text-amber-600" />
                                <div className="flex-1">
                                    <div className="text-sm font-semibold text-slate-900">{stats.pendingOrders} Pesanan Baru</div>
                                    <div className="text-xs text-slate-500">Perlu konfirmasi</div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-slate-400" />
                            </Link>
                        )}
                        {deliveryStats.needsDispatch > 0 && (
                            <Link href="/outlet/deliveries" className="flex items-center gap-3 rounded-lg border border-amber-100 bg-white p-3 active:bg-amber-50">
                                <Truck className="h-5 w-5 text-blue-600" />
                                <div className="flex-1">
                                    <div className="text-sm font-semibold text-slate-900">{deliveryStats.needsDispatch} Perlu Dikirim</div>
                                    <div className="text-xs text-slate-500">Siap assign kurir</div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-slate-400" />
                            </Link>
                        )}
                        {deliveryStats.failed > 0 && (
                            <Link href="/outlet/deliveries?status=failed" className="flex items-center gap-3 rounded-lg border border-amber-100 bg-white p-3 active:bg-amber-50">
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                                <div className="flex-1">
                                    <div className="text-sm font-semibold text-slate-900">{deliveryStats.failed} Pengiriman Gagal</div>
                                    <div className="text-xs text-slate-500">Perlu penanganan</div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-slate-400" />
                            </Link>
                        )}
                        {lowStockItems.length > 0 && (
                            <Link href="/outlet/inventory" className="flex items-center gap-3 rounded-lg border border-amber-100 bg-white p-3 active:bg-amber-50">
                                <AlertTriangle className="h-5 w-5 text-orange-600" />
                                <div className="flex-1">
                                    <div className="text-sm font-semibold text-slate-900">{lowStockItems.length} Stok Rendah</div>
                                    <div className="text-xs text-slate-500">Perlu restock</div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-slate-400" />
                            </Link>
                        )}
                    </div>
                </SectionCard>
            )}

            {/* Antrian Kerja Hari Ini */}
            <SectionCard label="Antrian Kerja Hari Ini" className="mb-4" labelRight={<Link href="/outlet/orders" className="text-[11px] font-bold text-emerald-700">Lihat Semua</Link>}>
                <div className="mt-1 grid grid-cols-4 gap-2">
                    <QueueItem label="Baru" value={stats.pendingOrders} alert={stats.pendingOrders > 0} />
                    <QueueItem label="Diproses" value={stats.preparingOrders} />
                    <QueueItem label="Siap Diambil" value={stats.readyForCustomerPickup} />
                    <QueueItem label="Menunggu Kurir" value={deliveryStats.waitingPickup} />
                </div>
            </SectionCard>

            {/* Aksi Cepat */}
            <SectionCard label="Aksi Cepat" className="mb-4">
                <div className="mt-1 grid grid-cols-2 gap-2">
                    <QuickAction href="/outlet/orders" icon={<ClipboardList className="h-5 w-5" />} label="Kelola Pesanan" />
                    <QuickAction href="/outlet/inventory" icon={<Warehouse className="h-5 w-5" />} label="Inventaris" />
                    <QuickAction href="/outlet/restocks/create" icon={<RefreshCw className="h-5 w-5" />} label="Minta Restock" />
                    <QuickAction href="/outlet/deliveries" icon={<Truck className="h-5 w-5" />} label="Pengiriman" />
                </div>
            </SectionCard>

            {/* Pengiriman Hari Ini */}
            <SectionCard label="Pengiriman Hari Ini" className="mb-4" labelRight={<Link href="/outlet/deliveries" className="text-[11px] font-bold text-emerald-700">Lihat Semua</Link>}>
                <div className="mt-1 grid grid-cols-3 gap-2">
                    <MiniStat label="Selesai" value={deliveryStats.completedToday} />
                    <MiniStat label="Dalam Perjalanan" value={deliveryStats.inTransit} />
                    <MiniStat label="Menunggu" value={deliveryStats.waitingPickup} />
                </div>
            </SectionCard>

            {/* Stok Rendah */}
            {lowStockItems.length > 0 && (
                <SectionCard label="Stok Rendah" className="mb-4" labelRight={<Link href="/outlet/inventory" className="text-[11px] font-bold text-emerald-700">Lihat Semua</Link>}>
                    <div className="mt-1 space-y-2">
                        {lowStockItems.slice(0, 3).map((item: any) => (
                            <div key={item.id} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                                <div>
                                    <div className="text-sm font-medium">{item.product?.name}</div>
                                    <div className="text-xs text-slate-500">Tersedia: {item.current_stock - item.reserved_stock} / Min: {item.minimum_stock}</div>
                                </div>
                                <StatusBadge variant={item.current_stock - item.reserved_stock <= 0 ? 'danger' : 'warning'} size="sm">
                                    {item.current_stock - item.reserved_stock <= 0 ? 'Kritis' : 'Rendah'}
                                </StatusBadge>
                            </div>
                        ))}
                    </div>
                    {lowStockItems.length > 3 && (
                        <Link href="/outlet/inventory" className="mt-2 block text-center text-xs font-semibold text-emerald-700">
                            +{lowStockItems.length - 3} lainnya
                        </Link>
                    )}
                </SectionCard>
            )}

            {/* Empty State */}
            {!hasActivity && (
                <div className="mt-6">
                    <EmptyState
                        icon={<Package className="h-8 w-8 text-slate-400" />}
                        title="Tidak ada aktivitas"
                        description="Belum ada pesanan atau tugas hari ini. Saatnya menyiapkan stok!"
                    />
                </div>
            )}
        </OutletLayout>
    );
}

function QueueItem({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
    return (
        <div className={`rounded-lg border p-2 text-center transition-colors ${alert ? 'border-amber-200 bg-amber-50' : 'border-border bg-white hover:border-border-strong'}`}>
            <div className={`text-lg font-bold tabular-nums ${alert ? 'text-amber-700' : 'text-text'}`}>{value}</div>
            <div className="text-[10px] font-medium text-text-muted">{label}</div>
        </div>
    );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
    return (
        <Link href={href} className="group flex flex-col items-center gap-1.5 rounded-lg border border-border bg-white p-3 transition-all duration-200 hover:border-border-strong hover:shadow-sm active:scale-[0.98]">
            <div className="text-primary transition-transform duration-200 group-hover:scale-105">{icon}</div>
            <div className="text-xs font-semibold text-text">{label}</div>
        </Link>
    );
}

function MiniStat({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border border-border bg-white p-2.5 text-center transition-colors hover:border-border-strong">
            <div className="text-lg font-bold tabular-nums text-text">{value}</div>
            <div className="text-[10px] font-medium text-text-muted">{label}</div>
        </div>
    );
}
