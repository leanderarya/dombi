import type { ReactNode } from 'react';
import { Search, MapPin, DoorOpen, TriangleAlert, CircleX } from 'lucide-react';

interface FailureReason {
    reason: string;
    count: number;
}

interface Props {
    reasons: FailureReason[];
}

const reasonIcons: Record<string, ReactNode> = {
    'Customer Tidak Ditemukan': <Search className="h-4 w-4 text-slate-500" />,
    'Alamat Tidak Jelas': <MapPin className="h-4 w-4 text-slate-500" />,
    'Penerima Tidak Ada': <DoorOpen className="h-4 w-4 text-slate-500" />,
    'Kendala Operasional': <TriangleAlert className="h-4 w-4 text-amber-500" />,
};

export default function FailureReasonsCard({ reasons }: Props) {
    if (reasons.length === 0) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Alasan Gagal</h3>
                <p className="mt-2 text-sm text-emerald-600">Tidak ada kegagalan hari ini</p>
            </div>
        );
    }

    const maxCount = Math.max(...reasons.map(r => r.count));

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Alasan Gagal Teratas</h3>
            <div className="mt-3 space-y-2">
                {reasons.map((r, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                        <span className="text-slate-500">{reasonIcons[r.reason] ?? <CircleX className="h-4 w-4 text-red-500" />}</span>
                        <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-slate-700">{r.reason}</div>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                    className="h-full rounded-full bg-red-400"
                                    style={{ width: `${(r.count / maxCount) * 100}%` }}
                                />
                            </div>
                        </div>
                        <span className="text-sm font-bold text-red-600">{r.count}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
