import { Link } from '@inertiajs/react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';

interface KpiItem {
    label: string;
    value: ReactNode;
    sublabel?: ReactNode;
    sublabelColor?: string;
    href?: string;
    valueClassName?: string;
    icon?: ReactNode;
    accentColor?: string;
    featured?: boolean;
    /** Trend indicator */
    trend?: {
        direction: 'up' | 'down';
        value: string;
        label?: string;
        positive?: boolean;
    };
}

interface Props {
    items: KpiItem[];
    cols?: 2 | 3 | 4 | 6;
}

export default function OwnerKpiStrip({ items, cols }: Props) {
    const gridCols = cols ?? 3;
    const canFeature = gridCols === 3 || gridCols === 4;

    return (
        <div className={`mb-10 grid ${
            gridCols === 2 ? 'grid-cols-1 md:grid-cols-2' :
            gridCols === 3 ? 'grid-cols-1 md:grid-cols-3' :
            gridCols === 6 ? 'grid-cols-2 lg:grid-cols-6' :
            'grid-cols-2 lg:grid-cols-4'
        } gap-6`}>
            {items.map((item, i) => {
                const isFeatured = canFeature && (item.featured ?? false);
                const spanClass = isFeatured ? 'lg:col-span-2' : '';

                const trendPositive = item.trend?.positive ?? (item.trend?.direction === 'up');

                const content = (
                    <div className={`group flex flex-col justify-between rounded-xl bg-surface p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover ${spanClass}`}>
                        <div className="flex items-start justify-between">
                            {item.icon && (
                                <div
                                    className="flex h-12 w-12 items-center justify-center rounded-xl"
                                    style={{
                                        backgroundColor: item.accentColor ? `${item.accentColor}15` : 'var(--color-surface-muted)',
                                        color: item.accentColor ?? 'var(--color-text-muted)',
                                    }}
                                >
                                    {item.icon}
                                </div>
                            )}
                            <div className="flex items-end gap-1 h-8">
                                {[3, 5, 4, 7].map((h, j) => (
                                    <div
                                        key={j}
                                        className="sparkline-bar w-1.5 rounded-full"
                                        style={{
                                            height: `${h * 4}px`,
                                            backgroundColor: item.accentColor ? `${item.accentColor}40` : 'var(--color-surface-muted)',
                                            '--delay': `${j * 100 + 100}ms`,
                                        } as React.CSSProperties}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="mt-6">
                            <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">{item.label}</div>
                            <div className={`mt-1.5 text-2xl font-bold tabular-nums tracking-tight ${item.valueClassName ?? 'text-text'}`}>{item.value}</div>
                        </div>
                        <div className="mt-4 flex h-5 items-center gap-1.5">
                            {item.trend && (
                                <>
                                    {trendPositive ? (
                                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                                    ) : (
                                        <TrendingDown className="h-4 w-4 text-red-600" />
                                    )}
                                    <span className={`text-[13px] font-medium ${trendPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {item.trend.value}
                                    </span>
                                    {item.trend.label && (
                                        <span className="text-[13px] text-text-muted">{item.trend.label}</span>
                                    )}
                                </>
                            )}
                            {!item.trend && item.sublabel && (
                                <span className={`text-xs ${item.sublabelColor ?? 'text-text-muted'}`}>{item.sublabel}</span>
                            )}
                        </div>
                    </div>
                );

                if (item.href) {
                    return (
                        <Link key={i} href={item.href} className={`block ${spanClass}`}>
                            {content}
                        </Link>
                    );
                }

                return <div key={i} className={spanClass}>{content}</div>;
            })}
        </div>
    );
}
