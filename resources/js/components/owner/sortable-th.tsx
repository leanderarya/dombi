import { cn } from '@/lib/utils';

interface Props {
    label: string;
    active: boolean;
    dir: 'asc' | 'desc';
    align?: 'left' | 'right' | 'center';
    onClick: () => void;
    className?: string;
}

export default function SortableTh({ label, active, dir, align = 'left', onClick, className }: Props) {
    return (
        <th
            onClick={onClick}
            className={cn(
                'cursor-pointer select-none px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted transition-colors hover:text-text',
                active && 'text-text',
                align === 'right' && 'text-right',
                align === 'center' && 'text-center',
                className,
            )}
        >
            {label}
            {active && <span className="ml-0.5 text-primary text-[10px]">{dir === 'asc' ? '▲' : '▼'}</span>}
        </th>
    );
}
