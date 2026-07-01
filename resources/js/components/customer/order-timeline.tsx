import { CheckCircle2, ChevronDown, Circle, Clock, Package, Truck, UserCheck, XCircle, Timer } from 'lucide-react';

type TimelineStep = {
    key: string;
    label: string;
    pickupLabel?: string;
    icon: typeof CheckCircle2;
};

const TIMELINE_STEPS: TimelineStep[] = [
    { key: 'pending_confirmation', label: 'Pesanan Dibuat', icon: Clock },
    { key: 'confirmed', label: 'Outlet Menerima Pesanan', icon: Package },
    { key: 'preparing', label: 'Pesanan Sedang Disiapkan', icon: Package },
    { key: 'ready_for_pickup', label: 'Menunggu Kurir', pickupLabel: 'Siap Diambil', icon: Package },
    { key: 'picked_up', label: 'Kurir Mengambil Pesanan', icon: UserCheck },
    { key: 'delivering', label: 'Dalam Perjalanan', icon: Truck },
    { key: 'completed', label: 'Pesanan Selesai', icon: CheckCircle2 },
];

const CANCELLED_BY_CUSTOMER_STEP: TimelineStep = { key: 'cancelled_by_customer', label: 'Dibatalkan Customer', icon: XCircle };
const CANCELLED_BY_OUTLET_STEP: TimelineStep = { key: 'cancelled_by_outlet', label: 'Dibatalkan Outlet', icon: XCircle };
const REJECTED_STEP: TimelineStep = { key: 'rejected_by_outlet', label: 'Ditolak Outlet', icon: XCircle };
const FAILED_STEP: TimelineStep = { key: 'failed_delivery', label: 'Pengiriman Gagal', icon: XCircle };
const EXPIRED_STEP: TimelineStep = { key: 'expired', label: 'Konfirmasi Kadaluarsa', icon: Timer };

type HistoryItem = {
    id?: number;
    to_status: string;
    notes?: string | null;
    reason?: string | null;
    created_at?: string | null;
    actor?: { name: string } | null;
};

type Props = {
    currentStatus: string;
    histories?: HistoryItem[];
    fulfillmentType?: string;
    compact?: boolean;
    defaultCollapsed?: boolean;
};

export default function OrderTimeline({ currentStatus, histories = [], fulfillmentType, compact = false, defaultCollapsed = false }: Props) {
    const isCancelled = currentStatus === 'cancelled_by_customer' || currentStatus === 'cancelled_by_outlet';
    const isRejected = currentStatus === 'rejected_by_outlet';
    const isFailed = currentStatus === 'failed_delivery';
    const isExpired = currentStatus === 'expired';
    const isTerminal = isCancelled || isRejected || isFailed || isExpired;

    const terminalStep = isRejected
        ? REJECTED_STEP
        : currentStatus === 'cancelled_by_customer'
            ? CANCELLED_BY_CUSTOMER_STEP
            : currentStatus === 'cancelled_by_outlet'
                ? CANCELLED_BY_OUTLET_STEP
                : isExpired
                    ? EXPIRED_STEP
                    : FAILED_STEP;

    const steps = isTerminal
        ? [TIMELINE_STEPS[0], terminalStep]
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

    const currentStepLabel = getStepLabel(steps[effectiveIndex], fulfillmentType);
    const isCompleted = currentStatus === 'completed';
    const completedCount = isCompleted ? steps.length : effectiveIndex;
    const totalSteps = steps.length;

    if (defaultCollapsed) {
        return (
            <details className="group rounded-xl border border-border bg-white">
                <summary className="flex cursor-pointer items-center justify-between p-4 active:opacity-80">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Perjalanan Pesanan</div>
                        <div className="mt-1 text-sm font-medium text-text">{currentStepLabel}</div>
                        <div className="mt-0.5 text-xs text-text-muted">{completedCount} dari {totalSteps} langkah</div>
                    </div>
                    <ChevronDown className="h-5 w-5 shrink-0 text-text-subtle transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-border px-4 pb-4 pt-4">
                    <TimelineSteps steps={steps} effectiveIndex={effectiveIndex} isTerminal={isTerminal} historyMap={historyMap} fulfillmentType={fulfillmentType} />
                </div>
            </details>
        );
    }

    return (
        <div className="rounded-xl border border-border bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Perjalanan Pesanan</div>
            <div className="mt-4">
                <TimelineSteps steps={steps} effectiveIndex={effectiveIndex} isTerminal={isTerminal} historyMap={historyMap} fulfillmentType={fulfillmentType} />
            </div>
        </div>
    );
}

function TimelineSteps({ steps, effectiveIndex, isTerminal, historyMap, fulfillmentType }: { steps: TimelineStep[]; effectiveIndex: number; isTerminal: boolean; historyMap: Map<string, HistoryItem>; fulfillmentType?: string }) {
    const isOrderCompleted = steps[effectiveIndex]?.key === 'completed';

    return (
        <div className="space-y-0">
            {steps.map((step, index) => {
                const isCompleted = isOrderCompleted ? index <= effectiveIndex : index < effectiveIndex;
                const isCurrent = !isOrderCompleted && index === effectiveIndex;
                const history = historyMap.get(step.key);
                const isLast = index === steps.length - 1;
                const Icon = step.icon;

                return (
                    <div key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
                        {!isLast && (
                            <div className={`absolute left-[11px] top-6 bottom-0 w-px ${isCompleted ? 'bg-emerald-200' : 'bg-border'}`} />
                        )}

                        <div className="relative shrink-0 pt-0.5">
                            {isCompleted ? (
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                </div>
                            ) : isCurrent ? (
                                <div className={`flex h-6 w-6 items-center justify-center rounded-full ${isTerminal ? 'bg-red-100 ring-2 ring-red-500' : 'bg-emerald-100 ring-2 ring-emerald-500'}`}>
                                    <Icon className={`h-3 w-3 ${isTerminal ? 'text-red-600' : 'text-emerald-600'}`} />
                                </div>
                            ) : (
                                <div className="flex h-6 w-6 items-center justify-center">
                                    <Circle className="h-3 w-3 text-text-subtle" />
                                </div>
                            )}
                        </div>

                        <div className="min-w-0 flex-1 pt-0.5">
                            <div className="flex items-start justify-between gap-2">
                                <div className={`text-sm font-semibold ${isCurrent ? (isTerminal ? 'text-red-700' : 'text-emerald-700') : isCompleted ? 'text-text' : 'text-text-subtle'}`}>
                                    {getStepLabel(step, fulfillmentType)}
                                </div>
                                {history?.created_at && (
                                    <span className={`shrink-0 text-xs tabular-nums ${isCurrent ? (isTerminal ? 'font-semibold text-red-700' : 'font-semibold text-emerald-700') : 'text-text-subtle'}`}>
                                        {formatTime(history.created_at)}
                                    </span>
                                )}
                            </div>
                            {history?.notes && (
                                <div className="mt-0.5 text-xs leading-relaxed text-text-muted">{history.notes}</div>
                            )}
                            {history?.reason && (
                                <div className="mt-0.5 text-xs font-medium text-text-muted">Alasan: {history.reason}</div>
                            )}
                        </div>
                    </div>
                );
            })}
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
                        <div className={`h-2 w-2 rounded-full ${isCompleted ? 'bg-emerald-500' : isCurrent ? 'bg-emerald-400 ring-2 ring-emerald-200' : 'bg-border'}`} />
                        {index < steps.length - 1 && (
                            <div className={`h-px w-3 ${isCompleted ? 'bg-emerald-300' : 'bg-border'}`} />
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
            TIMELINE_STEPS[0],
            TIMELINE_STEPS[1],
            TIMELINE_STEPS[2],
            TIMELINE_STEPS[3],
            TIMELINE_STEPS[6],
        ];
    }

    return TIMELINE_STEPS;
}

function getStepLabel(step: TimelineStep, fulfillmentType?: string): string {
    if (fulfillmentType === 'pickup' && step.pickupLabel) {
        return step.pickupLabel;
    }

    return step.label;
}

function formatTime(value: string): string {
    try {
        return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '-';
    }
}
