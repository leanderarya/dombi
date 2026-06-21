import { Link } from '@inertiajs/react';

interface Props {
    label: string;
    value: number;
    href?: string;
    color: 'blue' | 'purple' | 'amber' | 'red' | 'green' | 'slate';
}

const colorClasses: Record<string, { bg: string; text: string; ring: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', ring: 'ring-purple-200' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
    red: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200' },
    green: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
    slate: { bg: 'bg-slate-50', text: 'text-slate-700', ring: 'ring-slate-200' },
};

export default function DeliveryPerformanceCard({ label, value, href, color }: Props) {
    const c = colorClasses[color] ?? colorClasses.slate;
    const Wrapper = href ? Link : 'div';

    return (
        <Wrapper
            {...(href ? { href } : {})}
            className={`rounded-xl border border-slate-200 ${c.bg} p-3 transition-all duration-150 active:scale-[0.97] ${value > 0 && color === 'red' ? 'ring-2 ' + c.ring : ''}`}
        >
            <div className={`text-[11px] font-bold uppercase tracking-wider ${c.text}`}>{label}</div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${c.text}`}>{value}</div>
        </Wrapper>
    );
}
