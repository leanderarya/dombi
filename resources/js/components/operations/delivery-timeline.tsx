import { formatDeliveryAge } from '@/lib/format';

interface StatusHistory {
    id: number;
    from_status: string | null;
    to_status: string;
    changed_by_type: string | null;
    reason: string | null;
    notes: string | null;
    created_at: string | null;
    actor: { id: number; name: string } | null;
}

interface Props {
    histories: StatusHistory[];
}

const statusColors: Record<string, string> = {
    waiting_assignment: 'border-slate-300 bg-slate-100',
    waiting_pickup: 'border-yellow-300 bg-yellow-100',
    picked_up: 'border-blue-300 bg-blue-100',
    delivering: 'border-purple-300 bg-purple-100',
    completed: 'border-emerald-300 bg-emerald-100',
    failed: 'border-red-300 bg-red-100',
    retry_delivery: 'border-orange-300 bg-orange-100',
    returned_to_outlet: 'border-amber-300 bg-amber-100',
    cancelled_and_released: 'border-slate-300 bg-slate-200',
};

const statusLabels: Record<string, string> = {
    waiting_assignment: 'Menunggu Kurir',
    waiting_pickup: 'Di-assign',
    picked_up: 'Pickup',
    delivering: 'Dalam Perjalanan',
    completed: 'Selesai',
    failed: 'Gagal',
    retry_delivery: 'Retry Delivery',
    returned_to_outlet: 'Kembali ke Outlet',
    cancelled_and_released: 'Dibatalkan',
};

const typeLabels: Record<string, string> = {
    owner: 'Owner',
    outlet: 'Outlet',
    courier: 'Kurir',
    system: 'System',
};

export default function DeliveryTimeline({ histories }: Props) {
    if (histories.length === 0) {
        return (
            <div className="py-4 text-center text-xs text-slate-400">
                Belum ada riwayat
            </div>
        );
    }

    return (
        <div className="space-y-0">
            {histories.map((h, i) => {
                const color =
                    statusColors[h.to_status] ??
                    'border-slate-300 bg-slate-100';
                const isLast = i === histories.length - 1;

                return (
                    <div key={h.id} className="flex gap-3">
                        {/* Timeline line */}
                        <div className="flex flex-col items-center">
                            <div
                                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${color}`}
                            >
                                <div className="h-2 w-2 rounded-full bg-current" />
                            </div>
                            {!isLast && (
                                <div className="w-0.5 flex-1 bg-slate-200" />
                            )}
                        </div>

                        {/* Content */}
                        <div className={`flex-1 pb-4 ${isLast ? '' : ''}`}>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-900">
                                    {statusLabels[h.to_status] ??
                                        h.to_status.replaceAll('_', ' ')}
                                </span>
                                {h.changed_by_type && (
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                                        {typeLabels[h.changed_by_type] ??
                                            h.changed_by_type}
                                    </span>
                                )}
                            </div>
                            {h.reason && (
                                <div className="mt-0.5 text-[11px] text-slate-500">
                                    {h.reason}
                                </div>
                            )}
                            {h.actor && (
                                <div className="mt-0.5 text-[11px] text-slate-400">
                                    oleh {h.actor.name}
                                </div>
                            )}
                            {h.created_at && (
                                <div className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                                    {new Date(h.created_at).toLocaleString(
                                        'id-ID',
                                        {
                                            day: 'numeric',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        },
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
