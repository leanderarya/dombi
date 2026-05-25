import { Link } from '@inertiajs/react';

interface Props {
    label: string;
    value: number;
    href?: string;
    color?: 'emerald' | 'blue' | 'amber' | 'red';
    /** Progress percentage 0-100 for the bar */
    progress?: number;
}

const barColors = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
};

export default function KpiCard({ label, value, href, color = 'emerald', progress }: Props) {
    const Wrapper = href ? Link : 'div';
    const barColor = barColors[color];

    return (
        <Wrapper {...(href ? { href } : {})} className="rounded-lg border border-slate-200 bg-white p-4 transition-transform active:scale-[0.97]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
            <div className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{value}</div>
            {progress !== undefined && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, progress)}%` }} />
                </div>
            )}
        </Wrapper>
    );
}
