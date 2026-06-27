import { Link, router } from '@inertiajs/react';
import { CheckCircle2, ClipboardList, MapPin, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/pagination';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/ui/status-badge';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS_BORDER: Record<string, string> = {
    requested: 'border-l-4 border-l-red-400',
    rejected: 'border-l-4 border-l-red-400',
    preparing: 'border-l-4 border-l-amber-400',
    shipped: 'border-l-4 border-l-blue-400',
    completed: 'border-l-4 border-l-emerald-400',
};

const FILTER_TABS = [
    { key: 'requested', label: 'Butuh Tindakan' },
    { key: 'preparing', label: 'Disiapkan' },
    { key: 'shipped', label: 'Dikirim' },
    { key: 'completed', label: 'Selesai' },
];

export default function OwnerRestocksIndex({ restocks, filters }: any) {
    const currentStatus = filters.status ?? 'requested';

    // Default to "requested" status when no filters are set
    useEffect(() => {
        if (!filters.status && !filters.outlet_id) {
            router.get('/owner/restocks', { status: 'requested' }, { preserveState: true, replace: true });
        }
    }, []);

    const handleTabChange = (status: string) => {
        router.get('/owner/restocks', { status, outlet_id: filters.outlet_id || undefined }, { preserveState: true, replace: true });
    };

    const handleApprove = (e: React.MouseEvent, restockId: number) => {
        e.preventDefault();
        e.stopPropagation();
        router.post(`/owner/restocks/${restockId}/approve`, {}, { preserveScroll: true });
    };

    return (
        <OwnerPageShell title="Restocks" subtitle="Kelola permintaan restock dari outlet">
            {/* Filter Tabs */}
            <div className="mb-4 flex flex-wrap gap-2">
                {FILTER_TABS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => handleTabChange(tab.key)}
                        className={cn(
                            'rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-all',
                            currentStatus === tab.key
                                ? 'bg-primary/10 text-primary ring-primary/20 shadow-sm'
                                : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Restock List */}
            {restocks.data.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/50 py-16 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-muted">
                        <ClipboardList className="h-7 w-7 text-text-subtle" />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-text">Tidak ada restock</p>
                    <p className="mt-1 text-xs text-text-muted">
                        {currentStatus === 'requested'
                            ? 'Tidak ada permintaan restock saat ini'
                            : `Tidak ada restock dengan status "${FILTER_TABS.find(t => t.key === currentStatus)?.label}"`}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {restocks.data.map((r: any) => (
                        <Link
                            key={r.id}
                            href={`/owner/restocks/${r.id}`}
                            className={cn(
                                'group flex items-start justify-between rounded-xl border border-border bg-surface p-4 transition-all duration-200 hover:shadow-md',
                                STATUS_BORDER[r.status]
                            )}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-text">#{r.id}</span>
                                    <StatusBadge status={r.status} size="sm" />
                                </div>
                                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-text-muted">
                                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                                    <span className="font-medium text-text">{r.outlet.name}</span>
                                </div>
                                <div className="mt-1 flex items-center gap-3 text-xs text-text-subtle">
                                    <span>{r.items.length} item</span>
                                    <span className="tabular-nums">{formatDate(r.created_at)}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {r.status === 'requested' && (
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={(e) => handleApprove(e, r.id)}
                                    >
                                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                        Approve
                                    </Button>
                                )}
                                {r.status === 'preparing' && (
                                    <div className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                                        <Truck className="h-3.5 w-3.5" />
                                        <span>Siapkan</span>
                                    </div>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
            <Pagination links={restocks.links} />
        </OwnerPageShell>
    );
}
