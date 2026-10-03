import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    AlertTriangle,
    ArrowRight,
    MapPin,
    Package,
} from 'lucide-react';
import { useState } from 'react';
import PushBanner from '@/components/shared/push-banner';
import { Button } from '@/components/ui/button';
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
}

interface Props {
    courier: CourierData;
    stats: {
        waitingPickup: number;
        inTransit: number;
        completedToday: number;
        failedToday: number;
    };
    tasks: {
        waitingPickup: TaskItem[];
        inTransit: TaskItem[];
        needsAction: TaskItem[];
        completedToday: TaskItem[];
    };
}

export default function CourierDashboard({ courier, stats, tasks }: Props) {
    usePolling(15000);

    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    const handleAvailabilityToggle = () => {
        setLoadingAction('availability');
        router.post(
            '/courier/availability/toggle',
            {},
            {
                preserveScroll: true,
                onFinish: () => setLoadingAction(null),
            },
        );
    };

    return (
        <CourierLayout>
            <Head title="Tugas Saya" />

            <div className="mb-4">
                <PushBanner variant="home" />
            </div>

            {/* Availability Card — large touch targets for outdoor */}
            {/*
             * `flex-wrap`: at 200% text the label and the toggle together
             * measure wider than this 260px row and push the document to
             * 413px on a 390px viewport. The toggle drops to its own line.
             */}
            <SectionCard>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <div
                            className={`h-3.5 w-3.5 rounded-full ${courier.is_online ? 'bg-primary' : 'bg-text-subtle'}`}
                        />
                        <div className="text-base font-bold text-text">
                            {courier.is_online ? 'Online' : 'Offline'}
                        </div>
                    </div>
                    <Button
                        onClick={handleAvailabilityToggle}
                        disabled={loadingAction !== null}
                        className={`min-h-11 rounded-lg px-5 py-3 text-sm font-bold transition-colors disabled:opacity-50 ${
                            courier.is_online
                                ? 'border border-border bg-surface text-text active:bg-surface-muted'
                                : 'bg-primary text-white active:opacity-80'
                        }`}
                    >
                        {loadingAction === 'availability'
                            ? '...'
                            : courier.is_online
                              ? 'Offline'
                              : 'Online'}
                    </Button>
                </div>
                {errors.availability && (
                    <div className="mt-3 flex items-start gap-3 rounded-lg border border-danger-border bg-danger-bg p-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                        <div className="text-sm text-danger-text">
                            {errors.availability}
                        </div>
                    </div>
                )}
            </SectionCard>

            {/*
             * `auto-fit` rather than `grid-cols-4`: at 200% text each
             * `1fr` track floors at 20px while the `text-2xl` number
             * needs 31px, so all four numbers spill 11px past their
             * cells and widen the document to 401px. `minmax(4.5rem,
             * 1fr)` gives four columns at the normal size (5 would need
             * 392px, there are 358) and drops to two at 200%.
             */}
            <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] gap-2">
                <StatCard label="Pickup" value={stats.waitingPickup} />
                <StatCard label="Antar" value={stats.inTransit} />
                <StatCard label="Selesai" value={stats.completedToday} />
                <StatCard
                    label="Gagal"
                    value={stats.failedToday}
                    dimmed={stats.failedToday === 0}
                />
            </div>

            {/* In Transit — highest priority */}
            {tasks.inTransit.length > 0 && (
                <div className="mt-4">
                    <h2 className="mb-3 text-xs font-bold tracking-wider text-text-muted uppercase">
                        Sedang Diantar
                    </h2>
                    <div className="space-y-2">
                        {tasks.inTransit.map((task) => (
                            <Link
                                key={task.id}
                                href={`/courier/deliveries/${task.id}`}
                                className="block rounded-xl border border-border bg-surface p-4 transition-all hover:shadow-sm active:opacity-80"
                            >
                                {/*
                                 * `flex-1 min-w-32` (a 128px floor), not
                                 * `grow`: `flex-1` is `flex-basis: 0%`,
                                 * so with `min-width: 0` the column's
                                 * hypothetical main size is 0, the row
                                 * never wraps, and at 200% text the
                                 * badge kept its 257px and squeezed
                                 * this column to 3px. `grow` fixes
                                 * that but over-corrects -- its
                                 * max-content basis wraps the badge
                                 * onto a second line even at 100%.
                                 * The floor is the width the wrap
                                 * decision actually needs.
                                 */}
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-32 flex-1">
                                        <div className="text-base font-bold text-text">
                                            {task.order_code}
                                        </div>
                                        <div className="mt-1 text-sm font-medium text-text">
                                            {task.customer_name}
                                        </div>
                                        <div className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
                                            <MapPin className="h-4 w-4 shrink-0" />
                                            <span className="line-clamp-1 min-w-0">
                                                {task.customer_address}
                                            </span>
                                        </div>
                                    </div>
                                    <StatusBadge
                                        className="shrink-0"
                                        status={task.status ?? 'delivering'}
                                    />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Waiting Pickup */}
            {tasks.waitingPickup.length > 0 && (
                <div className="mt-4">
                    <h2 className="mb-3 text-xs font-bold tracking-wider text-text-muted uppercase">
                        Menunggu Pickup ({tasks.waitingPickup.length})
                    </h2>
                    <div className="space-y-2">
                        {tasks.waitingPickup.map((task) => (
                            <Link
                                key={task.id}
                                href={`/courier/deliveries/${task.id}`}
                                className="block rounded-xl border border-border bg-surface p-4 transition-all hover:shadow-sm active:opacity-80"
                            >
                                {/* Same wrap/shrink guard as the in-transit card above. */}
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-32 flex-1">
                                        <div className="text-base font-bold text-text">
                                            {task.order_code}
                                        </div>
                                        <div className="mt-1 text-sm font-medium text-text">
                                            {task.customer_name}
                                        </div>
                                        <div className="mt-1 text-sm text-text-muted">
                                            Outlet: {task.outlet_name}
                                        </div>
                                    </div>
                                    {task.age_minutes !== undefined &&
                                        task.age_minutes > 15 && (
                                            <span
                                                className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ring-1 ${
                                                    task.age_minutes > 30
                                                        ? 'bg-danger-bg text-danger-text ring-danger-border'
                                                        : 'bg-warning-bg text-warning-text ring-warning-border'
                                                }`}
                                            >
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
                    <h2 className="mb-3 text-xs font-bold tracking-wider text-text-muted uppercase">
                        Perlu Tindakan ({tasks.needsAction.length})
                    </h2>
                    <div className="space-y-2">
                        {tasks.needsAction.map((task) => (
                            <Link
                                key={task.id}
                                href={`/courier/deliveries/${task.id}`}
                                className="block rounded-xl border border-border bg-surface p-4 transition-all hover:shadow-sm active:opacity-80"
                            >
                                {/* Same wrap/shrink guard as the two cards above. */}
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-32 flex-1">
                                        <div className="text-base font-bold text-text">
                                            {task.order_code}
                                        </div>
                                        <div className="mt-1 text-sm font-medium text-text">
                                            {task.customer_name}
                                        </div>
                                        {task.failed_reason && (
                                            <div className="mt-2 flex items-center gap-2 rounded-lg bg-danger-bg px-3 py-2 text-sm font-medium text-danger-text">
                                                <AlertCircle className="h-4 w-4 shrink-0" />
                                                {task.failed_reason}
                                            </div>
                                        )}
                                    </div>
                                    <span className="shrink-0 rounded-full bg-danger-bg px-2.5 py-1 text-xs font-bold text-danger-text ring-1 ring-danger-border">
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
                        <h2 className="text-xs font-bold tracking-wider text-text-muted uppercase">
                            Selesai Hari Ini ({tasks.completedToday.length})
                        </h2>
                        <Link
                            href="/courier/deliveries?status=completed"
                            className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-surface-muted px-3 text-xs font-bold text-text active:opacity-80"
                        >
                            Semua
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                    <div className="space-y-2">
                        {tasks.completedToday.slice(0, 5).map((task) => (
                            <div
                                key={task.id}
                                className="flex items-center justify-between rounded-xl border border-border bg-surface p-4"
                            >
                                <div>
                                    <div className="text-sm font-bold text-text">
                                        {task.order_code}
                                    </div>
                                    <div className="mt-0.5 text-sm text-text-muted">
                                        {task.customer_name}
                                    </div>
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
            {tasks.waitingPickup.length === 0 &&
                tasks.inTransit.length === 0 &&
                tasks.needsAction.length === 0 && (
                    <EmptyState
                        icon={
                            <Package className="h-12 w-12 text-text-subtle" />
                        }
                        title="Tidak ada tugas aktif"
                        description="Tugas baru akan muncul saat Anda di-assign."
                    />
                )}
        </CourierLayout>
    );
}

function StatCard({
    label,
    value,
    dimmed,
}: {
    label: string;
    value: number;
    dimmed?: boolean;
}) {
    return (
        <div
            className={`rounded-xl border border-border bg-surface p-3 text-center ${dimmed ? 'opacity-50' : ''}`}
        >
            <div className="text-2xl font-bold text-text tabular-nums">
                {value}
            </div>
            <div className="text-xs font-bold tracking-wider text-text-muted uppercase">
                {label}
            </div>
        </div>
    );
}
