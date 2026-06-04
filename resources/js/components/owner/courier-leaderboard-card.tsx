interface LeaderboardEntry {
    id: number;
    name: string;
    completed: number;
    failed: number;
    success_rate: number;
    avg_delivery_time: number | null;
    score: number;
}

interface Props {
    couriers: LeaderboardEntry[];
}

export default function CourierLeaderboardCard({ couriers }: Props) {
    if (couriers.length === 0) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Leaderboard Kurir</h3>
                <p className="mt-2 text-sm text-slate-500">Belum ada data hari ini</p>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Leaderboard Kurir</h3>
            <div className="mt-3 space-y-2">
                {couriers.map((courier, idx) => (
                    <div
                        key={courier.id}
                        className="flex items-center gap-3 rounded-lg border border-slate-100 p-2.5"
                    >
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                            idx === 0 ? 'bg-amber-100 text-amber-700' :
                            idx === 1 ? 'bg-slate-200 text-slate-600' :
                            idx === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-slate-100 text-slate-500'
                        }`}>
                            {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-slate-900">{courier.name}</div>
                            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                                <span>{courier.completed} selesai</span>
                                {courier.failed > 0 && (
                                    <span className="text-red-500">{courier.failed} gagal</span>
                                )}
                                {courier.avg_delivery_time && (
                                    <span>~{courier.avg_delivery_time}m</span>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-bold text-emerald-700">{courier.success_rate}%</div>
                            <div className="text-[10px] text-slate-400">sukses</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
