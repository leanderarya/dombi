import { orderStatusLabel } from '@/lib/customer-status';
import { formatDate } from '@/lib/format';

interface HistoryItem {
    id?: number;
    to_status: string;
    notes?: string | null;
    created_at?: string | null;
    actor?: { name: string } | null;
}

interface Props {
    histories: HistoryItem[];
    currentStatus?: string;
}

export default function StatusTimeline({ histories, currentStatus }: Props) {
    if (!histories || histories.length === 0) {
        return (
            <div className="rounded-lg border border-zinc-100 bg-white p-4 text-sm text-slate-500">
                Timeline belum tersedia.
            </div>
        );
    }

    const reversedHistories = [...histories].reverse();

    return (
        <div className="rounded-lg border border-zinc-100 bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Live Updates</div>
            <div className="mt-4 space-y-0">
                {reversedHistories.map((history, index) => {
                    const isFirst = index === 0;
                    const isLast = index === reversedHistories.length - 1;
                    const isCurrent = isFirst && currentStatus && history.to_status === currentStatus;

                    return (
                        <TimelineStep
                            key={history.id ?? `${history.to_status}-${index}`}
                            status={history.to_status}
                            notes={history.notes}
                            timestamp={history.created_at}
                            actor={history.actor}
                            isCurrent={!!isCurrent}
                            isCompleted={!isFirst}
                            isLast={isLast}
                        />
                    );
                })}
            </div>
        </div>
    );
}

interface StepProps {
    status: string;
    notes?: string | null;
    timestamp?: string | null;
    actor?: { name: string } | null;
    isCurrent: boolean;
    isCompleted: boolean;
    isLast: boolean;
}

function TimelineStep({ status, notes, timestamp, actor, isCurrent, isCompleted, isLast }: StepProps) {
    return (
        <div className="relative flex gap-3 pb-5 last:pb-0">
            {/* Vertical line */}
            {!isLast && (
                <div className={`absolute left-[11px] top-6 bottom-0 w-px ${isCompleted ? 'bg-emerald-200' : 'bg-zinc-200'}`} />
            )}

            {/* Dot indicator */}
            <div className="relative shrink-0 pt-0.5">
                {isCurrent ? (
                    <div className="flex h-6 w-6 items-center justify-center">
                        <div className="h-6 w-6 rounded-full bg-emerald-100 ring-2 ring-emerald-500">
                            <div className="flex h-full items-center justify-center">
                                <div className="h-2 w-2 rounded-full bg-emerald-600" />
                            </div>
                        </div>
                    </div>
                ) : isCompleted ? (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600">
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                ) : (
                    <div className="flex h-6 w-6 items-center justify-center">
                        <div className="h-3 w-3 rounded-full border-2 border-zinc-300 bg-white" />
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                    <div className={`text-sm font-semibold ${isCurrent ? 'text-emerald-700' : isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>
                        {orderStatusLabel(status)}
                    </div>
                    {timestamp && (
                        <span className={`shrink-0 text-xs tabular-nums ${isCurrent ? 'font-semibold text-emerald-700' : 'text-slate-400'}`}>
                            {formatTime(timestamp)}
                        </span>
                    )}
                </div>
                {notes && (
                    <div className="mt-0.5 text-xs leading-relaxed text-slate-500">{notes}</div>
                )}
            </div>
        </div>
    );
}

function formatTime(value: string): string {
    try {
        return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '-';
    }
}
