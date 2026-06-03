import { CheckCircle2, Circle, Clock, Package, Truck, UserCheck, MapPin, XCircle } from 'lucide-react';
import { formatDate } from '@/lib/format';

type TimelineStep = {
    key: string;
    label: string;
    icon: typeof CheckCircle2;
};

const TIMELINE_STEPS: TimelineStep[] = [
    { key: 'pending', label: 'Pesanan Dibuat', icon: Clock },
    { key: 'confirmed', label: 'Outlet Menyiapkan Pesanan', icon: Package },
    { key: 'preparing', label: 'Pesanan Sedang Disiapkan', icon: Package },
    { key: 'ready_for_pickup', label: 'Pesanan Siap', icon: Package },
    { key: 'picked_up', label: 'Kurir Mengambil Pesanan', icon: UserCheck },
    { key: 'delivering', label: 'Dalam Perjalanan', icon: Truck },
    { key: 'completed', label: 'Pesanan Selesai', icon: CheckCircle2 },
];

const CANCELLED_STEP: TimelineStep = { key: 'cancelled', label: 'Pesanan Dibatalkan', icon: XCircle };
const FAILED_STEP: TimelineStep = { key: 'failed', label: 'Pesanan Gagal', icon: XCircle };

type HistoryItem = {
    id?: number;
    to_status: string;
    notes?: string | null;
    created_at?: string | null;
    actor?: { name: string } | null;
};

type Props = {
    currentStatus: string;
    histories?: HistoryItem[];
    fulfillmentType?: string;
    compact?: boolean;
};

export default function OrderTimeline({ currentStatus, histories = [], fulfillmentType, compact = false }: Props) {
    const isCancelled = currentStatus === 'cancelled';
    const isFailed = currentStatus === 'failed';
    const isTerminal = isCancelled || isFailed;

    const steps = isTerminal
        ? [TIMELINE_STEPS[0], isCancelled ? CANCELLED_STEP : FAILED_STEP]
        : getStepsForFulfillment(fulfillmentType);

    const currentIndex = isTerminal
        ? 1
        : steps.findIndex((s) => s.key === currentStatus);

    const effectiveIndex = currentIndex < 0 ? 0 : currentIndex;

    const historyMap = new Map<string, HistoryItem>();
    for (const h of histories) {
        if (!historyMap.has(h.to_status)) {
            historyMap.set(h.to_status, h);
        }
    }

    if (compact) {
        return <CompactTimeline steps={steps} effectiveIndex={effectiveIndex} />;
    }

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status Pesanan</div>
            <div className="mt-4 space-y-0">
                {steps.map((step, index) => {
                    const isCompleted = index < effectiveIndex;
                    const isCurrent = index === effectiveIndex;
                    const isPending = index > effectiveIndex;
                    const history = historyMap.get(step.key);
                    const isLast = index === steps.length - 1;
                    const Icon = step.icon;

                    return (
                        <div key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
                            {/* Vertical line */}
                            {!isLast && (
                                <div className={`absolute left-[11px] top-6 bottom-0 w-px ${isCompleted ? 'bg-emerald-200' : 'bg-slate-200'}`} />
                            )}

                            {/* Icon */}
                            <div className="relative shrink-0 pt-0.5">
                                {isCompleted ? (
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                    </div>
                                ) : isCurrent ? (
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 ring-2 ring-emerald-500">
                                        <Icon className="h-3 w-3 text-emerald-600" />
                                    </div>
                                ) : (
                                    <div className="flex h-6 w-6 items-center justify-center">
                                        <Circle className="h-3 w-3 text-slate-300" />
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="min-w-0 flex-1 pt-0.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div className={`text-sm font-semibold ${isCurrent ? 'text-emerald-700' : isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>
                                        {step.label}
                                    </div>
                                    {history?.created_at && (
                                        <span className={`shrink-0 text-xs tabular-nums ${isCurrent ? 'font-semibold text-emerald-700' : 'text-slate-400'}`}>
                                            {formatTime(history.created_at)}
                                        </span>
                                    )}
                                </div>
                                {history?.notes && (
                                    <div className="mt-0.5 text-xs leading-relaxed text-slate-500">{history.notes}</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function CompactTimeline({ steps, effectiveIndex }: { steps: TimelineStep[]; effectiveIndex: number }) {
    return (
        <div className="flex items-center gap-1">
            {steps.map((step, index) => {
                const isCompleted = index < effectiveIndex;
                const isCurrent = index === effectiveIndex;

                return (
                    <div key={step.key} className="flex items-center gap-1">
                        <div className={`h-2 w-2 rounded-full ${isCompleted ? 'bg-emerald-500' : isCurrent ? 'bg-emerald-400 ring-2 ring-emerald-200' : 'bg-slate-200'}`} />
                        {index < steps.length - 1 && (
                            <div className={`h-px w-3 ${isCompleted ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function getStepsForFulfillment(fulfillmentType?: string): TimelineStep[] {
    if (fulfillmentType === 'pickup') {
        return [
            TIMELINE_STEPS[0], // pending
            TIMELINE_STEPS[1], // confirmed
            TIMELINE_STEPS[2], // preparing
            TIMELINE_STEPS[3], // ready_for_pickup
            TIMELINE_STEPS[6], // completed
        ];
    }

    return TIMELINE_STEPS;
}

function formatTime(value: string): string {
    try {
        return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '-';
    }
}
