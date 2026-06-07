import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

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
    secondary: 'border border-zinc-200 text-slate-700 hover:bg-zinc-50',
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
            <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white py-12 text-center">
                <div className="text-slate-400"><Inbox className="h-8 w-8" /></div>
                <p className="mt-2 text-sm font-medium text-slate-600">{emptyMessage}</p>
                {emptyAction && (
                    <div className="mt-3">
                        {emptyAction.href ? (
                            <a href={emptyAction.href} className="inline-flex min-h-[36px] items-center justify-center rounded-lg bg-emerald-700 px-4 text-xs font-semibold text-white">
                                {emptyAction.label}
                            </a>
                        ) : (
                            <button onClick={emptyAction.onClick} className="inline-flex min-h-[36px] items-center justify-center rounded-lg bg-emerald-700 px-4 text-xs font-semibold text-white">
                                {emptyAction.label}
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`overflow-x-auto rounded-xl border border-zinc-200 bg-white ${className}`}>
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50/50">
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                className={`px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 ${col.className ?? ''}`}
                            >
                                {col.label}
                            </th>
                        ))}
                        {actions && actions.length > 0 && (
                            <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                Aksi
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                    {data.map((row) => (
                        <tr
                            key={row[rowKey]}
                            className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-zinc-50/50' : ''}`}
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
