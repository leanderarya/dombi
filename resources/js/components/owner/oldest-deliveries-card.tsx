import { Link } from '@inertiajs/react';

interface OldestDelivery {
    id: number;
    order_code: string;
    courier: string;
    outlet: string;
    age_minutes: number;
    status: string;
    sla_health: string;
}

interface Props {
    deliveries: OldestDelivery[];
}

const slaColors: Record<string, string> = {
    normal: 'text-emerald-600',
    warning: 'text-amber-600',
    critical: 'text-red-600',
};

export default function OldestDeliveriesCard({ deliveries }: Props) {
    if (deliveries.length === 0) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Deliveries Tertua</h3>
                <p className="mt-2 text-sm text-slate-500">Tidak ada delivery aktif</p>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Deliveries Tertua</h3>
                <Link href="/owner/deliveries/board" className="text-[11px] font-bold text-emerald-700">Lihat Semua</Link>
            </div>
            <div className="mt-3 space-y-2">
                {deliveries.map((d) => (
                    <Link
                        key={d.id}
                        href={`/owner/deliveries/${d.id}`}
                        className="flex items-center justify-between rounded-lg border border-slate-100 p-2.5 transition-colors active:bg-slate-50"
                    >
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-slate-900">{d.order_code}</div>
                            <div className="mt-0.5 text-[11px] text-slate-500">
                                {d.courier} · {d.outlet}
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <span className={`text-xs font-bold ${slaColors[d.sla_health] ?? 'text-slate-500'}`}>
                                {formatAge(d.age_minutes)}
                            </span>
                            <span className={`text-[10px] font-medium ${slaColors[d.sla_health] ?? 'text-slate-400'}`}>
                                {d.sla_health === 'critical' ? 'Terlambat' : d.sla_health === 'warning' ? 'Peringatan' : 'Normal'}
                            </span>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}

function formatAge(minutes: number): string {
    if (minutes < 60) {
return `${minutes}m`;
}

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    return mins > 0 ? `${hours}j ${mins}m` : `${hours}j`;
}
