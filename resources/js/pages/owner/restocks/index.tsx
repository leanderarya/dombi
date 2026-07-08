import { router } from '@inertiajs/react';
import { useEffect } from 'react';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/ui/pagination';
import StatusBadge from '@/components/ui/status-badge';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const FILTER_TABS = [
    { key: 'requested', label: 'Butuh Tindakan' },
    { key: 'preparing', label: 'Disiapkan' },
    { key: 'shipped', label: 'Dikirim' },
    { key: 'completed', label: 'Selesai' },
];

export default function OwnerRestocksIndex({ restocks, filters, outlets }: any) {
    const currentStatus = filters.status ?? 'requested';

    const counts = {
        requested: restocks.data.filter((r: any) => r.status === 'requested').length,
        preparing: restocks.data.filter((r: any) => r.status === 'preparing').length,
        shipped: restocks.data.filter((r: any) => r.status === 'shipped').length,
        completed: restocks.data.filter((r: any) => r.status === 'completed').length,
    };

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
            {/* Status Tabs */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                {FILTER_TABS.map((tab) => (
                    <button key={tab.key} type="button" onClick={() => handleTabChange(tab.key)}
                        className={cn(
                            'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition-all',
                            currentStatus === tab.key
                                ? 'bg-primary/10 text-primary ring-primary/20'
                                : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                        )}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Filter controls */}
            <OwnerFilterCard
                searchPlaceholder="Cari kode..."
                searchValue={filters.search ?? ''}
                onSearch={(val) => {
                    router.get('/owner/restocks', { ...filters, search: val || undefined, status: currentStatus }, { preserveState: true, replace: true });
                }}
                outletOptions={outlets?.map((o: any) => ({ value: String(o.id), label: o.name }))}
                outletValue={filters.outlet_id ?? ''}
                onOutletChange={(val) => {
                    router.get('/owner/restocks', { ...filters, outlet_id: val || undefined, status: currentStatus }, { preserveState: true, replace: true });
                }}
                dateValue={filters.date ?? ''}
                onDateChange={(val) => {
                    router.get('/owner/restocks', { ...filters, date: val || undefined, status: currentStatus }, { preserveState: true, replace: true });
                }}
            />

            {/* KPI Strip */}
            <OwnerKpiStrip items={[
                { label: 'Menunggu', value: counts.requested, sublabel: counts.requested > 0 ? 'Perlu ditinjau' : undefined, sublabelColor: 'text-amber-600' },
                { label: 'Disiapkan', value: counts.preparing },
                { label: 'Dikirim', value: counts.shipped },
                { label: 'Selesai', value: counts.completed },
            ]} />

            {/* Table */}
            {restocks.data.length === 0 ? (
                <div className="rounded-lg border border-border bg-white py-10 text-center text-xs text-text-muted">
                    Tidak ada restock
                </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                    {/* Header */}
                    <div className="grid grid-cols-[80px_1fr_100px_60px_100px_80px] items-center gap-3 bg-[#fafafa] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                        <span>Kode</span><span>Outlet</span><span>Status</span><span className="text-center">Items</span><span>Tanggal</span><span />
                    </div>
                    {/* Rows */}
                    {restocks.data.map((r: any) => (
                        <div key={r.id}
                            className="grid grid-cols-[80px_1fr_100px_60px_100px_80px] items-center gap-3 border-t border-[#f0f0f0] px-3 py-2 text-sm transition-colors last:border-t-0 hover:bg-surface-muted">
                            <span className="font-bold tabular-nums text-text">#{r.id}</span>
                            <span className="truncate text-text-muted">{r.outlet?.name ?? '-'}</span>
                            <span><StatusBadge status={r.status} size="sm" /></span>
                            <span className="text-center text-text-muted">{r.items?.length ?? 0}</span>
                            <span className="text-text-muted">{formatDate(r.created_at)}</span>
                            <div className="flex items-center gap-1 justify-end">
                                {r.status === 'requested' && (
                                    <button type="button" onClick={(e) => handleApprove(e, r.id)}
                                        className="rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-white hover:bg-primary-hover">
                                        Approve
                                    </button>
                                )}
                                <button type="button" onClick={() => router.visit(`/owner/restocks/${r.id}`)}
                                    className="rounded-md px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary-light">
                                    Detail →
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Pagination links={restocks.links} />
        </OwnerPageShell>
    );
}
