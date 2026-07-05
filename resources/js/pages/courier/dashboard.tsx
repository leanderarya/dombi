import { Head, Link, router } from '@inertiajs/react';
import { AlertCircle, ArrowRight, MapPin, Package } from 'lucide-react';
import { useState } from 'react';
import EmptyState from '@/components/ui/empty-state';
import SectionCard from '@/components/ui/section-card';
import StatusBadge from '@/components/ui/status-badge';
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

    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    const handleAvailabilityToggle = () => {
        setLoadingAction('availability');
        router.post('/courier/availability/toggle', {}, {
            preserveScroll: true,
            onFinish: () => setLoadingAction(null),
        });
    };

    const handleShiftStart = () => {
        setLoadingAction('shift-start');
        router.post('/courier/shift/start', {}, {
            preserveScroll: true,
            onFinish: () => setLoadingAction(null),
        });
    };

    const handleShiftEnd = () => {
        setLoadingAction('shift-end');
        router.post('/courier/shift/end', {}, {
            preserveScroll: true,
            onFinish: () => setLoadingAction(null),
        });
    };

    return (
        <CourierLayout>
            <Head title="Tugas Saya" />

            {/* Availability Card — large touch targets for outdoor */}
            <SectionCard>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className={`h-3.5 w-3.5 rounded-full ${courier.is_online ? 'bg-emerald-500' : 'bg-text-subtle'}`} />
                        <div>
                            <div className="text-base font-bold text-text">
                                {courier.is_online ? 'Online' : 'Offline'}
                            </div>
                            {courier.is_on_shift && courier.shift_started_at && (
                                <div className="text-xs text-text-muted">
                                    Shift sejak {new Date(courier.shift_started_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleAvailabilityToggle}
                            disabled={loadingAction !== null}
                            className={`min-h-11 rounded-lg px-5 py-3 text-sm font-bold transition-colors disabled:opacity-50 ${
                                courier.is_online
                                    ? 'border border-border bg-white text-text active:bg-surface-muted'
                                    : 'bg-primary text-white active:opacity-80'
                            }`}
                        >
                            {loadingAction === 'availability' ? '...' : courier.is_online ? 'Offline' : 'Online'}
                        </button>
                        {!courier.is_on_shift ? (
                            <button
                                onClick={handleShiftStart}
                                disabled={loadingAction !== null}
                                className="min-h-11 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-white transition-colors active:opacity-80 disabled:opacity-50"
                            >
                                {loadingAction === 'shift-start' ? '...' : 'Mulai Shift'}
                            </button>
                        ) : (
                            <button
                                onClick={handleShiftEnd}
                                disabled={loadingAction !== null}
                                className="min-h-11 rounded-lg border border-red-200 bg-white px-5 py-3 text-sm font-bold text-red-600 transition-colors active:bg-red-50 disabled:opacity-50"
                            >
                                {loadingAction === 'shift-end' ? '...' : 'Akhiri Shift'}
                            </button>
                        )}
                    </div>
                </div>
            </SectionCard>

            {/* Stats Summary — high contrast for outdoor */}
            <div className="mt-4 grid grid-cols-4 gap-2">
                <StatCard label="Pickup" value={stats.waitingPickup} />
                <StatCard label="Antar" value={stats.inTransit} />
                <StatCard label="Selesai" value={stats.completedToday} />
                <StatCard label="Gagal" value={stats.failedToday} dimmed={stats.failedToday === 0} />
            </div>

            {/* In Transit — highest priority */}
            {tasks.inTransit.length > 0 && (
                <div className="mt-4">
                    <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-text-subtle">Sedang Diantar</h2>
                    <div className="space-y-2">
                        {tasks.inTransit.map((task) => (
                            <Link
                                key={task.id}
                                href={`/courier/deliveries/${task.id}`}
                                className="block rounded-xl border border-border bg-white p-4 transition-all hover:shadow-sm active:opacity-80"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="text-base font-bold text-text">{task.order_code}</div>
                                        <div className="mt-1 text-sm font-medium text-text">{task.customer_name}</div>
                                        <div className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
                                            <MapPin className="h-4 w-4 shrink-0" />
                                            <span className="line-clamp-1">{task.customer_address}</span>
                                        </div>
                                    </div>
                                    <StatusBadge status={task.status ?? 'delivering'} />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Waiting Pickup */}
            {tasks.waitingPickup.length > 0 && (
                <div className="mt-4">
                    <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-text-subtle">Menunggu Pickup ({tasks.waitingPickup.length})</h2>
                    <div className="space-y-2">
                        {tasks.waitingPickup.map((task) => (
                            <Link
                                key={task.id}
                                href={`/courier/deliveries/${task.id}`}
                                className="block rounded-xl border border-border bg-white p-4 transition-all hover:shadow-sm active:opacity-80"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="text-base font-bold text-text">{task.order_code}</div>
                                        <div className="mt-1 text-sm font-medium text-text">{task.customer_name}</div>
                                        <div className="mt-1 text-sm text-text-muted">Outlet: {task.outlet_name}</div>
                                    </div>
                                    {task.age_minutes !== undefined && task.age_minutes > 15 && (
                                        <span className={`rounded-md px-2 py-1 text-xs font-bold ring-1 ${
                                            task.age_minutes > 30
                                                ? 'bg-red-100 text-red-800 ring-red-200'
                                                : 'bg-amber-100 text-amber-800 ring-amber-200'
                                        }`}>
                                            {task.age_minutes}m
                                        </span>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Needs Action */}
            {tasks.needsAction.length > 0 && (
                <div className="mt-4">
                    <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-text-subtle">Perlu Tindakan ({tasks.needsAction.length})</h2>
                    <div className="space-y-2">
                        {tasks.needsAction.map((task) => (
                            <Link
                                key={task.id}
                                href={`/courier/deliveries/${task.id}`}
                                className="block rounded-xl border border-border bg-white p-4 transition-all hover:shadow-sm active:opacity-80"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="text-base font-bold text-text">{task.order_code}</div>
                                        <div className="mt-1 text-sm font-medium text-text">{task.customer_name}</div>
                                        {task.failed_reason && (
                                            <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                                                <AlertCircle className="h-4 w-4 shrink-0" />
                                                {task.failed_reason}
                                            </div>
                                        )}
                                    </div>
                                    <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700 ring-1 ring-red-200">
                                        Gagal
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Completed Today */}
            {tasks.completedToday.length > 0 && (
                <div className="mt-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-text-subtle">Selesai Hari Ini ({tasks.completedToday.length})</h2>
                        <Link href="/courier/deliveries?status=completed" className="min-h-11 inline-flex items-center gap-1 rounded-lg bg-surface-muted px-3 text-xs font-bold text-text active:opacity-80">
                            Semua
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                    <div className="space-y-2">
                        {tasks.completedToday.slice(0, 5).map((task) => (
                            <div
                                key={task.id}
                                className="flex items-center justify-between rounded-xl border border-border bg-white p-4"
                            >
                                <div>
                                    <div className="text-sm font-bold text-text">{task.order_code}</div>
                                    <div className="mt-0.5 text-sm text-text-muted">{task.customer_name}</div>
                                </div>
                                {task.delivered_to && (
                                    <span className="rounded-md bg-primary-light px-2.5 py-1 text-xs font-bold text-primary ring-1 ring-primary/20">
                                        → {task.delivered_to}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {tasks.waitingPickup.length === 0 && tasks.inTransit.length === 0 && tasks.needsAction.length === 0 && (
                <EmptyState
                    icon={<Package className="h-12 w-12 text-text-subtle" />}
                    title="Tidak ada tugas aktif"
                    description="Tugas baru akan muncul saat Anda di-assign."
                />
            )}
        </CourierLayout>
    );
}

function StatCard({ label, value, dimmed }: { label: string; value: number; dimmed?: boolean }) {
    return (
        <div className={`rounded-xl border border-border bg-white p-3 text-center ${dimmed ? 'opacity-50' : ''}`}>
            <div className="text-2xl font-bold text-text tabular-nums">{value}</div>
            <div className="text-xs font-bold uppercase tracking-wider text-text-muted">{label}</div>
        </div>
    );
}
