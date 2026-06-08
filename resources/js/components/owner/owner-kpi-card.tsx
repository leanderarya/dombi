import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';

type Tone = 'danger' | 'warning' | 'success' | 'neutral';

interface Props {
    label: string;
    value: number | string;
    href?: string;
    tone?: Tone;
    icon?: ReactNode;
}

const toneStyles: Record<Tone, { border: string; bg: string; icon: string }> = {
    danger: { border: 'border-l-red-400', bg: 'bg-white', icon: 'text-red-500' },
    warning: { border: 'border-l-amber-400', bg: 'bg-white', icon: 'text-amber-500' },
    success: { border: 'border-l-emerald-400', bg: 'bg-white', icon: 'text-emerald-500' },
    neutral: { border: 'border-l-slate-300', bg: 'bg-white', icon: 'text-slate-400' },
};

export default function OwnerKpiCard({ label, value, href, tone = 'neutral', icon }: Props) {
    const s = toneStyles[tone];
    const Wrapper = href ? Link : 'div';

    return (
        <Wrapper
            {...(href ? { href } : {})}
            className={`flex min-h-[88px] flex-col justify-between rounded-xl border border-l-4 ${s.border} ${s.bg} p-4 transition-all duration-150 hover:border-emerald-200 hover:bg-emerald-50/30 active:scale-[0.98]`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</div>
                {icon && <div className={`shrink-0 ${s.icon}`}>{icon}</div>}
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">{value}</div>
        </Wrapper>
    );
}
