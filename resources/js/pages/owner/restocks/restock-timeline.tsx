import { formatDate } from '@/lib/format';

type TimelineEvent = {
    label: string;
    at?: string | null;
    actor?: string | null;
    note?: string | null;
    active?: boolean;
};

export function buildTimeline(restock: any): TimelineEvent[] {
    const distribution = restock.distribution;
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

    if (distribution) {
        events.push({
            label: 'Distribusi Dibuat',
            at: distribution.created_at,
            actor: restock.approver?.name,
            note: `${distribution.items?.length ?? 0} SKU disiapkan`,
            active: true,
        });
    }

    if (distribution?.sent_at) {
        events.push({
            label: 'Dikirim',
            at: distribution.sent_at,
            actor: distribution.sender?.name,
            note: 'Stok dikirim ke outlet.',
            active: true,
        });
    }

    if (distribution?.received_at) {
        events.push({
            label: 'Diterima / Selesai',
            at: distribution.received_at,
            actor: distribution.receiver?.name,
            note: distribution.received_notes || 'Outlet mengonfirmasi stok diterima.',
            active: true,
        });
    }

    return events;
}

export default function RestockTimeline({ events }: { events: TimelineEvent[] }) {
    return (
        <div className="space-y-0">
            {events.map((event, index) => (
                <div key={`${event.label}-${index}`} className="flex gap-3">
                    <div className="flex flex-col items-center">
                        <div className={`h-2.5 w-2.5 rounded-full border-2 ${event.active ? 'border-emerald-600 bg-emerald-600' : 'border-border bg-white'}`} />
                        {index < events.length - 1 && <div className="h-full min-h-8 w-px bg-slate-200" />}
                    </div>
                    <div className="pb-3">
                        <div className="text-sm font-bold text-text">{event.label}</div>
                        <div className="text-xs text-text-muted">{formatDate(event.at)}{event.actor ? ` · ${event.actor}` : ''}</div>
                        {event.note && <div className="mt-0.5 text-xs leading-4 text-text-muted">{event.note}</div>}
                    </div>
                </div>
            ))}
        </div>
    );
}
