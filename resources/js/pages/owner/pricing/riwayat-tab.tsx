import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/ui/pagination';
import { SkeletonList } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency, formatDate } from '@/lib/format';
import type { PaginatedLogs } from './types';

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

const actionVariants: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
    update: 'info',
    bulk_update: 'warning',
    copy: 'neutral',
    master_update: 'success',
    reset: 'neutral',
};

export function RiwayatTab({ logs, actionFilter }: { logs?: PaginatedLogs; actionFilter?: string }) {
    const handleFilterChange = (key: string) => {
        router.get('/owner/pricing', { tab: 'riwayat', ...(key ? { action: key } : {}) }, { preserveState: true, replace: true });
    };

    if (!logs) {
        return <SkeletonList count={5} />;
    }

    return (
        <div>
            <div className="mb-4 flex flex-wrap gap-2 overflow-x-auto scrollbar-none">
                {ACTION_FILTERS.map((f) => (
                    <Button
                        key={f.key}
                        type="button"
                        size="sm"
                        variant={(actionFilter ?? '') === f.key ? 'secondary' : 'ghost'}
                        onClick={() => handleFilterChange(f.key)}
                    >
                        {f.label}
                    </Button>
                ))}
            </div>

            <div className="space-y-3">
                {logs.data.length === 0 ? (
                    <EmptyState title="Belum ada riwayat perubahan harga." />
                ) : (
                    logs.data.map((log) => (
                        <div key={log.id} className="rounded-lg border border-border bg-white p-4 transition-all duration-200">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-sm font-bold text-text">{log.product}</div>
                                    <div className="mt-1">
                                        <StatusBadge variant={actionVariants[log.action] ?? 'neutral'} size="sm">
                                            {actionLabels[log.action] ?? log.action}
                                        </StatusBadge>
                                    </div>
                                </div>
                                <span className="text-sm font-bold tabular-nums text-primary">{formatCurrency(log.new_price)}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                                {log.outlet !== 'Global' && <span>{log.outlet}</span>}
                                {log.outlet !== 'Global' && <span className="text-text-subtle">&middot;</span>}
                                <span>{formatDate(log.created_at)}</span>
                                <span className="text-text-subtle">&middot;</span>
                                <span>{log.changed_by}</span>
                                {log.old_price != null && (
                                    <>
                                        <span className="text-text-subtle">&middot;</span>
                                        <span>Lama: <span className="line-through">{formatCurrency(log.old_price)}</span></span>
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {logs.links && logs.links.length > 3 && <Pagination links={logs.links} />}
        </div>
    );
}
