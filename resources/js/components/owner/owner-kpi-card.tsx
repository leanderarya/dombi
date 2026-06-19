import type { ReactNode } from 'react';

interface Props {
    label: string;
    value: number | string;
    icon?: ReactNode;
    trend?: string;
}

export default function OwnerKpiCard({ label, value, icon, trend }: Props) {
    return (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center gap-2">
                {icon && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100">
                        {icon}
                    </div>
                )}
                <div className="text-xs font-medium text-zinc-500">{label}</div>
            </div>
            <div className="mt-3 text-2xl font-semibold tabular-nums text-zinc-900">
                {value}
            </div>
            {trend && (
                <div className="mt-1 text-xs text-zinc-400">{trend}</div>
            )}
        </div>
    );
}
