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
    primary: 'bg-emerald-700 text-white hover:bg-emerald-800',
    secondary: 'border border-border text-slate-700 hover:bg-surface-muted',
    danger: 'border border-red-200 text-red-700 hover:bg-red-50',
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
            <div className="rounded-xl border border-border bg-surface">
                <EmptyState
                    icon={<Inbox className="h-8 w-8" />}
                    title={emptyMessage}
                    description="Belum ada data yang tersedia"
                    action={emptyAction ? { label: emptyAction.label, href: emptyAction.href, onClick: emptyAction.onClick } : undefined}
                />
            </div>
        );
    }

    return (
        <div className={`overflow-x-auto rounded-xl border border-border bg-surface ${className}`}>
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-zinc-100 bg-surface-muted/50">
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                className={`px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-text-subtle ${col.className ?? ''}`}
                            >
                                {col.label}
                            </th>
                        ))}
                        {actions && actions.length > 0 && (
                            <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-text-subtle">
                                Aksi
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                    {data.map((row) => (
                        <tr
                            key={row[rowKey]}
                            className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-surface-muted/50' : ''}`}
                            onClick={() => onRowClick?.(row)}
                        >
                            {columns.map((col) => (
                                <td key={col.key} className={`px-4 py-3 ${col.className ?? ''}`}>
                                    {col.render ? col.render(row) : row[col.key]}
                                </td>
                            ))}
                            {actions && actions.length > 0 && (
                                <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                        {actions
                                            .filter((action) => !action.show || action.show(row))
                                            .map((action, i) => (
                                                <button
                                                    key={i}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        action.onClick(row);
                                                    }}
                                                    className={`inline-flex min-h-[32px] items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold transition-colors ${actionVariants[action.variant ?? 'secondary']}`}
                                                >
                                                    {action.icon}
                                                    {action.label}
                                                </button>
                                            ))}
                                    </div>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
