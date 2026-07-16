import { formatDate } from '@/lib/format';

type TimelineEvent = {
    label: string;
    at?: string | null;
    actor?: string | null;
    note?: string | null;
    active?: boolean;
};

export function buildTimeline(restock: any): TimelineEvent[] {
    const events: TimelineEvent[] = [
        {
            label: 'Permintaan Dibuat',
            at: restock.created_at,
            actor: restock.requester?.name,
            note: restock.notes,
            active: true,
        },
    ];

    if (restock.rejected_at) {
        events.push({
            label: 'Ditolak',
            at: restock.rejected_at,
            actor: restock.rejecter?.name,
            note: restock.rejected_reason,
            active: true,
        });

        return events;
    }

    if (restock.approved_at) {
        events.push({
            label: 'Disetujui / Disiapkan',
            at: restock.approved_at,
            actor: restock.approver?.name,
            note: restock.owner_notes,
            active: true,
        });
    }

    if (restock.sent_at) {
        events.push({
            label: 'Dikirim',
            at: restock.sent_at,
            actor: restock.sender?.name,
            note: 'Stok dikirim ke outlet.',
            active: true,
        });
    }

    if (restock.received_at) {
        events.push({
            label: 'Diterima / Selesai',
            at: restock.received_at,
            actor: restock.receiver?.name,
            note: restock.received_notes || 'Outlet mengonfirmasi stok diterima.',
            active: true,
        });
    }

    return events;
}

export default function RestockTimeline({ events }: { events: TimelineEvent[] }) {
    return (
        <div className="space-y-0" role="list" aria-label="Linimasa Restock">
            {events.map((event, index) => {
                const isLast = index === events.length - 1;
                return (
                    <div key={`${event.label}-${index}`} className="flex gap-3" role="listitem">
                        <div className="flex flex-col items-center pt-0.5">
                            <div className={`h-2 w-2 rounded-full ring-2 ring-offset-1 ${event.active ? 'bg-primary ring-primary/30' : 'bg-border ring-border/30'}`} />
                            {!isLast && <div className="w-px flex-1 min-h-6 bg-border/40 mt-1" />}
                        </div>
                        <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
                            <div className="text-sm font-semibold text-text">{event.label}</div>
                            <div className="text-xs text-text-muted mt-0.5">{formatDate(event.at)}{event.actor ? ` · ${event.actor}` : ''}</div>
                            {event.note && <div className="mt-1 text-xs leading-relaxed text-text-muted bg-surface-muted/50 rounded-md px-2.5 py-1.5">{event.note}</div>}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
