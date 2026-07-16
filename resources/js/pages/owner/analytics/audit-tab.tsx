import { router } from '@inertiajs/react';
import { ArrowDownRight, ArrowUpRight, ClipboardList } from 'lucide-react';
import { useState } from 'react';
import FilterSheet from '@/components/owner/filter-sheet';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/ui/pagination';
import { SkeletonPage } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';

interface Props {
    movements?: any;
    outlets?: any[];
    products?: any[];
    filters?: Record<string, any>;
}

const typeLabels: Record<string, string> = {
    initial_stock: 'Stok Awal',
    stock_adjustment: 'Penyesuaian',
    order_reserved: 'Direservasi',
    order_completed: 'Selesai',
    order_cancelled: 'Dibatalkan',
    restock_in: 'Restock Masuk',
    delivery_returned: 'Dikembalikan',
};
const typeColors: Record<string, string> = {
    initial_stock: 'text-text-muted',
    stock_adjustment: 'text-amber-700',
    order_reserved: 'text-blue-700',
    order_completed: 'text-emerald-700',
    order_cancelled: 'text-red-700',
    restock_in: 'text-emerald-700',
    delivery_returned: 'text-purple-700',
};
const typeOptions = Object.entries(typeLabels).map(([k, v]) => ({ value: k, label: v }));

export function AuditTrailTab({ movements, outlets = [], products = [], filters = {} }: Props) {
    const [filterOpen, setFilterOpen] = useState(false);
    const activeFilterCount = [filters.outlet_id, filters.product_id, filters.type].filter(Boolean).length;

    const handleFilterApply = (f: Record<string, string>) => {
        router.get(
            '/owner/analytics',
            {
                tab: 'audit',
                outlet_id: f.outlet_id || undefined,
                product_id: f.product_id || undefined,
                type: f.type || undefined,
            },
            { preserveState: true, replace: true },
        );
    };

    if (!movements) {
        return <SkeletonPage />;
    }

    if (movements.data.length === 0) {
        return (
            <EmptyState
                icon={<ClipboardList className="h-8 w-8 text-text-subtle" aria-hidden="true" />}
                title="Belum ada movement"
                description="Perubahan stok akan tercatat di sini."
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <div className="relative">
                    <Button variant="outline" size="sm" onClick={() => setFilterOpen(true)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                        Filter
                    </Button>
                    {activeFilterCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[10px] font-bold text-white">
                            {activeFilterCount}
                        </span>
                    )}
                </div>
            </div>

            <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
                <div className="space-y-1.5" aria-label="Daftar movement stok">
                    {movements.data.map((m: any) => (
                        <div
                            key={m.id}
                            className="flex items-center gap-3 rounded-xl bg-surface shadow-card px-3 py-2.5 transition-all duration-200"
                        >
                            <div className={`shrink-0 text-xs font-bold tabular-nums ${m.quantity >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                {m.quantity >= 0 ? '+' : ''}
                                {m.quantity}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-xs font-semibold text-text">{m.product?.name ?? '-'}</div>
                                <div className="mt-0.5 text-xs text-text-subtle">
                                    {m.outlet?.name} &middot;{' '}
                                    <span className={typeColors[m.type] ?? 'text-text-muted'}>{typeLabels[m.type] ?? m.type}</span>
                                </div>
                            </div>
                            <div className="shrink-0 text-right">
                                <div className="text-xs tabular-nums text-text-muted">
                                    {m.before_stock}&rarr;{m.after_stock}
                                </div>
                                <div className="text-xs tabular-nums text-text-subtle">{formatDate(m.created_at)}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="hidden lg:block">
                    <div className="sticky top-4 space-y-3">
                        <div className="rounded-xl bg-surface shadow-card p-5">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <ClipboardList className="h-4 w-4 text-text-subtle" aria-hidden="true" />
                                Total Movement
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">{movements.data.length}</div>
                            <div className="mt-1 text-xs font-medium text-text-muted">Semua movement</div>
                        </div>
                        <div className="rounded-xl bg-surface shadow-card p-5">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <ArrowDownRight className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                                Stok Masuk
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">{movements.data.filter((m: any) => m.quantity > 0).length}</div>
                            <div className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-500">
                                <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
                                Restock & penyesuaian
                            </div>
                        </div>
                        <div className="rounded-xl bg-surface shadow-card p-5">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <ArrowUpRight className="h-4 w-4 text-red-500" aria-hidden="true" />
                                Stok Keluar
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">{movements.data.filter((m: any) => m.quantity < 0).length}</div>
                            <div className="mt-1 flex items-center gap-1 text-xs font-medium text-red-500">
                                <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                                Pesanan & pembatalan
                            </div>
                        </div>

                        {activeFilterCount > 0 && (
                            <div className="rounded-xl bg-surface shadow-card p-4" aria-label="Filter aktif">
                                <div className="mb-3 text-xs font-medium text-text-muted">Filter Aktif</div>
                                <div className="space-y-1.5">
                                    {filters.outlet_id && (
                                        <div className="text-xs text-text">
                                            Outlet: {outlets.find((o: any) => String(o.id) === String(filters.outlet_id))?.name ?? filters.outlet_id}
                                        </div>
                                    )}
                                    {filters.product_id && (
                                        <div className="text-xs text-text">
                                            Produk: {products.find((p: any) => String(p.id) === String(filters.product_id))?.name ?? filters.product_id}
                                        </div>
                                    )}
                                    {filters.type && (
                                        <div className="text-xs text-text">
                                            Tipe: <span className={typeColors[filters.type]}>{typeLabels[filters.type] ?? filters.type}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {movements.links && <Pagination links={movements.links} />}

            <FilterSheet
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                sections={[
                    {
                        key: 'outlet_id',
                        label: 'Outlet',
                        options: outlets.map((o: any) => ({ value: String(o.id), label: o.name })),
                        value: filters.outlet_id ? String(filters.outlet_id) : '',
                    },
                    {
                        key: 'product_id',
                        label: 'Produk',
                        options: products.map((p: any) => ({ value: String(p.id), label: p.name })),
                        value: filters.product_id ? String(filters.product_id) : '',
                    },
                    { key: 'type', label: 'Tipe', options: typeOptions, value: filters.type ?? '' },
                ]}
                onApply={handleFilterApply}
            />
        </div>
    );
}
