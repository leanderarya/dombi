import { router } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/ui/pagination';
import { SkeletonList } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency, formatDate } from '@/lib/format';
import type { OutletData, PaginatedLogs } from './types';

const ACTION_FILTERS = [
    { key: '', label: 'Semua' },
    { key: 'master_update', label: 'Harga Pusat' },
    { key: 'update', label: 'Harga Outlet' },
    { key: 'bulk_update', label: 'Bulk Update' },
    { key: 'copy', label: 'Salin' },
    { key: 'reset', label: 'Reset' },
];

const actionLabels: Record<string, string> = {
    update: 'Ubah',
    bulk_update: 'Ubah Massal',
    copy: 'Salin',
    master_update: 'Harga Pusat',
    reset: 'Reset',
};

const actionVariants: Record<
    string,
    'success' | 'warning' | 'info' | 'neutral'
> = {
    update: 'info',
    bulk_update: 'warning',
    copy: 'neutral',
    master_update: 'success',
    reset: 'neutral',
};

export function RiwayatTab({
    logs,
    actionFilter,
    outlets,
}: {
    logs?: PaginatedLogs;
    actionFilter?: string;
    outlets?: OutletData[];
}) {
    const [outletFilter, setOutletFilter] = useState('');

    const handleFilterChange = (key: string) => {
        router.get(
            '/owner/pricing',
            {
                tab: 'riwayat',
                ...(key ? { action: key } : {}),
                ...(outletFilter ? { outlet_id: outletFilter } : {}),
            },
            { preserveState: true, replace: true },
        );
    };

    const handleOutletChange = (outletId: string) => {
        setOutletFilter(outletId);
        router.get(
            '/owner/pricing',
            {
                tab: 'riwayat',
                ...(actionFilter ? { action: actionFilter } : {}),
                ...(outletId ? { outlet_id: outletId } : {}),
            },
            { preserveState: true, replace: true },
        );
    };

    if (!logs) {
        return <SkeletonList count={5} />;
    }

    return (
        <div>
            <div
                className="mb-4 scrollbar-none flex flex-wrap gap-2 overflow-x-auto"
                role="group"
                aria-label="Filter aksi harga"
            >
                {ACTION_FILTERS.map((f) => (
                    <Button
                        key={f.key}
                        type="button"
                        size="sm"
                        variant={
                            (actionFilter ?? '') === f.key
                                ? 'secondary'
                                : 'ghost'
                        }
                        onClick={() => handleFilterChange(f.key)}
                    >
                        {f.label}
                    </Button>
                ))}
            </div>

            {outlets && outlets.length > 0 && (
                <div className="mb-4">
                    <select
                        value={outletFilter}
                        onChange={(e) => handleOutletChange(e.target.value)}
                        className="h-8 rounded-md border border-border bg-surface px-2 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    >
                        <option value="">Semua Outlet</option>
                        {outlets.map((o) => (
                            <option key={o.id} value={o.id}>
                                {o.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <div className="space-y-3" aria-label="Riwayat perubahan harga">
                {logs.data.length === 0 ? (
                    <EmptyState title="Belum ada riwayat perubahan harga." />
                ) : (
                    logs.data.map((log) => (
                        <div
                            key={log.id}
                            className="rounded-xl bg-surface p-4 shadow-card transition-all duration-200"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-sm font-bold text-text">
                                        {log.product}
                                    </div>
                                    <div className="mt-1">
                                        <StatusBadge
                                            variant={
                                                actionVariants[log.action] ??
                                                'neutral'
                                            }
                                            size="sm"
                                        >
                                            {actionLabels[log.action] ??
                                                log.action}
                                        </StatusBadge>
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-primary tabular-nums">
                                    {formatCurrency(log.new_price)}
                                </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                                {log.outlet !== 'Global' && (
                                    <span>{log.outlet}</span>
                                )}
                                {log.outlet !== 'Global' && (
                                    <span className="text-text-subtle">
                                        &middot;
                                    </span>
                                )}
                                <span>{formatDate(log.created_at)}</span>
                                <span className="text-text-subtle">
                                    &middot;
                                </span>
                                <span>{log.changed_by}</span>
                                {log.old_price != null && (
                                    <>
                                        <span className="text-text-subtle">
                                            &middot;
                                        </span>
                                        <span>
                                            <span className="text-text-muted line-through">
                                                {formatCurrency(log.old_price)}
                                            </span>
                                            {' → '}
                                            <span
                                                className={
                                                    log.new_price >
                                                    log.old_price
                                                        ? 'font-semibold text-emerald-600'
                                                        : log.new_price <
                                                            log.old_price
                                                          ? 'font-semibold text-red-600'
                                                          : ''
                                                }
                                            >
                                                {formatCurrency(log.new_price)}
                                            </span>
                                            {log.new_price !==
                                                log.old_price && (
                                                <span
                                                    className={`ml-1 text-xs font-medium ${
                                                        log.new_price >
                                                        log.old_price
                                                            ? 'text-emerald-600'
                                                            : 'text-red-600'
                                                    }`}
                                                >
                                                    (
                                                    {log.new_price >
                                                    log.old_price
                                                        ? '+'
                                                        : ''}
                                                    {formatCurrency(
                                                        log.new_price -
                                                            log.old_price,
                                                    )}
                                                    )
                                                </span>
                                            )}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {logs.links && logs.links.length > 3 && (
                <Pagination links={logs.links} />
            )}
        </div>
    );
}
