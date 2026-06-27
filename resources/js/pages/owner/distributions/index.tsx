import { Link, router } from '@inertiajs/react';
import { CheckCircle2, MapPin, Package, Truck } from 'lucide-react';
import { useEffect } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/pagination';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import StatusBadge from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

const STATUS_BORDER: Record<string, string> = {
    preparing: 'border-l-4 border-l-amber-400',
    shipped: 'border-l-4 border-l-blue-400',
    completed: 'border-l-4 border-l-emerald-400',
};

const FILTER_TABS = [
    { key: 'preparing', label: 'Disiapkan' },
    { key: 'shipped', label: 'Dikirim' },
    { key: 'completed', label: 'Selesai' },
];

export default function OwnerDistributionsIndex({ distributions, filters }: any) {
    const currentStatus = filters.status ?? 'preparing';

    // Default to "preparing" status when no filters are set
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

            {/* Distribution List */}
            {distributions.data.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/50 py-16 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-muted">
                        <Package className="h-7 w-7 text-text-subtle" />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-text">Tidak ada distribusi</p>
                    <p className="mt-1 text-xs text-text-muted">
                        {currentStatus === 'preparing'
                            ? 'Tidak ada distribusi yang perlu disiapkan'
                            : `Tidak ada distribusi dengan status "${FILTER_TABS.find(t => t.key === currentStatus)?.label}"`}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {distributions.data.map((d: any) => (
                        <Link
                            key={d.id}
                            href={`/owner/distributions/${d.id}`}
                            className={cn(
                                'group flex items-start justify-between rounded-xl border border-border bg-surface p-4 transition-all duration-200 hover:shadow-md',
                                STATUS_BORDER[d.status]
                            )}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-text">#{d.id}</span>
                                    <StatusBadge status={d.status} size="sm" />
                                </div>
                                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-text-muted">
                                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                                    <span className="font-medium text-text">{d.outlet.name}</span>
                                </div>
                                <div className="mt-1 text-xs text-text-subtle tabular-nums">
                                    {d.sent_at ? formatDate(d.sent_at) : 'Belum dikirim'}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {d.status === 'preparing' && (
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={(e) => handleMarkShipped(e, d.id)}
                                    >
                                        <Truck className="h-3.5 w-3.5 mr-1" />
                                        Kirim
                                    </Button>
                                )}
                                {d.status === 'shipped' && (
                                    <div className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        <span>Dalam Perjalanan</span>
                                    </div>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
            <Pagination links={distributions.links} />
        </OwnerPageShell>
    );
}
