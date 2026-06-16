import { Link } from '@inertiajs/react';

interface ViolationItem {
    order_code: string;
    courier?: string;
    outlet: string;
    age_minutes: number;
}

interface ViolationCategory {
    count: number;
    items: ViolationItem[];
}

interface Props {
    violations: {
        assignment: ViolationCategory;
        pickup: ViolationCategory;
        delivery: ViolationCategory;
        total: number;
    };
}

export default function SlaViolationsCard({ violations }: Props) {
    if (violations.total === 0) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Pelanggaran SLA</h3>
                <p className="mt-2 text-sm text-emerald-600">Semua delivery dalam batas SLA</p>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-red-600">Pelanggaran SLA</h3>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{violations.total}</span>
            </div>
            <div className="mt-3 space-y-3">
                {violations.assignment.count > 0 && (
                    <ViolationSection
                        label="Belum Ada Kurir"
                        count={violations.assignment.count}
                        items={violations.assignment.items.slice(0, 2)}
                    />
                )}
                {violations.pickup.count > 0 && (
                    <ViolationSection
                        label="Belum Diambil"
                        count={violations.pickup.count}
                        items={violations.pickup.items.slice(0, 2)}
                    />
                )}
                {violations.delivery.count > 0 && (
                    <ViolationSection
                        label="Pengiriman Lama"
                        count={violations.delivery.count}
                        items={violations.delivery.items.slice(0, 2)}
                    />
                )}
            </div>
            <Link href="/owner/deliveries/board" className="mt-3 block text-center text-xs font-bold text-red-700">
                Lihat Detail →
            </Link>
        </div>
    );
}

function ViolationSection({ label, count, items }: { label: string; count: number; items: ViolationItem[] }) {
    return (
        <div>
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-red-800">{label}</span>
                <span className="text-xs font-bold text-red-600">{count}</span>
            </div>
            <div className="mt-1 space-y-1">
                {items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] text-red-700">
                        <span>{item.order_code}</span>
                        <span>{formatAge(item.age_minutes)}</span>
                    </div>
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
