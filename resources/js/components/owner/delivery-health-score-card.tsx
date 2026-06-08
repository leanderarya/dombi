interface HealthData {
    score: number;
    status: string;
    factors: {
        sla_violations: number;
        failed_deliveries: number;
        overloaded_couriers: number;
        high_retry_deliveries: number;
        completed_today: number;
    };
}

interface Props {
    health: HealthData;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    excellent: { label: 'Sangat Baik', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
    good: { label: 'Baik', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
    needs_attention: { label: 'Perlu Perhatian', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
    critical: { label: 'Kritis', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
};

export default function DeliveryHealthScoreCard({ health }: Props) {
    const config = statusConfig[health.status] ?? statusConfig.good;

    return (
        <div className={`rounded-xl border p-4 ${config.bg}`}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Skor Kesehatan</h3>
            <div className="mt-2 flex items-center gap-3">
                <div className={`text-4xl font-bold ${config.color}`}>{health.score}</div>
                <div>
                    <div className={`text-sm font-bold ${config.color}`}>{config.label}</div>
                    <div className="text-[11px] text-slate-500">dari 100</div>
                </div>
            </div>
            <div className="mt-3 space-y-1">
                {health.factors.sla_violations > 0 && (
                    <FactorRow label="Pelanggaran SLA" value={health.factors.sla_violations} color="text-red-600" />
                )}
                {health.factors.failed_deliveries > 0 && (
                    <FactorRow label="Delivery Gagal" value={health.factors.failed_deliveries} color="text-red-600" />
                )}
                {health.factors.overloaded_couriers > 0 && (
                    <FactorRow label="Kurir Overload" value={health.factors.overloaded_couriers} color="text-amber-600" />
                )}
                {health.factors.high_retry_deliveries > 0 && (
                    <FactorRow label="Retry Tinggi" value={health.factors.high_retry_deliveries} color="text-amber-600" />
                )}
                {health.factors.completed_today > 0 && (
                    <FactorRow label="Selesai Hari Ini" value={health.factors.completed_today} color="text-emerald-600" />
                )}
            </div>
        </div>
    );
}

function FactorRow({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-600">{label}</span>
            <span className={`font-bold ${color}`}>{value}</span>
        </div>
    );
}
