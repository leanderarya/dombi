import { cn } from '@/lib/utils';

interface Props {
    label: string;
    active: boolean;
    dir: 'asc' | 'desc';
    align?: 'left' | 'right' | 'center';
    onClick: () => void;
    className?: string;
}

export default function SortableTh({
    label,
    active,
    dir,
    align = 'left',
    onClick,
    className,
}: Props) {
    return (
        <th
            onClick={onClick}
            className={cn(
                'cursor-pointer px-6 py-3 text-[11px] font-semibold tracking-wider text-text-muted uppercase transition-colors select-none hover:text-text',
                active && 'text-text',
                align === 'right' && 'text-right',
                align === 'center' && 'text-center',
                className,
            )}
        >
            {label}
            {active && (
                <span className="ml-0.5 text-[10px] text-primary">
                    {dir === 'asc' ? '▲' : '▼'}
                </span>
            )}
        </th>
    );
}
