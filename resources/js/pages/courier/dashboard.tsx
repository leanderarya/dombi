import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { AlertCircle, CheckCircle2, MapPin, Package } from 'lucide-react';
import DeliveryStatusBadge from '@/components/delivery-status-badge';
import SectionCard from '@/components/ui/section-card';
import EmptyState from '@/components/ui/empty-state';
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

export default function CourierDashboard({ courier: initialCourier, stats, performance, tasks }: Props) {
    usePolling(15000);

    const [courier, setCourier] = useState(initialCourier);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    const handleAvailabilityToggle = async () => {
        setLoadingAction('availability');
        try {
            const res = await fetch('/courier/availability/toggle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
                },
            });
            if (res.ok) {
                const data = await res.json();
                setCourier((prev) => ({ ...prev, is_online: data.is_online }));
            }
        } catch {
            // Silently fail
        } finally {
            setLoadingAction(null);
        }
    };

    const handleShiftStart = async () => {
        setLoadingAction('shift-start');
        try {
            const res = await fetch('/courier/shift/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
                },
            });
            if (res.ok) {
                const data = await res.json();
                setCourier((prev) => ({
                    ...prev,
                    is_online: data.is_online,
                    is_on_shift: true,
                    shift_started_at: data.shift_started_at,
                }));
            }
        } catch {
            // Silently fail
        } finally {
            setLoadingAction(null);
        }
    };

    const handleShiftEnd = async () => {
        setLoadingAction('shift-end');
        try {
            const res = await fetch('/courier/shift/end', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
                },
            });
            if (res.ok) {
                const data = await res.json();
                setCourier((prev) => ({
                    ...prev,
                    is_online: data.is_online,
                    is_on_shift: false,
                    shift_ended_at: data.shift_ended_at,
                }));
            }
        } catch {
            // Silently fail
        } finally {
            setLoadingAction(null);
        }
    };

    return (
        <CourierLayout>
            <Head title="Tugas Saya" />

            {/* Availability Card */}
            <SectionCard className="mb-4">
                <div className="flex items-center justify-between">
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
                            onClick={handleAvailabilityToggle}
                            disabled={loadingAction !== null}
                            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                                courier.is_online
                                    ? 'border border-zinc-200 bg-white text-slate-600 active:bg-zinc-50'
                                    : 'bg-emerald-700 text-white active:bg-emerald-800'
                            }`}
                        >
                            {loadingAction === 'availability' ? '...' : courier.is_online ? 'Go Offline' : 'Go Online'}
                        </button>
                        {!courier.is_on_shift ? (
                            <button
                                onClick={handleShiftStart}
                                disabled={loadingAction !== null}
                                className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition-colors active:bg-emerald-800 disabled:opacity-50"
                            >
                                {loadingAction === 'shift-start' ? '...' : 'Mulai Shift'}
                            </button>
                        ) : (
                            <button
                                onClick={handleShiftEnd}
                                disabled={loadingAction !== null}
                                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition-colors active:bg-red-50 disabled:opacity-50"
                            >
                                {loadingAction === 'shift-end' ? '...' : 'Akhiri Shift'}
                            </button>
                        )}
                    </div>
                </div>
            </SectionCard>

            {/* Stats Summary */}
            <div className="mb-4 grid grid-cols-4 gap-2">
                <StatCard label="Pickup" value={stats.waitingPickup} />
                <StatCard label="Antar" value={stats.inTransit} />
                <StatCard label="Selesai" value={stats.completedToday} />
                <StatCard label="Gagal" value={stats.failedToday} />
            </div>

            {/* In Transit - Priority Focus */}
            {tasks.inTransit.length > 0 && (
                <div className="mb-5">
                    <SectionCard label="Sedang Diantar">
                        <div className="mt-2 space-y-3">
                            {tasks.inTransit.map((task) => (
                                <Link
                                    key={task.id}
                                    href={`/courier/deliveries/${task.id}`}
                                    className="block -mx-4 -mb-4 rounded-xl p-4 transition-colors active:bg-zinc-50"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-bold text-slate-900">{task.order_code}</div>
                                            <div className="mt-1 text-sm text-slate-600">{task.customer_name}</div>
                                            <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                                                <MapPin className="h-3 w-3" />
                                                <span className="line-clamp-1">{task.customer_address}</span>
                                            </div>
                                        </div>
                                        <DeliveryStatusBadge status={task.status ?? 'delivering'} />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* Waiting Pickup */}
            {tasks.waitingPickup.length > 0 && (
                <div className="mb-5">
                    <SectionCard label={`Menunggu Pickup (${tasks.waitingPickup.length})`}>
                        <div className="mt-2 space-y-3">
                            {tasks.waitingPickup.map((task) => (
                                <Link
                                    key={task.id}
                                    href={`/courier/deliveries/${task.id}`}
                                    className="block -mx-4 -mb-4 rounded-xl p-4 transition-colors active:bg-zinc-50"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-bold text-slate-900">{task.order_code}</div>
                                            <div className="mt-0.5 text-xs text-slate-600">{task.customer_name}</div>
                                            <div className="mt-0.5 text-[11px] text-slate-500">Outlet: {task.outlet_name}</div>
                                        </div>
                                        {task.age_minutes !== undefined && task.age_minutes > 15 && (
                                            <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">
                                                {task.age_minutes}m
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* Needs Action */}
            {tasks.needsAction.length > 0 && (
                <div className="mb-5">
                    <SectionCard label={`Perlu Tindakan (${tasks.needsAction.length})`}>
                        <div className="mt-2 space-y-3">
                            {tasks.needsAction.map((task) => (
                                <Link
                                    key={task.id}
                                    href={`/courier/deliveries/${task.id}`}
                                    className="block -mx-4 -mb-4 rounded-xl p-4 transition-colors active:bg-zinc-50"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-bold text-slate-900">{task.order_code}</div>
                                            <div className="mt-0.5 text-xs text-slate-600">{task.customer_name}</div>
                                            {task.failed_reason && (
                                                <div className="mt-2 flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">
                                                    <AlertCircle className="h-3 w-3" />
                                                    {task.failed_reason}
                                                </div>
                                            )}
                                        </div>
                                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 ring-1 ring-red-200">
                                            Gagal
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* Completed Today */}
            {tasks.completedToday.length > 0 && (
                <div className="mb-5">
                    <SectionCard
                        label={`Selesai Hari Ini (${tasks.completedToday.length})`}
                        labelRight={
                            <Link href="/courier/deliveries?status=completed" className="text-[11px] font-bold text-emerald-700">
                                Lihat Semua
                            </Link>
                        }
                    >
                        <div className="mt-2 space-y-3">
                            {tasks.completedToday.slice(0, 5).map((task) => (
                                <div
                                    key={task.id}
                                    className="-mx-4 -mb-4 flex items-center justify-between rounded-xl p-4"
                                >
                                    <div>
                                        <div className="text-sm font-medium text-slate-700">{task.order_code}</div>
                                        <div className="text-xs text-slate-500">{task.customer_name}</div>
                                    </div>
                                    {task.delivered_to && (
                                        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                                            → {task.delivered_to}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* Empty State */}
            {tasks.waitingPickup.length === 0 && tasks.inTransit.length === 0 && tasks.needsAction.length === 0 && (
                <EmptyState
                    icon={<Package className="h-12 w-12 text-slate-300" />}
                    title="Tidak ada tugas aktif"
                    description="Tugas baru akan muncul saat Anda di-assign."
                />
            )}
        </CourierLayout>
    );
}

function StatCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-xl border border-zinc-200 bg-white p-3 text-center">
            <div className="text-2xl font-bold text-slate-900">{value}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
        </div>
    );
}
