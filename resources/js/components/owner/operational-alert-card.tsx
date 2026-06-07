import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';

interface Props {
    href: string;
    icon: ReactNode;
    title: string;
    subtitle: string;
    count?: number;
    severity: 'critical' | 'warning' | 'info';
}

const severityConfig = {
    critical: { iconBg: 'bg-red-50', iconColor: 'text-red-600', indicator: 'bg-red-500' },
    warning: { iconBg: 'bg-amber-50', iconColor: 'text-amber-600', indicator: 'bg-amber-500' },
    info: { iconBg: 'bg-slate-100', iconColor: 'text-indigo-600', indicator: 'bg-indigo-500' },
};

export default function OperationalAlertCard({ href, icon, title, subtitle, count, severity }: Props) {
    const config = severityConfig[severity];

    return (
        <Link href={href} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 transition-all duration-150 active:scale-[0.99] active:bg-slate-50">
            {/* Severity indicator */}
            <div className="flex flex-col items-center gap-1.5">
                <div className={`h-1.5 w-1.5 rounded-full ${config.indicator}`} />
            </div>

            {/* Icon */}
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.iconBg} ${config.iconColor}`}>
                {icon}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">{title}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">{subtitle}</div>
            </div>

            {/* Count + Chevron */}
            <div className="flex shrink-0 items-center gap-1.5">
                {count !== undefined && count > 0 && (
                    <span className={`flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[10px] font-bold text-white ${config.indicator}`}>
                        {count}
                    </span>
                )}
                <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
            </div>
        </Link>
    );
}

// Operational SVG Icons
export function AlertTruckIcon() {
    return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>;
}

export function AlertInventoryIcon() {
    return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
}

export function AlertRestockIcon() {
    return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
}

export function AlertReturnIcon() {
    return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10M7 12h10M7 17h6M7 3v4m0 0l-3-3m3 3l3-3M5 21h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
}

export function AlertExchangeIcon() {
    return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7h11m0 0l-3-3m3 3l-3 3M20 17H9m0 0l3-3m-3 3l3 3" /></svg>;
}
