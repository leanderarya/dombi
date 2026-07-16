import { cn } from '@/lib/utils';

interface Props {
    margin: number;
    maxMargin: number;
    sellingPrice?: number;
    className?: string;
}

export default function MarginBar({
    margin,
    maxMargin,
    sellingPrice = 0,
    className,
}: Props) {
    if (sellingPrice <= 0 && margin <= 0) {
        return null;
    }

    const pct =
        maxMargin > 0 ? Math.min(Math.abs(margin) / maxMargin, 1) * 100 : 0;

    let color: string;

    if (margin >= 5000) {
        color = 'bg-emerald-500';
    } else if (margin > 0) {
        color = 'bg-amber-500';
    } else {
        color = 'bg-red-500';
    }

    return (
        <div
            className={cn(
                'h-1.5 w-16 overflow-hidden rounded-full bg-slate-100',
                className,
            )}
        >
            <div
                className={cn('h-full rounded-full transition-all', color)}
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}

export function MarginBarInline({ margin, maxMargin, sellingPrice }: Props) {
    const sp = sellingPrice ?? 0;
    if (sp <= 0 && margin <= 0) {
        return (
            <span className="font-bold text-red-600 tabular-nums">
                {margin}
            </span>
        );
    }

    let textColor: string;

    if (margin >= 5000) {
        textColor = 'text-emerald-600';
    } else if (margin > 0) {
        textColor = 'text-amber-600';
    } else {
        textColor = 'text-red-600';
    }

    return (
        <span className="inline-flex items-center gap-1.5">
            <span className={cn('font-bold tabular-nums', textColor)}>
                {margin.toLocaleString('id-ID')}
            </span>
            <MarginBar
                margin={margin}
                maxMargin={maxMargin}
                sellingPrice={sp}
            />
        </span>
    );
}
