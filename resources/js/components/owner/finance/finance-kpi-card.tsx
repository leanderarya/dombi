import type { ReactNode } from 'react';

type AccentColor = 'red' | 'amber' | 'orange' | 'emerald' | 'blue' | 'slate';

interface Props {
    label: string;
    value: string;
    accent: AccentColor;
    icon: ReactNode;
    subtext?: string;
}

const accentColors: Record<AccentColor, string> = {
    red: 'bg-red-500',
    amber: 'bg-amber-500',
    orange: 'bg-orange-500',
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    slate: 'bg-slate-400',
};

export default function FinanceKpiCard({ label, value, accent, icon, subtext }: Props) {
    return (
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
            {/* Accent strip */}
            <div className={`h-1 ${accentColors[accent]}`} />

            <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {label}
                    </p>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                        {icon}
                    </div>
                </div>

                {/* Value */}
                <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                    {value}
                </div>

                {/* Subtext */}
                {subtext && (
                    <p className="mt-1 text-xs text-slate-500">{subtext}</p>
                )}
            </div>
        </div>
    );
}
