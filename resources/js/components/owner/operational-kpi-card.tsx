import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';

interface Props {
    label: string;
    value: number;
    icon: ReactNode;
    href?: string;
}

export default function OperationalKpiCard({ label, value, icon, href }: Props) {
    const Wrapper = href ? Link : 'div';

    return (
        <Wrapper {...(href ? { href } : {})} className="flex min-w-[100px] shrink-0 flex-col rounded-lg border border-slate-200 bg-white p-3 active:scale-[0.97]">
            <div className="text-slate-400">{icon}</div>
            <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
            <div className="text-xl font-bold tabular-nums text-slate-900">{value < 10 ? `0${value}` : value}</div>
        </Wrapper>
    );
}
