import { Head, Link, router } from '@inertiajs/react';
import DeliveryStatusBadge from '@/components/delivery-status-badge';
import CourierLayout from '@/layouts/courier-layout';
import { usePolling } from '@/lib/use-polling';

interface TaskItem {
    id: number;
    order_code: string;
    customer_name: string;
    customer_address?: string;
    outlet_name?: string;
    status?: string;
    assigned_at?: string;
    pickup_time?: string;
    delivered_time?: string;
    delivered_to?: string;
    failed_reason?: string;
    updated_at?: string;
    age_minutes?: number;
}

interface CourierData {
    id: number;
    name: string;
    is_online: boolean;
    is_on_shift: boolean;
    shift_started_at: string | null;
}

interface Props {
    courier: CourierData;
    stats: {
        waitingPickup: number;
        inTransit: number;
        completedToday: number;
        failedToday: number;
    };
    performance: {
        successRate: number;
        avgDeliveryTime: number | null;
        capacityStatus: string;
        activeDeliveries: number;
    };
    tasks: {
        waitingPickup: TaskItem[];
        inTransit: TaskItem[];
        needsAction: TaskItem[];
        completedToday: TaskItem[];
    };
}

export default function CourierDashboard({ courier, stats, performance, tasks }: Props) {
    usePolling(15000);

    const toggleOnline = () => {
        router.post('/courier/availability/toggle', {}, { preserveScroll: true });
    };

    const startShift = () => {
        router.post('/courier/shift/start', {}, { preserveScroll: true });
    };

    const endShift = () => {
        router.post('/courier/shift/end', {}, { preserveScroll: true });
    };

    return (
        <CourierLayout>
            <Head title="Dashboard" />

            {/* Availability Bar */}
            <div className="mb-5 flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${courier.is_online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <div>
                        <div className="text-sm font-semibold text-slate-900">
                            {courier.is_online ? 'Online' : 'Offline'}
                        </div>
                        {courier.is_on_shift && courier.shift_started_at && (
                            <div className="text-[11px] text-slate-500">
                                Shift sejak {new Date(courier.shift_started_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={toggleOnline}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                            courier.is_online
                                ? 'border border-zinc-200 bg-white text-slate-600 active:bg-zinc-50'
                                : 'bg-emerald-700 text-white active:bg-emerald-800'
                        }`}
                    >
                        {courier.is_online ? 'Go Offline' : 'Go Online'}
                    </button>
                    {!courier.is_on_shift ? (
                        <button
                            onClick={startShift}
                            className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition-colors active:bg-emerald-800"
                        >
                            Mulai Shift
                        </button>
                    ) : (
                        <button
                            onClick={endShift}
                            className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition-colors active:bg-red-50"
                        >
                            Akhiri Shift
                        </button>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="mb-5 grid grid-cols-4 gap-2">
                <StatCard label="Pickup" value={stats.waitingPickup} color="amber" />
                <StatCard label="Antar" value={stats.inTransit} color="blue" />
                <StatCard label="Selesai" value={stats.completedToday} color="emerald" />
                <StatCard label="Gagal" value={stats.failedToday} color="red" />
            </div>

            {/* Active Delivery Focus */}
            {tasks.inTransit.length > 0 && (
                <section className="mb-5">
                    <SectionLabel>Sedang Diantar</SectionLabel>
                    <div className="mt-2 space-y-2">
                        {tasks.inTransit.map((task) => (
                            <Link
                                key={task.id}
                                href={`/courier/deliveries/${task.id}`}
                                className="block rounded-lg border-2 border-blue-200 bg-blue-50 p-4 transition-colors active:bg-blue-100"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-bold text-blue-900">{task.order_code}</div>
                                        <div className="mt-1 text-sm text-blue-700">{task.customer_name}</div>
                                        <div className="mt-0.5 text-xs text-blue-600 line-clamp-2">{task.customer_address}</div>
                                    </div>
                                    <DeliveryStatusBadge status={task.status ?? 'delivering'} />
                                </div>
                                <div className="mt-3 flex gap-2">
                                    <span className="rounded-md bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                                        📞 Hubungi
                                    </span>
                                    <span className="rounded-md bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                                        🗺️ Maps
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Waiting Pickup */}
            {tasks.waitingPickup.length > 0 && (
                <section className="mb-5">
                    <SectionLabel>Menunggu Pickup ({tasks.waitingPickup.length})</SectionLabel>
                    <div className="mt-2 space-y-2">
                        {tasks.waitingPickup.map((task) => (
                            <Link
                                key={task.id}
                                href={`/courier/deliveries/${task.id}`}
                                className="block rounded-lg border border-amber-200 bg-amber-50 p-4 transition-colors active:bg-amber-100"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-bold text-amber-900">{task.order_code}</div>
                                        <div className="mt-0.5 text-xs text-amber-700">{task.customer_name}</div>
                                        <div className="mt-0.5 text-[11px] text-amber-600">Outlet: {task.outlet_name}</div>
                                    </div>
                                    {task.age_minutes !== undefined && task.age_minutes > 15 && (
                                        <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                            {task.age_minutes}m
                                        </span>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Needs Action */}
            {tasks.needsAction.length > 0 && (
                <section className="mb-5">
                    <SectionLabel>Perlu Tindakan ({tasks.needsAction.length})</SectionLabel>
                    <div className="mt-2 space-y-2">
                        {tasks.needsAction.map((task) => (
                            <Link
                                key={task.id}
                                href={`/courier/deliveries/${task.id}`}
                                className="block rounded-lg border border-red-200 bg-red-50 p-4 transition-colors active:bg-red-100"
                            >
                                <div className="text-sm font-bold text-red-900">{task.order_code}</div>
                                <div className="mt-0.5 text-xs text-red-700">{task.customer_name}</div>
                                {task.failed_reason && (
                                    <div className="mt-2 rounded-md bg-red-100 px-2 py-1.5 text-xs text-red-700">
                                        {task.failed_reason}
                                    </div>
                                )}
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Completed Today */}
            {tasks.completedToday.length > 0 && (
                <section className="mb-5">
                    <div className="flex items-center justify-between">
                        <SectionLabel>Selesai Hari Ini ({tasks.completedToday.length})</SectionLabel>
                        <Link href="/courier/deliveries?status=completed" className="text-[11px] font-bold text-emerald-700">
                            Lihat Semua
                        </Link>
                    </div>
                    <div className="mt-2 space-y-2">
                        {tasks.completedToday.slice(0, 5).map((task) => (
                            <div
                                key={task.id}
                                className="rounded-lg border border-zinc-200 bg-white p-3"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-medium text-slate-700">{task.order_code}</div>
                                        <div className="text-xs text-slate-500">{task.customer_name}</div>
                                    </div>
                                    {task.delivered_to && (
                                        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                            → {task.delivered_to}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Empty State */}
            {tasks.waitingPickup.length === 0 && tasks.inTransit.length === 0 && tasks.needsAction.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <span className="text-4xl">📦</span>
                    <p className="mt-2 text-sm font-medium text-slate-600">Tidak ada tugas aktif</p>
                    <p className="mt-1 text-xs text-slate-400">Tugas baru akan muncul saat Anda di-assign.</p>
                </div>
            )}
        </CourierLayout>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">{children}</h2>;
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    const colorClasses: Record<string, string> = {
        amber: 'border-amber-100 bg-amber-50 text-amber-700',
        blue: 'border-blue-100 bg-blue-50 text-blue-700',
        emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
        red: 'border-red-100 bg-red-50 text-red-700',
    };

    return (
        <div className={`rounded-lg border p-3 text-center ${colorClasses[color] ?? 'border-zinc-200 bg-white'}`}>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider">{label}</div>
        </div>
    );
}
