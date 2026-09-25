import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Props {
    label: string;
    active: boolean;
    dir: 'asc' | 'desc';
    align?: 'left' | 'right' | 'center';
    onClick: () => void;
    className?: string;
}

/**
 * The single sortable column header for owner tables.
 *
 * Padding is left to the caller through `className` so the header can match the
 * body cell padding of its own table — a header cell inset differently from its
 * column reads as misaligned. Typography is deliberately not overridable: every
 * owner table shows the same size, weight and tracking.
 */
export default function SortableTh({
    label,
    active,
    dir,
    align = 'left',
    onClick,
    className,
}: Props) {
    return (
        <TableHead
            onClick={onClick}
            className={cn(
                'cursor-pointer px-3 py-2.5 text-xs font-semibold tracking-wide text-text-muted uppercase transition-colors select-none hover:text-text',
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
        </TableHead>
    );
}
