import type { ReactNode } from 'react';

interface Props {
    label: string;
    value: ReactNode;
    sublabel?: ReactNode;
    /** Accent color for the value. Default: inherit */
    color?: 'default' | 'red' | 'green' | 'amber' | 'blue';
    /** Use compact size (xs text). Default: false */
    compact?: boolean;
}

const colorMap = {
    default: 'text-text',
    red: 'text-red-600',
    green: 'text-emerald-600',
    amber: 'text-amber-600',
    blue: 'text-blue-600',
};

export default function OwnerMetric({
    label,
    value,
    sublabel,
    color = 'default',
    compact = false,
}: Props) {
    return (
        <div className={compact ? 'py-2' : 'py-3'}>
            <div className="text-xs text-text-muted">{label}</div>
            <div
                className={`mt-0.5 font-bold tabular-nums ${colorMap[color]} ${compact ? 'text-sm' : 'text-lg'}`}
            >
                {value}
            </div>
            {sublabel && (
                <div className="mt-0.5 text-[11px] text-text-subtle">
                    {sublabel}
                </div>
            )}
        </div>
    );
}
