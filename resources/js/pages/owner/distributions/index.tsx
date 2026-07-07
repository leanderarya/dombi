import { router } from '@inertiajs/react';
import { useEffect } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/ui/pagination';
import StatusBadge from '@/components/ui/status-badge';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const FILTER_TABS = [
    { key: 'preparing', label: 'Disiapkan' },
    { key: 'shipped', label: 'Dikirim' },
    { key: 'completed', label: 'Selesai' },
];

export default function OwnerDistributionsIndex({ distributions, filters }: any) {
    const currentStatus = filters.status ?? 'preparing';

    const preparingCount = distributions.data.filter((d: any) => d.status === 'preparing').length;
    const shippedCount = distributions.data.filter((d: any) => d.status === 'shipped').length;
    const completedCount = distributions.data.filter((d: any) => d.status === 'completed').length;

    useEffect(() => {
        if (!filters.status && !filters.outlet_id) {
            router.get('/owner/distributions', { status: 'preparing' }, { preserveState: true, replace: true });
        }
    }, []);

    const handleTabChange = (status: string) => {
        router.get('/owner/distributions', { status, outlet_id: filters.outlet_id || undefined }, { preserveState: true, replace: true });
    };

    const handleMarkShipped = (e: React.MouseEvent, distributionId: number) => {
        e.preventDefault();
        e.stopPropagation();
        router.post(`/owner/distributions/${distributionId}/mark-shipped`, {}, { preserveScroll: true });
    };

    return (
        <OwnerPageShell title="Distribusi" subtitle="Kelola distribusi stok ke outlet">
            {/* Filter controls */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                {FILTER_TABS.map((tab) => (
                    <button key={tab.key} type="button" onClick={() => handleTabChange(tab.key)}
                        className={cn(
                            'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 transition-all',
                            currentStatus === tab.key
                                ? 'bg-primary/10 text-primary ring-primary/20'
                                : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                        )}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* KPI Strip */}
            <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Disiapkan</div>
                    <div className="mt-1 text-base font-bold tabular-nums">{preparingCount}</div>
                    {preparingCount > 0 && <div className="text-[10px] font-medium text-amber-600">Siap dikirim</div>}
                </div>
                <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Dalam Perjalanan</div>
                    <div className="mt-1 text-base font-bold tabular-nums">{shippedCount}</div>
                    {shippedCount > 0 && <div className="text-[10px] font-medium text-blue-600">Sedang dikirim</div>}
                </div>
                <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Selesai</div>
                    <div className="mt-1 text-base font-bold tabular-nums">{completedCount}</div>
                </div>
            </div>

            {/* Table */}
            {distributions.data.length === 0 ? (
                <div className="rounded-lg border border-border bg-white py-10 text-center text-xs text-text-muted">
                    Tidak ada distribusi
                </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                    <div className="grid grid-cols-[80px_1fr_100px_100px_100px_80px] items-center gap-3 bg-[#fafafa] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                        <span>Kode</span><span>Outlet</span><span>Status</span><span>Items</span><span>Tanggal</span><span />
                    </div>
                    {distributions.data.map((d: any) => (
                        <div key={d.id}
                            className="grid grid-cols-[80px_1fr_100px_100px_100px_80px] items-center gap-3 border-t border-[#f0f0f0] px-3 py-2 text-xs transition-colors last:border-t-0 hover:bg-surface-muted">
                            <span className="font-bold tabular-nums text-text">#{d.id}</span>
                            <span className="truncate text-text-muted">{d.outlet?.name ?? '-'}</span>
                            <span><StatusBadge status={d.status} size="sm" /></span>
                            <span className="text-text-muted">{d.items?.length ?? 0} item</span>
                            <span className="text-text-muted">{d.sent_at ? formatDate(d.sent_at) : 'Belum dikirim'}</span>
                            <div className="flex items-center gap-1 justify-end">
                                {d.status === 'preparing' && (
                                    <button type="button" onClick={(e) => handleMarkShipped(e, d.id)}
                                        className="rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-primary-hover">
                                        Kirim
                                    </button>
                                )}
                                <button type="button" onClick={() => router.visit(`/owner/distributions/${d.id}`)}
                                    className="rounded-md px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary-light">
                                    Detail →
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Pagination links={distributions.links} />
        </OwnerPageShell>
    );
}
