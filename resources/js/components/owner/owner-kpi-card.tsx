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
    highlight?: boolean;
    className?: string;
}

export default function OwnerKpiCard({
    label,
    value,
    icon,
    trend,
    color,
    highlight,
    className,
}: Props) {
    return (
        <div
            className={cn(
                'group rounded-lg p-2.5 transition-colors duration-150 hover:bg-surface-muted',
                highlight && 'bg-danger/5 ring-1 ring-danger/20',
                className,
            )}
        >
            <div className="flex items-center gap-2">
                {icon && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-muted transition-colors group-hover:bg-primary-light lg:h-9 lg:w-9">
                        {icon}
                    </div>
                )}
                <div className="text-xs font-medium text-text-muted">
                    {label}
                </div>
            </div>
            <div
                className={`mt-1 text-base font-bold tracking-tight tabular-nums ${color ? colorClasses[color] : 'text-text'}`}
            >
                {value}
            </div>
            {trend && (
                <div className="mt-1.5 text-xs font-medium text-text-subtle">
                    {trend}
                </div>
            )}
        </div>
    );
}

interface OwnerKpiCardSkeletonProps {
    className?: string;
}

export function OwnerKpiCardSkeleton({ className }: OwnerKpiCardSkeletonProps) {
    return (
        <div className={cn('rounded-lg p-2.5', className)}>
            <div className="flex items-center gap-3">
                <div className="h-6 w-6 animate-pulse rounded bg-surface-muted" />
                <div className="h-3 w-20 animate-pulse rounded bg-surface-muted" />
            </div>
            <div className="mt-1 h-5 w-28 animate-pulse rounded bg-surface-muted" />
        </div>
    );
}
