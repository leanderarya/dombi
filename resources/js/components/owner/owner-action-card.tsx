import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Severity } from '@/lib/severity';

interface Props {
    href: string;
    icon?: ReactNode;
    title: string;
    subtitle?: string;
    metric?: string;
    count?: number;
    severity: Severity;
    ctaLabel?: string;
}

const severityConfig = {
    critical: { indicator: 'bg-red-500', iconBg: 'bg-red-50', iconColor: 'text-red-600', badge: 'bg-red-50 text-red-700' },
    warning: { indicator: 'bg-amber-500', iconBg: 'bg-amber-50', iconColor: 'text-amber-600', badge: 'bg-amber-50 text-amber-700' },
    info: { indicator: 'bg-blue-500', iconBg: 'bg-blue-50', iconColor: 'text-blue-600', badge: 'bg-blue-50 text-blue-700' },
};

export default function OwnerActionCard({ href, icon, title, subtitle, metric, count, severity, ctaLabel }: Props) {
    const config = severityConfig[severity];

    return (
        <Link
            href={href}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 transition-all duration-150 hover:border-emerald-200 hover:bg-emerald-50/40 active:scale-[0.99]"
        >
            <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${config.indicator}`} />

            {icon && (
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.iconBg} ${config.iconColor}`}>
                    {icon}
                </div>
            )}

            <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">{title}</div>
                {subtitle && <div className="mt-0.5 text-[11px] text-slate-500">{subtitle}</div>}
                {metric && <div className="mt-1 text-sm font-bold tabular-nums text-slate-900">{metric}</div>}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
                {count !== undefined && count > 0 && (
                    <span className={`flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[10px] font-bold text-white ${config.indicator}`}>
                        {count}
                    </span>
                )}
                {ctaLabel && (
                    <span className="text-xs font-semibold text-emerald-700">{ctaLabel}</span>
                )}
                <ChevronRight className="h-4 w-4 text-slate-300" />
            </div>
        </Link>
    );
}
