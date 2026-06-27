import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

type AccentColor = 'red' | 'amber' | 'orange' | 'emerald' | 'blue' | 'slate';

interface Props {
    label: string;
    value: string;
    accent: AccentColor;
    icon: ReactNode;
    subtext?: string;
    trend?: {
        value: number; // percentage, positive = up, negative = down
        label?: string;
    };
}

const accentColors: Record<AccentColor, { bg: string; text: string; light: string }> = {
    red: { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50' },
    amber: { bg: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-50' },
    orange: { bg: 'bg-orange-500', text: 'text-orange-600', light: 'bg-orange-50' },
    emerald: { bg: 'bg-emerald-500', text: 'text-emerald-600', light: 'bg-emerald-50' },
    blue: { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50' },
    slate: { bg: 'bg-slate-400', text: 'text-slate-500', light: 'bg-slate-50' },
};

function TrendIndicator({ trend }: { trend: NonNullable<Props['trend']> }) {
    const isUp = trend.value > 0;
    const isDown = trend.value < 0;
    const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            isUp ? 'bg-emerald-50 text-emerald-700' :
            isDown ? 'bg-red-50 text-red-700' :
            'bg-slate-100 text-slate-500'
        }`}>
            <Icon className="h-3 w-3" />
            {Math.abs(trend.value)}%
        </span>
    );
}

export default function FinanceKpiCard({ label, value, accent, icon, subtext, trend }: Props) {
    const colors = accentColors[accent];

    return (
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md lg:p-5 lg:shadow-sm">
            {/* Accent strip */}
            <div className={`h-1 ${colors.bg}`} />

            <div className="p-4 lg:p-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        {label}
                    </p>
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${colors.light} ${colors.text}`}>
                        {icon}
                    </div>
                </div>

                {/* Value + Trend */}
                <div className="mt-3 flex items-end gap-2">
                    <div className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
                        {value}
                    </div>
                    {trend && <TrendIndicator trend={trend} />}
                </div>

                {/* Subtext */}
                {subtext && (
                    <p className="mt-1.5 text-xs text-slate-500">{subtext}</p>
                )}
            </div>
        </div>
    );
}
