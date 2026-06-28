import { Link, router } from '@inertiajs/react';
import { ArrowDownRight, CheckCircle, CheckCircle2, ClipboardList, Clock, MapPin, Package, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/pagination';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/ui/status-badge';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const FILTER_TABS = [
    { key: 'requested', label: 'Butuh Tindakan' },
    { key: 'preparing', label: 'Disiapkan' },
    { key: 'shipped', label: 'Dikirim' },
    { key: 'completed', label: 'Selesai' },
];

export default function OwnerRestocksIndex({ restocks, filters }: any) {
    const currentStatus = filters.status ?? 'requested';

    // KPI counts from full dataset
    const counts = {
        requested: restocks.data.filter((r: any) => r.status === 'requested').length,
        preparing: restocks.data.filter((r: any) => r.status === 'preparing').length,
        shipped: restocks.data.filter((r: any) => r.status === 'shipped').length,
        completed: restocks.data.filter((r: any) => r.status === 'completed').length,
    };

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
            <div className="space-y-6 lg:grid lg:grid-cols-[1fr_320px] lg:gap-6 lg:space-y-0">
                {/* Left: Filters + List */}
                <div className="space-y-4">
                    {/* Filter Tabs */}
                    <div className="flex flex-wrap gap-2">
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
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white py-16 text-center">
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
                                    className="group flex items-start justify-between rounded-xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-md"
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
                </div>

                {/* Right: KPI Sidebar */}
                <div className="hidden lg:block">
                    <div className="sticky top-24 space-y-3">
                        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <Clock className="h-4 w-4 text-amber-500" />
                                Menunggu Persetujuan
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">{counts.requested}</div>
                            {counts.requested > 0 && (
                                <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-600">
                                    <ArrowDownRight className="h-3 w-3" />
                                    Perlu ditinjau
                                </div>
                            )}
                        </div>
                        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <Package className="h-4 w-4 text-blue-500" />
                                Sedang Disiapkan
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">{counts.preparing}</div>
                            {counts.preparing > 0 && (
                                <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-blue-600">
                                    <Package className="h-3 w-3" />
                                    Sedang proses
                                </div>
                            )}
                        </div>
                        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <Truck className="h-4 w-4 text-violet-500" />
                                Sudah Dikirim
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">{counts.shipped}</div>
                            {counts.shipped > 0 && (
                                <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-violet-600">
                                    <Truck className="h-3 w-3" />
                                    Dalam perjalanan
                                </div>
                            )}
                        </div>
                        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <CheckCircle className="h-4 w-4 text-emerald-500" />
                                Selesai
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">{counts.completed}</div>
                            {counts.completed > 0 && (
                                <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                                    <CheckCircle className="h-3 w-3" />
                                    Restock selesai
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </OwnerPageShell>
    );
}
