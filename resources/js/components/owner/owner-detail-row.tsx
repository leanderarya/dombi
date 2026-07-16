import type { ReactNode } from 'react';

interface Props {
    label: string;
    value: ReactNode;
    align?: 'left' | 'right';
    size?: 'xs' | 'sm';
    bold?: boolean;
    danger?: boolean;
}

export default function OwnerDetailRow({
    label,
    value,
    align = 'left',
    size = 'sm',
    bold = false,
    danger = false,
}: Props) {
    return (
        <div
            className={`flex justify-between border-b border-border py-1 last:border-b-0 ${size === 'xs' ? 'text-xs' : 'text-sm'} ${danger ? 'text-red-700' : ''}`}
        >
            <span className="text-text-muted">{label}</span>
            <span
                className={`${align === 'right' ? 'text-right' : ''} ${bold ? 'font-semibold tabular-nums' : ''} ${danger ? 'text-red-700' : 'text-text'}`}
            >
                {value ?? '-'}
            </span>
        </div>
    );
}
