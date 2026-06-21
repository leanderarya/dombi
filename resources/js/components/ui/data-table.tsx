import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import EmptyState from '@/components/ui/empty-state';

interface Column<T> {
    key: string;
    label: string;
    className?: string;
    /** Render function for cell content */
    render?: (row: T) => ReactNode;
    /** Whether column is sortable */
    sortable?: boolean;
    /** Whether to show this column prominently (as title) */
    primary?: boolean;
}

interface Action<T> {
    label: string;
    onClick: (row: T) => void;
    variant?: 'primary' | 'secondary' | 'danger';
    icon?: ReactNode;
    /** Condition to show the action */
    show?: (row: T) => boolean;
}

interface Props<T> {
    columns: Column<T>[];
    data: T[];
    actions?: Action<T>[];
    /** Key field for row identification */
    rowKey: string;
    /** Empty state message */
    emptyMessage?: string;
    emptyAction?: { label: string; href?: string; onClick?: () => void };
    onRowClick?: (row: T) => void;
    className?: string;
}

const actionVariants = {
    primary: 'bg-primary text-white active:bg-primary-hover',
    secondary: 'border border-border text-text active:bg-surface-muted',
    danger: 'border border-red-200 text-red-600 active:bg-red-50',
};

export default function DataTable<T extends Record<string, any>>({
    columns,
    data,
    actions,
    rowKey,
    emptyMessage = 'Tidak ada data',
    emptyAction,
    onRowClick,
    className = '',
}: Props<T>) {
    if (data.length === 0) {
        return (
            <div className="rounded-xl bg-white">
                <EmptyState
                    icon={<Inbox className="h-8 w-8" />}
                    title={emptyMessage}
                    description="Belum ada data yang tersedia"
                    action={emptyAction ? { label: emptyAction.label, href: emptyAction.href, onClick: emptyAction.onClick } : undefined}
                />
            </div>
        );
    }

    const primaryCol = columns.find((c) => c.primary) ?? columns[0];
    const secondaryCols = columns.filter((c) => c !== primaryCol);

    return (
        <div className={`space-y-2 ${className}`}>
            {data.map((row) => (
                <div
                    key={row[rowKey]}
                    className={`rounded-xl bg-white ${onRowClick ? 'active:opacity-80' : ''}`}
                    onClick={() => onRowClick?.(row)}
                >
                    <div className="p-4">
                        {/* Primary row — title */}
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-text truncate">
                                    {primaryCol.render ? primaryCol.render(row) : row[primaryCol.key]}
                                </div>
                            </div>
                        </div>

                        {/* Secondary rows — key-value pairs */}
                        {secondaryCols.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                                {secondaryCols.map((col) => (
                                    <div key={col.key} className="flex items-center gap-1.5">
                                        <span className="text-[11px] text-text-subtle">{col.label}:</span>
                                        <span className={`text-[11px] font-medium text-text ${col.className ?? ''}`}>
                                            {col.render ? col.render(row) : row[col.key]}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    {actions && actions.length > 0 && (
                        <div className="border-t border-border px-4 py-2.5 flex items-center justify-end gap-2">
                            {actions
                                .filter((action) => !action.show || action.show(row))
                                .map((action, i) => (
                                    <button
                                        key={i}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            action.onClick(row);
                                        }}
                                        className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition-colors ${actionVariants[action.variant ?? 'secondary']}`}
                                    >
                                        {action.icon}
                                        {action.label}
                                    </button>
                                ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
