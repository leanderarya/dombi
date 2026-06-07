import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, Banknote, Package, Repeat2, RotateCcw, Sparkles, Truck, XCircle } from 'lucide-react';
import OrderStatusBadge from '@/components/order-status-badge';
import SectionCard from '@/components/ui/section-card';
import EmptyState from '@/components/ui/empty-state';
import StatusBadge from '@/components/ui/status-badge';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency } from '@/lib/format';
import { usePolling } from '@/lib/use-polling';

export default function OutletDashboard({ outlet, stats, deliveryStats, failureReasons, lowStockItems, recentOrders, settlementStats }: any) {
    usePolling(20000);

    const hasUrgentActions = stats.pendingOrders > 0 || deliveryStats.failed > 0 || deliveryStats.needsDispatch > 0 || lowStockItems.length > 0 || stats.pendingReturns > 0 || stats.pendingExchanges > 0 || settlementStats.outstanding > 0;

    return (
        <OutletLayout>
            <Head title="Dashboard" />
            <div className="mb-4">
                <h1 className="text-lg font-bold text-slate-900">{outlet.name}</h1>
                <p className="text-xs text-slate-500">{outlet.kecamatan}</p>
            </div>

            {/* Priority Panel - What needs action NOW */}
            {hasUrgentActions && (
                <SectionCard label="Perlu Tindakan" className="mb-4">
                    <div className="mt-2 space-y-2">
                        {stats.pendingOrders > 0 && (
                            <Link href="/outlet/orders?status=pending_confirmation" className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 active:bg-zinc-100">
                                <Package className="h-5 w-5 text-amber-600" />
                                <div className="flex-1">
                                    <div className="text-sm font-semibold text-slate-900">{stats.pendingOrders} Pesanan Menunggu</div>
                                    <div className="text-xs text-slate-500">Perlu konfirmasi atau penolakan</div>
                                </div>
                                <StatusBadge variant="warning" size="sm">{stats.pendingOrders}</StatusBadge>
                            </Link>
                        )}
                        {deliveryStats.failed > 0 && (
                            <Link href="/outlet/deliveries?status=failed" className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 active:bg-zinc-100">
                                <XCircle className="h-5 w-5 text-red-600" />
                                <div className="flex-1">
                                    <div className="text-sm font-semibold text-slate-900">{deliveryStats.failed} Pengiriman Gagal</div>
                                    <div className="text-xs text-slate-500">Perlu penanganan</div>
                                </div>
                                <StatusBadge variant="danger" size="sm">{deliveryStats.failed}</StatusBadge>
                            </Link>
                        )}
                        {deliveryStats.needsDispatch > 0 && (
                            <Link href="/outlet/deliveries" className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 active:bg-zinc-100">
                                <Truck className="h-5 w-5 text-blue-600" />
                                <div className="flex-1">
                                    <div className="text-sm font-semibold text-slate-900">{deliveryStats.needsDispatch} Perlu Dikirim</div>
                                    <div className="text-xs text-slate-500">Siap assign kurir</div>
                                </div>
                                <StatusBadge variant="info" size="sm">{deliveryStats.needsDispatch}</StatusBadge>
                            </Link>
                        )}
                        {lowStockItems.length > 0 && (
                            <Link href="/outlet/inventory" className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 active:bg-zinc-100">
                                <AlertTriangle className="h-5 w-5 text-orange-600" />
                                <div className="flex-1">
                                    <div className="text-sm font-semibold text-slate-900">{lowStockItems.length} Stok Rendah</div>
                                    <div className="text-xs text-slate-500">Perlu restock</div>
                                </div>
                                <StatusBadge variant="warning" size="sm">{lowStockItems.length}</StatusBadge>
                            </Link>
                        )}
                        {stats.pendingReturns > 0 && (
                            <Link href="/outlet/returns?status=submitted" className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 active:bg-zinc-100">
                                <RotateCcw className="h-5 w-5 text-amber-600" />
                                <div className="flex-1">
                                    <div className="text-sm font-semibold text-slate-900">{stats.pendingReturns} Return Aktif</div>
                                    <div className="text-xs text-slate-500">Pantau return yang menunggu proses</div>
                                </div>
                                <StatusBadge variant="warning" size="sm">{stats.pendingReturns}</StatusBadge>
                            </Link>
                        )}
                        {stats.pendingExchanges > 0 && (
                            <Link href="/outlet/exchanges" className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 active:bg-zinc-100">
                                <Repeat2 className="h-5 w-5 text-blue-600" />
                                <div className="flex-1">
                                    <div className="text-sm font-semibold text-slate-900">{stats.pendingExchanges} Tukar Produk Aktif</div>
                                    <div className="text-xs text-slate-500">Cek status penggantian produk</div>
                                </div>
                                <StatusBadge variant="info" size="sm">{stats.pendingExchanges}</StatusBadge>
                            </Link>
                        )}
                        {settlementStats.outstanding > 0 && (
                            <Link href="/outlet/settlement" className="flex items-center gap-3 rounded-lg border border-red-100 bg-red-50 p-3 active:bg-red-100">
                                <Banknote className="h-5 w-5 text-red-600" />
                                <div className="flex-1">
                                    <div className="text-sm font-semibold text-slate-900">Belum Disetor {formatCurrency(settlementStats.outstanding)}</div>
                                    <div className="text-xs text-slate-500">Setoran ke pusat perlu dibayar</div>
                                </div>
                                <StatusBadge variant="danger" size="sm">Bayar</StatusBadge>
                            </Link>
                        )}
                    </div>
                </SectionCard>
            )}

            {/* Delivery Stats */}
            <SectionCard label="Pengiriman" className="mb-4" labelRight={<Link href="/outlet/deliveries" className="text-[11px] font-bold text-emerald-700">Lihat Semua</Link>}>
                <div className="mt-2 grid grid-cols-2 gap-2">
                    <MiniStat label="Menunggu Pickup" value={deliveryStats.waitingPickup} />
                    <MiniStat label="Dalam Perjalanan" value={deliveryStats.inTransit} />
                    <MiniStat label="Selesai Hari Ini" value={deliveryStats.completedToday} />
                    <MiniStat label="Gagal" value={deliveryStats.failed} alert={deliveryStats.failed > 0} />
                </div>
            </SectionCard>

            {/* Order Stats */}
            <SectionCard label="Pesanan" className="mb-4" labelRight={<Link href="/outlet/orders" className="text-[11px] font-bold text-emerald-700">Lihat Semua</Link>}>
                <div className="mt-2 grid grid-cols-3 gap-2">
                    <MiniStat label="Menunggu" value={stats.pendingOrders} alert={stats.pendingOrders > 0} />
                    <MiniStat label="Disiapkan" value={stats.preparingOrders} />
                    <MiniStat label="Siap Ambil" value={stats.readyForPickupOrders} />
                </div>
            </SectionCard>

            <SectionCard label="Return & Tukar Produk" className="mb-4" labelRight={<Link href="/outlet/returns" className="text-[11px] font-bold text-emerald-700">Lihat Semua</Link>}>
                <div className="mt-2 grid grid-cols-2 gap-2">
                    <MiniStat label="Pending Returns" value={stats.pendingReturns} alert={stats.pendingReturns > 0} />
                    <MiniStat label="Pending Exchanges" value={stats.pendingExchanges} alert={stats.pendingExchanges > 0} />
                    <ValueStat label="Return Value" value={stats.returnValue} />
                    <ValueStat label="Exchange Value" value={stats.exchangeValue} />
                </div>
            </SectionCard>

            {/* Settlement Summary */}
            <SectionCard label="Settlement" className="mb-4" labelRight={<Link href="/outlet/settlement" className="text-[11px] font-bold text-emerald-700">Lihat Detail</Link>}>
                <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className={`rounded-lg border p-2.5 ${settlementStats.outstanding > 0 ? 'border-red-200 bg-red-50' : 'border-zinc-200 bg-white'}`}>
                        <div className="text-xs font-medium text-slate-500">Belum Disetor</div>
                        <div className={`mt-0.5 text-base font-bold tabular-nums ${settlementStats.outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(settlementStats.outstanding)}</div>
                    </div>
                    <ValueStat label="Margin Bulan Ini" value={settlementStats.margin} />
                    <ValueStat label="Sudah Diverifikasi" value={settlementStats.verifiedPayments} />
                    <ValueStat label="Menunggu Verifikasi" value={settlementStats.pendingPayments} />
                </div>
            </SectionCard>

            {/* Quick Actions */}
            <div className="mb-4 flex gap-2 overflow-x-auto scrollbar-none pb-1">
                <Link href="/outlet/orders?status=pending_confirmation" className="shrink-0 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white active:bg-emerald-800">
                    Proses Pesanan
                </Link>
                <Link href="/outlet/settlement" className="shrink-0 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold active:bg-zinc-50">
                    Settlement
                </Link>
                <Link href="/outlet/inventory" className="shrink-0 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold active:bg-zinc-50">
                    Inventaris
                </Link>
                <Link href="/outlet/restocks/create" className="shrink-0 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold active:bg-zinc-50">
                    Request Restock
                </Link>
                <Link href="/outlet/returns/create" className="shrink-0 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold active:bg-zinc-50">
                    Ajukan Return
                </Link>
                <Link href="/outlet/exchanges/create" className="shrink-0 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold active:bg-zinc-50">
                    Ajukan Tukar Produk
                </Link>
            </div>

            {/* Low Stock Warning */}
            {lowStockItems.length > 0 && (
                <SectionCard label="Stok Rendah" className="mb-4" labelRight={<Link href="/outlet/inventory" className="text-[11px] font-bold text-emerald-700">Lihat Semua</Link>}>
                    <div className="mt-2 space-y-2">
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

            {/* Recent Orders */}
            {recentOrders.length > 0 && (
                <SectionCard label="Pesanan Aktif" className="mb-4" labelRight={<Link href="/outlet/orders" className="text-[11px] font-bold text-emerald-700">Lihat Semua</Link>}>
                    <div className="mt-2 space-y-2">
                        {recentOrders.map((order: any) => (
                            <Link key={order.id} href={`/outlet/orders/${order.id}`} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-white px-3 py-3 active:bg-zinc-50">
                                <div>
                                    <div className="text-sm font-medium">{order.order_code}</div>
                                    <div className="text-xs text-zinc-500">{order.customer_name} · {formatCurrency(order.total)}</div>
                                </div>
                                <OrderStatusBadge status={order.status} />
                            </Link>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Empty State */}
            {!hasUrgentActions && recentOrders.length === 0 && settlementStats.outstanding <= 0 && (
                <div className="mt-6">
                    <EmptyState
                        icon={<Sparkles className="h-8 w-8 text-slate-400" />}
                        title="Semua beres!"
                        description="Tidak ada tugas yang perlu ditangani saat ini."
                    />
                </div>
            )}
        </OutletLayout>
    );
}

function MiniStat({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
    return (
        <div className={`rounded-lg border p-2.5 ${alert ? 'border-amber-200' : 'border-zinc-200'} bg-white`}>
            <div className="text-xs font-medium text-slate-500">{label}</div>
            <div className="mt-0.5 flex items-center gap-1.5">
                <span className="text-xl font-bold text-slate-900">{value}</span>
                {alert && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
            </div>
        </div>
    );
}

function ValueStat({ label, value }: { label: string; value: number | string }) {
    return (
        <div className="rounded-lg border border-zinc-200 bg-white p-2.5">
            <div className="text-xs font-medium text-slate-500">{label}</div>
            <div className="mt-0.5 text-base font-bold tabular-nums text-slate-900">{formatCurrency(Number(value ?? 0))}</div>
        </div>
    );
}
