import { formatCurrency } from '@/lib/format';

type Tier = {
    max_km: number;
    fee: number;
};

type Props = {
    tiers: Tier[];
    activeDistanceKm?: number | null;
};

export default function ServiceTierTable({ tiers, activeDistanceKm }: Props) {
    const activeIndex = activeDistanceKm !== null && activeDistanceKm !== undefined
        ? tiers.findIndex((tier) => activeDistanceKm <= tier.max_km)
        : -1;

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tabel Ongkir Kurir Dombi</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
                {tiers.map((tier, index) => {
                    const isActive = index === activeIndex;
                    const prevMax = index > 0 ? tiers[index - 1].max_km : 0;

                    return (
                        <div
                            key={tier.max_km}
                            className={`rounded-lg border px-3 py-2.5 ${
                                isActive
                                    ? 'border-emerald-500 bg-emerald-50'
                                    : 'border-slate-200 bg-white'
                            }`}
                        >
                            <div className={`text-xs font-semibold ${isActive ? 'text-emerald-700' : 'text-slate-500'}`}>
                                {prevMax}–{tier.max_km} km
                            </div>
                            <div className={`mt-0.5 text-sm font-bold tabular-nums ${isActive ? 'text-emerald-900' : 'text-slate-900'}`}>
                                {formatCurrency(tier.fee)}
                            </div>
                            {isActive && (
                                <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-emerald-600">✓ Aktif</div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
