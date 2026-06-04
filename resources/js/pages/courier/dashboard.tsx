import { Head, Link } from '@inertiajs/react';
import DeliveryStatusBadge from '@/components/delivery-status-badge';
import CourierLayout from '@/layouts/courier-layout';
import { formatDeliveryAge } from '@/lib/format';
import { usePolling } from '@/lib/use-polling';

export default function CourierDashboard({ stats, performance, nextPickup, activeDeliveries }: any) {
    usePolling(15000);
    const hasActive = activeDeliveries.length > 0;

    return (
        <CourierLayout>
            <Head title="Courier Dashboard" />
            <h1 className="text-xl font-semibold sm:text-2xl">Dashboard</h1>

            {/* Performance Summary */}
            {performance && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Performa Hari Ini</h2>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-emerald-700">{performance.successRate}%</div>
                            <div className="text-[11px] text-slate-500">Tingkat Sukses</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-blue-700">{performance.avgDeliveryTime ?? '-'}m</div>
                            <div className="text-[11px] text-slate-500">Rata-rata Kirim</div>
                        </div>
                        <div className="text-center">
                            <CapacityBadge status={performance.capacityStatus} count={performance.activeDeliveries} />
                            <div className="text-[11px] text-slate-500">Kapasitas</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats - mobile 2 cols */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <StatCard label="Waiting Pickup" value={stats.waitingPickup} color="yellow" urgent={stats.waitingPickup > 0} />
                <StatCard label="Picked Up" value={stats.pickedUp} color="blue" />
                <StatCard label="Delivering" value={stats.delivering} color="purple" urgent={stats.delivering > 0} />
                <StatCard label="Selesai Hari Ini" value={stats.completedToday} color="green" />
                <StatCard label="Gagal Hari Ini" value={stats.failedToday} color="red" />
            </div>

            {/* Next Pickup */}
            {nextPickup && (
                <section className="mt-5">
                    <h2 className="text-sm font-semibold text-slate-700">Pickup Berikutnya</h2>
                    <Link href={`/courier/deliveries/${nextPickup.id}`} className="mt-2 block rounded-xl border border-amber-200 bg-amber-50 p-4 active:bg-amber-100">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="font-medium text-amber-900">{nextPickup.order?.order_code}</div>
                                <div className="mt-1 text-sm text-amber-700">{nextPickup.order?.customer_name}</div>
                                <div className="mt-0.5 text-xs text-amber-600 line-clamp-1">{nextPickup.order?.customer_address}</div>
                                <div className="mt-1 text-xs text-amber-600">Outlet: {nextPickup.order?.outlet?.name ?? '-'}</div>
                                {nextPickup.assigned_at && (
                                    <div className="mt-1 text-xs font-medium text-amber-700">
                                        Di-assign {formatDeliveryAge(nextPickup.assigned_at ? Math.floor((Date.now() - new Date(nextPickup.assigned_at).getTime()) / 60000) : null)} lalu
                                    </div>
                                )}
                            </div>
                            <DeliveryStatusBadge status={nextPickup.status} />
                        </div>
                    </Link>
                </section>
            )}

            {/* Quick Actions */}
            <div className="mt-5 flex gap-2">
                <Link href="/courier/deliveries?status=waiting_pickup" className="flex-1 rounded-lg bg-emerald-700 px-4 py-3 text-center text-sm font-medium text-white active:bg-emerald-800">
                    Pickup ({stats.waitingPickup})
                </Link>
                <Link href="/courier/deliveries?status=delivering" className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-medium active:bg-zinc-50">
                    Delivering ({stats.delivering})
                </Link>
            </div>

            {/* Active Deliveries */}
            {hasActive && (
                <section className="mt-6">
                    <h2 className="text-sm font-semibold text-slate-700">Delivery Aktif</h2>
                    <div className="mt-2 space-y-2">
                        {activeDeliveries.map((delivery: any) => (
                            <Link key={delivery.id} href={`/courier/deliveries/${delivery.id}`} className="block rounded-xl border border-zinc-100 bg-white p-4 active:bg-zinc-50">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium">{delivery.order?.order_code}</div>
                                        <div className="mt-1 text-sm text-zinc-600">{delivery.order?.customer_name}</div>
                                        <div className="mt-0.5 text-xs text-zinc-400 line-clamp-1">{delivery.order?.customer_address}</div>
                                        <div className="mt-1 text-xs text-zinc-500">Outlet: {delivery.order?.outlet?.name ?? '-'}</div>
                                    </div>
                                    <DeliveryStatusBadge status={delivery.status} />
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {!hasActive && (
                <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-zinc-100 bg-white py-12 text-center">
                    <span className="text-4xl">🎉</span>
                    <p className="mt-2 text-sm font-medium text-slate-600">Tidak ada delivery aktif</p>
                    <p className="text-xs text-slate-400">Delivery baru akan muncul saat kamu di-assign.</p>
                </div>
            )}

            {/* History link */}
            <div className="mt-6">
                <Link href="/courier/deliveries" className="block rounded-lg border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-medium text-slate-600 active:bg-zinc-50">
                    Lihat Semua Riwayat Delivery
                </Link>
            </div>
        </CourierLayout>
    );
}

function StatCard({ label, value, color, urgent }: { label: string; value: number; color?: string; urgent?: boolean }) {
    const colorClasses: Record<string, string> = {
        yellow: 'border-yellow-100 bg-yellow-50',
        blue: 'border-blue-100 bg-blue-50',
        purple: 'border-purple-100 bg-purple-50',
        green: 'border-green-100 bg-green-50',
        red: 'border-red-100 bg-red-50',
    };
    const base = colorClasses[color ?? ''] ?? 'border-zinc-100 bg-white';

    return (
        <div className={`rounded-xl border p-3 ${base} ${urgent ? 'ring-2 ring-amber-300' : ''}`}>
            <div className="text-xs font-medium text-slate-500">{label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
        </div>
    );
}

function CapacityBadge({ status, count }: { status: string; count: number }) {
    const config: Record<string, { label: string; color: string }> = {
        available: { label: 'Tersedia', color: 'text-emerald-700' },
        busy: { label: 'Sibuk', color: 'text-amber-700' },
        overloaded: { label: 'Overload', color: 'text-red-700' },
    };
    const c = config[status] ?? config.available;

    return (
        <div>
            <div className={`text-2xl font-bold ${c.color}`}>{count}</div>
            <div className={`text-[10px] font-bold ${c.color}`}>{c.label}</div>
        </div>
    );
}
