import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';

interface KpiItem {
    label: string;
    value: ReactNode;
    sublabel?: ReactNode;
    sublabelColor?: string;
    href?: string;
    valueClassName?: string;
}

interface Props {
    items: KpiItem[];
    /** Responsive grid columns. Default: items.length > 3 ? 4 : 3 */
    cols?: 2 | 3 | 4 | 6;
}

export default function OwnerKpiStrip({ items, cols }: Props) {
    const gridCols = cols ?? (items.length > 3 ? 4 : 3);

    return (
        <div className={`mb-4 grid gap-2 ${
            gridCols === 2 ? 'grid-cols-2' :
            gridCols === 3 ? 'grid-cols-3' :
            gridCols === 6 ? 'grid-cols-2 lg:grid-cols-6' :
            'grid-cols-4'
        }`}>
            {items.map((item, i) => {
                const content = (
                    <>
                        <div className="text-xs font-medium uppercase tracking-wide text-text-muted">{item.label}</div>
                        <div className={`mt-1 text-base font-bold tabular-nums ${item.valueClassName ?? 'text-text'}`}>{item.value}</div>
                        {item.sublabel && (
                            <div className={`text-xs font-medium ${item.sublabelColor ?? 'text-text-subtle'}`}>{item.sublabel}</div>
                        )}
                    </>
                );

                if (item.href) {
                    return (
                        <Link key={i} href={item.href} className="block rounded-lg bg-surface p-2.5 transition-colors hover:bg-surface-muted">
                            {content}
                        </Link>
                    );
                }

                return (
                    <div key={i} className="rounded-lg bg-surface p-2.5">
                        {content}
                    </div>
                );
            })}
        </div>
    );
}
