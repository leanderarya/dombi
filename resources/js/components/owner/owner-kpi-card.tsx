import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type KpiColor = 'success' | 'warning' | 'danger' | 'info';

const colorClasses: Record<KpiColor, string> = {
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
    info: 'text-blue-600',
};

interface Props {
    label: string;
    value: number | string;
    icon?: ReactNode;
    trend?: string;
    color?: KpiColor;
    className?: string;
}

export default function OwnerKpiCard({ label, value, icon, trend, color, className }: Props) {
    return (
        <div className={cn(
            'group rounded-xl border border-border bg-surface p-4 transition-all duration-200',
            'hover:border-border-strong hover:shadow-sm hover:-translate-y-0.5',
            'active:translate-y-0 active:shadow-none',
            className
        )}>
            <div className="flex items-center gap-2">
                {icon && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-muted transition-colors group-hover:bg-primary-light">
                        {icon}
                    </div>
                )}
                <div className="text-xs font-medium text-text-muted">{label}</div>
            </div>
            <div className={`mt-3 text-2xl font-bold tabular-nums tracking-tight ${color ? colorClasses[color] : 'text-text'}`}>
                {value}
            </div>
            {trend && (
                <div className="mt-1 text-xs text-text-subtle">{trend}</div>
            )}
        </div>
    );
}

interface OwnerKpiCardSkeletonProps {
    className?: string;
}

export function OwnerKpiCardSkeleton({ className }: OwnerKpiCardSkeletonProps) {
    return (
        <div className={cn('rounded-xl border border-border bg-surface p-4', className)}>
            <div className="flex items-center gap-3">
                <div className="h-8 w-8 animate-pulse rounded-lg bg-surface-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-surface-muted" />
            </div>
            <div className="mt-3 h-8 w-32 animate-pulse rounded bg-surface-muted" />
        </div>
    );
}
