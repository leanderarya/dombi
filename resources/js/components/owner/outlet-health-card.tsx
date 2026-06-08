interface Props {
    outlet: {
        id: number;
        name: string;
        status: 'stable' | 'low_stock' | 'critical';
        stockPercent: number;
        updatedAgo: string;
    };
}

const statusConfig = {
    stable: { label: 'Stabil', bg: 'bg-emerald-100', text: 'text-emerald-700' },
    low_stock: { label: 'Stok Rendah', bg: 'bg-amber-100', text: 'text-amber-700' },
    critical: { label: 'Kritis', bg: 'bg-red-100', text: 'text-red-700' },
};

export default function OutletHealthCard({ outlet }: Props) {
    const config = statusConfig[outlet.status];
    const barColor = outlet.status === 'critical' ? 'bg-red-500' : outlet.status === 'low_stock' ? 'bg-amber-500' : 'bg-emerald-500';

    return (
        <div className="w-44 shrink-0 rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900">{outlet.name}</div>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${config.bg} ${config.text}`}>
                    {config.label}
                </span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${outlet.stockPercent}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                <span>{outlet.stockPercent}%</span>
                <span>{outlet.updatedAgo}</span>
            </div>
        </div>
    );
}
